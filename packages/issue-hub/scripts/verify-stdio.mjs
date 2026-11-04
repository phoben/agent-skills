import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '../../../plugins/yg-toolkit');
const expectedVersion = JSON.parse(await readFile(join(source, 'plugin.json'), 'utf8')).version;
const temporary = await mkdtemp(join(tmpdir(), 'issue-hub-stdio-'));
let client;
try {
  const plugin = join(temporary, 'plugin'); await cp(source, plugin, { recursive: true });
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(plugin, 'dist/issue-hub.cjs')], cwd: temporary, stderr: 'pipe', env: { ...process.env, ISSUE_HUB_DATA_DIR: join(temporary, 'state') } });
  transport.stderr?.on('data', () => {});
  client = new Client({ name: 'issue-hub-package-check', version: '1.0.0' });
  await client.connect(transport, { timeout: 120000 });
  assert.equal(client.getServerVersion()?.version, expectedVersion);
  const { tools } = await client.listTools();
  const primary = tools.filter(tool => tool._meta?.['openai/ui']?.entrypoints?.some(entry => entry.type === 'global'));
  assert.deepEqual(primary.map(tool => tool.name), ['issue-hub-open']);
  assert.equal(primary[0].title, 'Issue Hub');
  const icons = client.getServerVersion()?.icons;
  const iconAsset = await readFile(join(plugin, 'assets/issue-hub.svg'), 'utf8');
  assert.equal(icons?.length, 2, '服务必须声明实际插件图标，不能回退默认图标。');
  assert.deepEqual(icons.map(icon => icon.theme).sort(), ['dark', 'light']);
  for (const icon of icons) {
    assert.equal(icon.mimeType, 'image/svg+xml'); assert.ok(icon.src.startsWith('data:image/svg+xml;base64,'));
    assert.equal(Buffer.from(icon.src.slice(icon.src.indexOf(',') + 1), 'base64').toString('utf8'), iconAsset);
  }
  // 当前SDK可能省略Tool.icons；原生入口仍可使用公开的服务图标。
  if (primary[0].icons) assert.deepEqual(primary[0].icons, icons, '已提供的主入口图标必须与服务一致。');
  for (const name of ['issue-hub-query', 'issue-hub-mutate', 'issue-hub-task']) {
    const tool = tools.find(entry => entry.name === name); assert.ok(tool); assert.deepEqual(tool._meta.ui.visibility, ['app']); assert.equal(tool._meta['openai/ui'], undefined);
  }
  assert.ok(!tools.some(tool => tool.name.startsWith('issue-proof-')));
  const resource = await client.readResource({ uri: 'ui://issue-hub/app.html' });
  assert.match(resource.contents[0].mimeType, /mcp-app/);
  assert.ok(resource.contents[0].text.length > 1000);
  assert.ok(!resource.contents[0].text.includes('fixture.json'));
  const invalid = await client.callTool({ name: 'issue-hub-query', arguments: { action: 'save-issue', payload: {} } });
  assert.equal(invalid.isError, true);
  const bootstrap = await client.callTool({ name: 'issue-hub-open', arguments: {} }, undefined, { timeout: 120000 });
  // 授权缺失时也可发现页面，身份错误不能冒充空仓库。
  assert.ok(bootstrap.isError ? bootstrap.structuredContent?.error?.code : bootstrap.structuredContent?.schemaVersion === 1);
  await assert.rejects(client.readResource({ uri: 'ui://issue-hub/missing' }));
  process.stdout.write(`${JSON.stringify({ packageOutsideWorkspace: true, version: expectedVersion, primaryEntrypoints: primary.length, iconVariants: icons.length, iconMatchesAsset: true, appOnlyWrites: true, uiResource: true, invalidArgumentsRejected: true, bootstrapAvailable: !bootstrap.isError, bootstrapError: bootstrap.isError ? bootstrap.structuredContent.error.code : null, remoteWrites: false, desktopVerified: false })}\n`);
} finally {
  await client?.close();
  assert.ok(resolve(temporary).startsWith(`${resolve(tmpdir())}${sep}issue-hub-stdio-`));
  await rm(temporary, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
}
