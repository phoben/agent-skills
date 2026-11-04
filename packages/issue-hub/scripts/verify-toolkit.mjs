import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// 包外同时核对一个YG目录中的两服务；不打开聊天，不发GitHub写入，不读取Tokens统计。
const source = resolve(dirname(fileURLToPath(import.meta.url)), '../../../plugins/yg-toolkit');
const temporary = await mkdtemp(join(tmpdir(), 'yg-toolkit-stdio-'));
const clients = [];
try {
  const plugin = join(temporary, 'plugin'); await cp(source, plugin, { recursive: true });
  const manifest = JSON.parse(await readFile(join(plugin, 'plugin.json'), 'utf8'));
  const compatibility = JSON.parse(await readFile(join(plugin, '.codex-plugin/plugin.json'), 'utf8'));
  const mcp = JSON.parse(await readFile(join(plugin, 'mcp.json'), 'utf8'));
  assert.equal(manifest.name, 'yg-toolkit'); assert.equal(manifest.version, compatibility.version);
  assert.deepEqual(Object.keys(mcp.mcpServers).sort(), ['issue-hub', 'yg-token-usage']);
  await accessSkills(plugin, compatibility.skills);
  for (const name of ['THIRD-PARTY-LICENSES.txt', 'issue-hub-THIRD-PARTY-LICENSES.txt']) assert.ok((await readFile(join(plugin, 'dist', name))).length > 0);
  const ghDirectory = join(temporary, 'no-gh-program'); await mkdir(ghDirectory);
  const snapshots = [];
  for (const definition of [
    { key: 'yg-token-usage', file: 'token-usage.cjs', entry: 'token_usage_open', uri: 'ui://yg-toolkit/token-usage.html', tools: 3 },
    { key: 'issue-hub', file: 'issue-hub.cjs', entry: 'issue-hub-open', uri: 'ui://issue-hub/app-v2.html', tools: 9 },
  ]) {
    assert.deepEqual(mcp.mcpServers[definition.key].args, [`${'${PLUGIN_ROOT}'}/dist/${definition.file}`]);
    const env = { ...process.env, ISSUE_HUB_DATA_DIR: join(temporary, 'issue-state') };
    if (definition.key === 'issue-hub') {
      // gh可能从系统凭据库取得登录；仅移除Issue子进程的程序查找路径来确定性验证依赖失败。
      for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
      env.PATH = ghDirectory;
    }
    const transport = new StdioClientTransport({ command: process.execPath, args: [join(plugin, 'dist', definition.file)], cwd: temporary, stderr: 'pipe', env });
    transport.stderr?.on('data', () => {});
    const client = new Client({ name: 'yg-toolkit-package-check', version: '1' }); clients.push(client);
    await client.connect(transport, { timeout: 120000 });
    assert.equal(client.getServerVersion()?.version, manifest.version);
    const { tools } = await client.listTools(); assert.equal(tools.length, definition.tools);
    const global = tools.filter(tool => tool._meta?.['openai/ui']?.entrypoints?.some(entry => entry.type === 'global'));
    assert.deepEqual(global.map(tool => tool.name), [definition.entry]);
    const resource = await client.readResource({ uri: definition.uri });
    assert.match(resource.contents[0].mimeType, /mcp-app/); assert.ok(resource.contents[0].text.length > 1000);
    assert.ok(!resource.contents[0].text.includes('fixture.json'));
    if (definition.key === 'issue-hub') {
      assert.equal(global[0]._meta.ui.resourceUri, definition.uri);
      assert.deepEqual(resource.contents[0]._meta.ui.csp, { connectDomains: [], resourceDomains: ['data:'], frameDomains: [] });
      const compatibilityResource = await client.readResource({ uri: 'ui://issue-hub/app.html' });
      assert.equal(compatibilityResource.contents[0].text, resource.contents[0].text);
      assert.deepEqual(compatibilityResource.contents[0]._meta, resource.contents[0]._meta);
    }
    snapshots.push({ service: definition.key, tools: tools.length, globalEntries: global.length, uri: definition.uri });
  }
  const unavailableIssue = await clients[1].callTool({ name: 'issue-hub-open', arguments: {} }, undefined, { timeout: 120000 });
  assert.equal(unavailableIssue.isError, true, '缺少gh的Issue模块应说明不可用');
  assert.equal(unavailableIssue.structuredContent?.error?.code, 'GH_UNAVAILABLE');
  const tokensOpen = await clients[0].callTool({ name: 'token_usage_open', arguments: {} });
  assert.ok(!tokensOpen.isError, 'Issue模块依赖缺失不能阻止Tokens页面');
  const stillTokens = await clients[0].listTools(); assert.equal(stillTokens.tools.length, 3);
  process.stdout.write(`${JSON.stringify({ packageOutsideWorkspace: true, plugin: manifest.name, version: manifest.version, services: snapshots, totalTools: 12, totalGlobalEntries: 2, issueDependencyFailureIsolated: true, skillsAvailable: true, remoteWrites: false, chatOpened: false, desktopVerified: false })}\n`);
} finally {
  for (const client of clients) await client.close();
  assert.ok(resolve(temporary).startsWith(`${resolve(tmpdir())}${sep}yg-toolkit-stdio-`));
  await rm(temporary, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
}

async function accessSkills(plugin, skills) {
  assert.equal(skills, './skills/');
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(join(plugin, 'skills'), { withFileTypes: true });
  assert.ok(entries.some(entry => entry.isDirectory()), '统一YG包必须保留既有技能');
}
