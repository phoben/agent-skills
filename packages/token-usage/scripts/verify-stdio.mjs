import assert from 'node:assert/strict';
import { mkdtemp, copyFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const expectedVersion = JSON.parse(await readFile(join(repo, 'plugins/yg-toolkit/plugin.json'), 'utf8')).version;
const directory = await mkdtemp(join(tmpdir(), 'yg-usage-package-'));
let client;
try {
  for (const name of ['token-usage.cjs', 'token-usage.html']) await copyFile(join(repo, 'plugins/yg-toolkit/dist', name), join(directory, name));
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(directory, 'token-usage.cjs')], cwd: directory, stderr: 'pipe' });
  transport.stderr?.on('data', () => {});
  client = new Client({ name: 'yg-usage-protocol-check', version: '1.0.0' });
  await client.connect(transport);
  assert.equal(client.getServerVersion()?.version, expectedVersion);
  const listed = await client.listTools();
  assert.equal(listed.tools.length, 3);
  const entry = listed.tools.find(tool => tool.name === 'token_usage_open');
  const icons=client.getServerVersion()?.icons;
  assert.equal(icons?.length, 2);
  assert.ok(icons.every(icon => icon.src.startsWith('data:image/svg+xml;base64,')));
  assert.equal(entry._meta['openai/ui'].entrypoints[0].type, 'global');
  const uri = entry._meta.ui.resourceUri;
  const resource = await client.readResource({ uri });
  assert.match(resource.contents[0].mimeType, /mcp-app/);
  assert.match(resource.contents[0].text, /项目每日用量/);
  assert.ok(!resource.contents[0].text.includes('28.64M'));
  const opened = await client.callTool({ name: 'token_usage_open', arguments: {} });
  assert.ok(!opened.isError);
  const invalid = await client.callTool({ name: 'token_usage_dashboard', arguments: { startDate: '2026-11-03', endDate: '2026-11-01', timeZone: 'UTC' } });
  assert.equal(invalid.isError, true);
  await assert.rejects(client.readResource({ uri: 'ui://yg-toolkit/not-found' }));
  process.stdout.write('独立包stdio、全局入口、页面资源与失败路径验证通过。\n');
} finally {
  await client?.close();
  assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}yg-usage-package-`));
  await rm(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
}
