import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createUsageServer, UI_URI } from '../src/server.mjs';

test('全部Tokens工具仅页面可见，全局入口、资源及统计查询继续可用', async t => {
  const calls = [];
  const service = {
    async dashboard(args) { calls.push({ method: 'dashboard', args }); return { account: { id: 'fixture' }, local: { status: 'ok' } }; },
    async sessions(args) { calls.push({ method: 'sessions', args }); return { rows: [{ id: 'fixture-session', totalTokens: 12 }], totalCount: 1 }; },
    close() {},
  };
  const server = createUsageServer({ html: '<h1>Tokens</h1>', service, version: '1.0.0' });
  const client = new Client({ name: 'tokens-page-tools-test', version: '1' });
  const [left, right] = InMemoryTransport.createLinkedPair(); await server.connect(left); await client.connect(right);
  t.after(async () => { await client.close(); await server.close(); });
  const { tools } = await client.listTools();
  assert.equal(tools.length, 3);
  for (const tool of tools) { assert.deepEqual(tool._meta.ui.visibility, ['app']); assert.equal(tool._meta.ui.resourceUri, UI_URI); }
  assert.deepEqual(tools.filter(tool => !tool._meta?.ui?.visibility || tool._meta.ui.visibility.includes('model')).map(tool => tool.name), []);
  assert.deepEqual(tools.filter(tool => tool._meta?.['openai/ui']?.entrypoints?.some(entry => entry.type === 'global')).map(tool => tool.name), ['token_usage_open']);
  assert.equal((await client.readResource({ uri: UI_URI })).contents[0].text, '<h1>Tokens</h1>');
  assert.ok(!(await client.callTool({ name: 'token_usage_open', arguments: {} })).isError);
  const range = { startDate: '2026-11-01', endDate: '2026-11-05', timeZone: 'Asia/Shanghai' };
  const dashboard = await client.callTool({ name: 'token_usage_dashboard', arguments: range });
  assert.equal(dashboard.structuredContent.account.id, 'fixture'); assert.equal(calls.at(-1).method, 'dashboard');
  const sessions = await client.callTool({ name: 'token_usage_sessions', arguments: { ...range, projectId: 'fixture-project' } });
  assert.equal(sessions.structuredContent.rows[0].totalTokens, 12); assert.equal(calls.at(-1).method, 'sessions');
  assert.equal(calls.at(-1).args.projectId, 'fixture-project');
});
