import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createIssueServer, APP_URI } from '../src/server.mjs';
import { ProofError } from '../src/errors.mjs';
import { readFile } from 'node:fs/promises';
import { createIssueHubIcons } from '../src/icons.mjs';

test('正式服务只有一个主入口，写入与会话仅页面可见，模型只有固定读取入口', async t => {
  const calls = [];
  const issues = { execute: async (action, args = {}) => {
    calls.push({ action, args });
    if (action === 'save-comment') throw new ProofError('PERMISSION_DENIED', '只能编辑本人评论。');
    return { schemaVersion: 1, identity: '42', ...(action === 'refresh' ? { offline: true, cached: true } : {}), data: ['bootstrap', 'refresh'].includes(action) ? { repositories: [{ key: 'a'.repeat(20), fullName: 'fixture/one', workspaces: [{ cwd: 'secret-path' }] }], catalog: { status: 'partial', warnings: ['SCAN_LIMIT'] } } : { issue: { number: args.number } } };
  } };
  const server = createIssueServer({ html: '<h1>Issue Hub</h1>', issues, tasks: { execute: async () => ({ data: { current: null } }) }, diagnostics: { diagnose: async () => ({ schemaVersion: 1, data: { status: 'ok', checks: [] } }) } });
  const client = new Client({ name: 'product-test', version: '1' });
  const [left, right] = InMemoryTransport.createLinkedPair(); await server.connect(left); await client.connect(right);
  t.after(async () => { await client.close(); await server.close(); });
  const { tools } = await client.listTools();
  assert.deepEqual(tools.filter(tool => tool._meta?.['openai/ui']?.entrypoints?.some(entry => entry.type === 'global')).map(tool => tool.name), ['issue-hub-open']);
  for (const name of ['issue-hub-open', 'issue-hub-query', 'issue-hub-mutate', 'issue-hub-task']) assert.deepEqual(tools.find(tool => tool.name === name)._meta.ui.visibility, ['app']);
  const diagnostic = tools.find(tool => tool.name === 'issue-hub-diagnostics');assert.deepEqual(diagnostic._meta.ui.visibility, ['app']);assert.equal(diagnostic.annotations.readOnlyHint, true);
  assert.equal((await client.callTool({ name: diagnostic.name, arguments: {} })).structuredContent.data.status, 'ok');
  assert.equal((await client.callTool({ name: diagnostic.name, arguments: { command: 'arbitrary' } })).isError, true);
  for (const name of ['issue-read', 'issue-comments', 'issue-repositories']) assert.equal(tools.find(tool => tool.name === name).annotations.readOnlyHint, true);
  assert.equal((await client.readResource({ uri: APP_URI })).contents[0].text, '<h1>Issue Hub</h1>');
  const directory = await client.callTool({ name: 'issue-repositories', arguments: {} });
  assert.ok(!directory.isError); assert.equal(directory.structuredContent.data.repositories.length, 1);
  assert.equal(directory.structuredContent.offline, true); assert.equal(directory.structuredContent.cached, true);
  assert.equal(calls.at(-1).action, 'refresh'); assert.ok(!JSON.stringify(directory).includes('secret-path'));
  assert.ok(tools.find(tool => tool.name === 'issue-hub-query').inputSchema.properties.action.enum.includes('read-summary'));
  assert.ok(tools.find(tool => tool.name === 'issue-hub-mutate').inputSchema.properties.action.enum.includes('view-state-save'));
  const opened = await client.callTool({ name: 'issue-hub-open', arguments: {} }); assert.equal(opened.structuredContent.identity, '42');
  const forbidden = await client.callTool({ name: 'issue-hub-query', arguments: { action: 'save-issue', payload: {} } }); assert.equal(forbidden.isError, true);
  const invalid = await client.callTool({ name: 'issue-read', arguments: { repositoryKey: 'a'.repeat(20), number: 0, path: 'arbitrary' } }); assert.equal(invalid.isError, true);
  const failure = await client.callTool({ name: 'issue-hub-mutate', arguments: { action: 'save-comment', payload: {} } }); assert.equal(failure.structuredContent.error.code, 'PERMISSION_DENIED');
  assert.equal(calls.filter(call => call.action === 'save-issue').length, 0);
});

test('真实插件SVG通过serverInfo提供亮暗品牌图标，global工具的可选图标声明保持同源', async t => {
  const svg = await readFile(new URL('../../../plugins/yg-toolkit/assets/issue-hub.svg', import.meta.url), 'utf8');
  const icons = createIssueHubIcons(svg);
  const server = createIssueServer({ html: '<h1>Issue Hub</h1>', icons, issues: { execute: async () => ({ schemaVersion: 1, identity: '42', data: {} }) }, tasks: { execute: async () => ({ data: {} }) } });
  const client = new Client({ name: 'product-icons-test', version: '1' });
  const [left, right] = InMemoryTransport.createLinkedPair(); await server.connect(left); await client.connect(right);
  t.after(async () => { await client.close(); await server.close(); });
  const { tools } = await client.listTools();
  const globalTools = tools.filter(tool => tool._meta?.['openai/ui']?.entrypoints?.some(entry => entry.type === 'global'));
  assert.equal(globalTools.length, 1); assert.equal(globalTools[0].name, 'issue-hub-open');
  const providedSets = [['serverInfo', client.getServerVersion()?.icons]];
  // 当前SDK未序列化可选Tool.icons；服务品牌必须可读，不为可选字段改写SDK处理器。
  if (globalTools[0].icons !== undefined) providedSets.push(['globalTool', globalTools[0].icons]);
  for (const [label, provided] of providedSets) {
    assert.equal(provided?.length, 2, `${label} 必须提供亮暗两项图标`); assert.deepEqual(provided.map(icon => icon.theme), ['light', 'dark']);
    for (const icon of provided) {
      assert.equal(icon.mimeType, 'image/svg+xml'); assert.deepEqual(icon.sizes, ['any']);
      const embedded = /^data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)$/.exec(icon.src);
      assert.ok(embedded, '协议图标必须携带可独立加载的SVG，而不是本机路径或默认图标。');
      assert.equal(Buffer.from(embedded[1], 'base64').toString('utf8'), svg, '协议图标内容必须与实际插件资产完全相同。');
    }
  }
});
