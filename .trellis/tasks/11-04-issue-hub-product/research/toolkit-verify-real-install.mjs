import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { findCodexCommand } from '../../../../packages/token-usage/src/codex-bridge.mjs';

// 只核对真实安装缓存、服务发现和静态资源，不打开页面或操作业务。
const bundleAt = process.argv.indexOf('--bundle');
const root = bundleAt >= 0 ? process.argv[bundleAt + 1] : 'E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/artifacts/toolkit-final/install-1793809504131';
const manifest = JSON.parse(await readFile(join(root, 'package-manifest.json'), 'utf8'));
const cache = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'plugins/cache/yg/yg-toolkit', manifest.version);
const report = { version: manifest.version, realProfile: true, remoteWrites: false, chatOpened: false, failure: null };
const target = await findCodexCommand(), child = spawn(target.command, [...target.args, 'app-server', '--stdio'], { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
child.stderr.on('data', () => {}); child.stdin.on('error', () => {});
const lines = createInterface({ input: child.stdout }), pending = new Map(); let serial = 0;
lines.on('line', line => { let value; try { value = JSON.parse(line); } catch { return; } const item = pending.get(value.id); if (!item) return; pending.delete(value.id); clearTimeout(item.timer); value.error ? item.reject(new Error('宿主安装核验未完成')) : item.resolve(value.result); });
function rpc(method, params) { assert.ok(['initialize', 'mcpServerStatus/list', 'mcpServer/resource/read'].includes(method)); return new Promise((resolve, reject) => { const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(new Error('安装核验超时')); }, 60000); pending.set(id, { resolve, reject, timer }); child.stdin.write(JSON.stringify({ id, method, params }) + '\n'); }); }
try {
  const matches = await Promise.all(manifest.files.map(async entry => createHash('sha256').update(await readFile(join(cache, entry.path.slice('plugins/yg-toolkit/'.length)))).digest('hex') === entry.sha256));
  assert.ok(matches.every(Boolean)); report.cacheFiles = matches.length; report.cacheMatches = true;
  await rpc('initialize', { clientInfo: { name: 'yg_real_install_check', version: '1' }, capabilities: { experimentalApi: true } }); child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  const status = await rpc('mcpServerStatus/list', { limit: 100 }); const services = status.data.filter(service => service.pluginId === 'yg-toolkit@yg');
  assert.equal(services.length, 2); report.services = [];
  for (const service of services) {
    const tools = Object.values(service.tools || {}), issue = tools.some(tool => tool.name === 'issue-hub-open');
    const global = tools.filter(tool => tool._meta?.['openai/ui']?.entrypoints?.some(entry => entry.type === 'global'));
    const imagePreview = process.argv.includes('--image-preview');
    assert.equal(service.serverInfo?.version, manifest.version); assert.ok(!service.toolsError); assert.equal(global.length, 1); assert.equal(tools.length, issue ? (imagePreview ? 9 : 8) : 3);
    const uri = issue ? (imagePreview ? 'ui://issue-hub/app-v2.html' : 'ui://issue-hub/app.html') : 'ui://yg-toolkit/token-usage.html'; const resource = await rpc('mcpServer/resource/read', { server: service.name, uri });
    assert.ok(resource.contents?.some(value => value.uri === uri && typeof value.text === 'string' && value.text.length > 1000));
    if (issue && imagePreview) { assert.deepEqual(resource.contents[0]._meta?.ui?.csp?.resourceDomains, ['data:']); const imageTool=tools.find(tool=>tool.name==='issue-hub-image'); assert.deepEqual(imageTool._meta?.ui?.visibility,['app']); }
    if(process.argv.includes('--app-only')) { assert.ok(tools.every(tool=>JSON.stringify(tool._meta?.ui?.visibility)===JSON.stringify(['app']))); }
    const modelVisibleTools=tools.filter(tool=>!tool._meta?.ui?.visibility||tool._meta.ui.visibility.includes('model')).length;
    report.services.push({ module: issue ? 'issue-hub' : 'tokens', pluginId: service.pluginId, version: service.serverInfo.version, tools: tools.length, global: global.length, resourceReadable: true, ...(process.argv.includes('--app-only')?{modelVisibleTools}: {}) });
  }
  report.legacyActiveServices = status.data.filter(service => service.pluginId === 'issue-hub@yg' || service.pluginId === 'issue-hub@issue-hub-review').length;
  assert.equal(report.legacyActiveServices, 0); report.passed = true;
} catch (error) { report.failure = error.message; report.passed = false; process.exitCode = 1; }
finally { for (const item of pending.values()) clearTimeout(item.timer); pending.clear(); lines.close(); child.stdin.end(); await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 1500))]); if (child.exitCode === null) child.kill(); await writeFile(new URL(process.argv.includes('--task-return') ? './task-return-real-install.json' : process.argv.includes('--html-comments') ? './html-comments-real-install.json' : process.argv.includes('--app-only') ? './app-only-tools-real-install.json' : process.argv.includes('--discovery-policy') ? './discovery-policy-real-install.json' : process.argv.includes('--account-menu') ? './account-menu-real-install.json' : process.argv.includes('--image-preview') ? './image-preview-real-install.json' : process.argv.includes('--issue-recovery') ? './issue-recovery-real-install.json' : './toolkit-real-install.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); }
