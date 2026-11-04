import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { createProofServer, UI_URI } from '../src/server.mjs';

test('只有一个Issue Hub主入口，仓库诊断工具和刷新均不增加global', async t => {
  const repo = (key, fullName) => ({ key: key.repeat(20), fullName, workspaces: [] });
  let repositories = [repo('a', 'fixture/first'), repo('b', 'fixture/second')];
  const catalog = { snapshot: () => ({ schemaVersion: 1, status: 'complete', projects: 3, roots: 3, repositories, warnings: [], sampledAt: '2026-11-03' }), refresh: async () => { repositories = [repo('b', 'fixture/second'), repo('c', 'fixture/third')]; } };
  const tasks = { prepare: async () => ({}), latest: async () => null, open: async () => ({}), check: async () => ({}) };
  const server = createProofServer({ html: '<h1>宿主验证</h1>', catalog, tasks }); const client = new Client({ name: 'test', version: '1' });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair(); await server.connect(serverTransport); await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });
  const list = await client.listTools(); const entries = list.tools.filter(tool => tool.name.startsWith('issue-proof-open-')); assert.equal(entries.length, 2);
  const globals = tools => tools.filter(tool => tool._meta?.['openai/ui']?.entrypoints?.some(entry => entry.type === 'global'));
  assert.deepEqual(globals(list.tools).map(tool => tool.name), ['issue-proof-status']);
  assert.equal(globals(list.tools)[0].title, 'Issue Hub');
  for (const entry of entries) { assert.equal(entry._meta['openai/ui'], undefined); assert.deepEqual(entry._meta.ui.visibility, ['app']); const opened = await client.callTool({ name: entry.name, arguments: {} }); assert.equal(opened.structuredContent.repository.fullName, entry.title); }
  const status = await client.callTool({ name: 'issue-proof-status', arguments: {} });
  assert.equal(status.structuredContent.catalog.primaryEntrypoints, 1);
  assert.equal(status.structuredContent.catalog.diagnosticRepositoryTools, 2);
  assert.equal(status.structuredContent.catalog.nativeFlyoutStatus, 'unverified');
  assert.equal(status.structuredContent.catalog.sidebarEntries, undefined);
  const recovery = list.tools.find(tool => tool.name === 'issue-proof-task-latest');
  assert.deepEqual(recovery._meta.ui.visibility, ['app']); assert.equal(recovery.annotations.readOnlyHint, true);
  const recovered = await client.callTool({ name: recovery.name, arguments: { repositoryKey: 'a'.repeat(20), workspaceKey: 'b'.repeat(20) } });
  assert.equal(recovered.structuredContent.request, null);
  assert.equal((await client.readResource({ uri: UI_URI })).contents[0].text, '<h1>宿主验证</h1>');
  let notified; const notification = new Promise(resolve => { notified = resolve; }); client.setNotificationHandler(ToolListChangedNotificationSchema, () => notified());
  await client.callTool({ name: 'issue-proof-refresh', arguments: {} }); await notification;
  const after = await client.listTools(); assert.ok(after.tools.some(tool => tool.title === 'fixture/third')); assert.ok(!after.tools.some(tool => tool.title === 'fixture/first'));
  assert.deepEqual(globals(after.tools).map(tool => tool.name), ['issue-proof-status']);
  const invalid = await client.callTool({ name: 'issue-proof-task-open', arguments: { requestId: 'bad', cwd: 'arbitrary' } }); assert.equal(invalid.isError, true);
});

test('空目录和不同诊断工具上限均保持一个主入口', async t => {
  for (const maxEntries of [1, 3]) {
    let repositories = [];
    const catalog = { snapshot: () => ({ status: 'complete', projects: 4, roots: 4, repositories, warnings: [] }), refresh: async () => { repositories = ['a', 'b', 'c', 'd'].map(value => ({ key: value.repeat(20), fullName: `fixture/${value}`, workspaces: [] })); } };
    const tasks = { prepare: async () => ({}), latest: async () => null, open: async () => ({}), check: async () => ({}) };
    const server = createProofServer({ html: '验证', catalog, tasks, maxEntries }); const client = new Client({ name: 'test', version: '1' });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair(); await server.connect(serverTransport); await client.connect(clientTransport);
    t.after(async () => { await client.close(); await server.close(); });
    const globals = tools => tools.filter(tool => tool._meta?.['openai/ui']?.entrypoints?.some(entry => entry.type === 'global'));
    const before = await client.listTools(); assert.equal(globals(before.tools).length, 1);
    await client.callTool({ name: 'issue-proof-refresh', arguments: {} });
    const after = await client.listTools(); assert.equal(globals(after.tools).length, 1); assert.equal(after.tools.filter(tool => tool.name.startsWith('issue-proof-open-')).length, maxEntries);
    const status = await client.callTool({ name: 'issue-proof-status', arguments: {} });
    assert.equal(status.structuredContent.catalog.primaryEntrypoints, 1); assert.equal(status.structuredContent.catalog.diagnosticToolLimit, maxEntries);
  }
});
