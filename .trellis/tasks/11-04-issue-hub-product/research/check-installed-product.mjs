import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { findCodexCommand } from '../../../../packages/token-usage/src/codex-bridge.mjs';

// 只验证安装后的发现与资源，不调用业务工具，也不创建或读取聊天。
const allowed = new Set(['initialize', 'mcpServerStatus/list', 'mcpServer/resource/read']);
const target = await findCodexCommand();
const child = spawn(target.command, [...target.args, 'app-server', '--stdio'], {
  shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
});
child.stderr.on('data', () => {});
let serial = 0;
const pending = new Map();
const finish = () => {
  for (const entry of pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(new Error('独立宿主连接已关闭。'));
  }
  pending.clear();
};
child.on('error', finish);
child.on('exit', finish);
child.stdin.on('error', finish);
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  if (Buffer.byteLength(line) > 16 * 1024 * 1024) { child.kill(); return; }
  let value;
  try { value = JSON.parse(line); } catch { return; }
  const entry = pending.get(value.id);
  if (!entry) return;
  pending.delete(value.id);
  clearTimeout(entry.timer);
  if (value.error) entry.reject(new Error(`宿主请求失败，代码 ${value.error.code}。`));
  else entry.resolve(value.result);
});
function request(method, params) {
  if (!allowed.has(method)) throw new Error('禁止该方法。');
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('独立宿主检查超时。')); }, 60000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify({ id, method, params })}\n`, error => {
      if (error) finish();
    });
  });
}
try {
  await request('initialize', { clientInfo: { name: 'issue_hub_installed_check', version: '1.0.0' }, capabilities: { experimentalApi: true } });
  child.stdin.write(`${JSON.stringify({ method: 'initialized' })}\n`);
  const inventory = await request('mcpServerStatus/list', { limit: 100 });
  const matches = (inventory.data || []).filter(server => server.pluginId === 'issue-hub@yg' || /issue[-_]hub/i.test(server.name));
  if (matches.length !== 1) throw new Error(`Issue Hub 服务数量不符：${matches.length}。`);
  const server = matches[0];
  const expectedVersion = JSON.parse(await readFile(fileURLToPath(new URL('../../../../plugins/issue-hub/plugin.json', import.meta.url)), 'utf8')).version;
  if (!/^\d+\.\d+\.\d+$/.test(expectedVersion) || server.serverInfo?.version !== expectedVersion) throw new Error('安装后服务版本与当前清单不一致。');
  const tools = Object.values(server.tools || {});
  const repositories = tools.filter(tool => tool.name.startsWith('issue-proof-open-'));
  const globalEntries = tools.filter(tool => tool._meta?.['openai/ui']?.entrypoints?.some(entry => entry.type === 'global'));
  if (globalEntries.length !== 1 || globalEntries[0].name !== 'issue-hub-open') throw new Error('Issue Hub 必须只有一个正式主入口。');
  if (repositories.length !== 0) throw new Error('正式包不应暴露P0仓库工具。');
  const iconAsset = await readFile(fileURLToPath(new URL('../../../../plugins/issue-hub/assets/icon.svg', import.meta.url)), 'utf8');
  const serverIcons = server.serverInfo?.icons;
  if (!Array.isArray(serverIcons) || serverIcons.length !== 2 || serverIcons.some(icon => !icon.src?.startsWith('data:image/svg+xml;base64,') || Buffer.from(icon.src.slice(icon.src.indexOf(',') + 1), 'base64').toString('utf8') !== iconAsset)) throw new Error('安装后服务图标缺失或与新图标不一致。');
  for (const name of ['issue-hub-mutate', 'issue-hub-task']) if (tools.find(tool => tool.name === name)?._meta?.ui?.visibility?.join() !== 'app') throw new Error('写入和会话必须仅页面可见。');
  const resource = await request('mcpServer/resource/read', { server: server.name, uri: 'ui://issue-hub/app.html' });
  const content = resource.contents?.find(entry => entry.uri === 'ui://issue-hub/app.html');
  if (!content?.text || !/mcp-app/.test(content.mimeType || '')) throw new Error('安装后 UI 资源不可读。');
  const result = {
    checkedAt: new Date().toISOString(), source: 'installed-plugin-app-server',
    pluginId: 'issue-hub@yg', version: server.serverInfo?.version || null,
    toolCount: tools.length, diagnosticRepositoryTools: repositories.length, globalEntries: globalEntries.length,
    serverIconVariants: serverIcons.length, entrypointIconVariants: globalEntries[0].icons?.length || 0, iconMatchesAsset: true,
    uiResourceReadable: true, uiBytes: Buffer.byteLength(content.text),
    desktopRenderingVerified: false, nativeFlyoutVerified: false, chatCreated: false, privateContentPrinted: false,
  };
  await writeFile(fileURLToPath(new URL(`./installed-product-${expectedVersion}.json`, import.meta.url)), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
} finally {
  const exited = once(child, 'exit').catch(() => {});
  lines.close();
  child.stdin.end();
  await Promise.race([exited, delay(1500)]);
  if (child.exitCode === null) child.kill();
  finish();
}
