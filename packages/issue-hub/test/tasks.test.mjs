import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTaskProof, createRequestStore, draftUri } from '../src/tasks.mjs';
import { temporary, repositoryKey, workspaceKey, firstThread, secondThread } from './helpers.mjs';

async function fixture(t) {
  const cwd = await temporary(t); const state = { identity: 'account-a', threads: [], pages: new Map(), opened: [], calls: [], flipOnResolve: false };
  const workspace = { key: workspaceKey, projectId: 'project-a', cwd };
  const catalog = { resolveWorkspace: async () => { if (state.flipOnResolve) state.identity = 'other-account'; return { repository: { fullName: 'fixture/repository' }, workspace }; } };
  const bridge = { identity: async () => state.identity, request: async (method, params) => { state.calls.push([method, params]); if (method === 'thread/list') return { data: state.threads, nextCursor: state.nextCursor || null }; if (method === 'thread/items/list') return state.pages.get(params.threadId) || { data: [] }; if (method === 'thread/read') return { thread: state.threads.find(thread => thread.id === params.threadId) }; throw new Error('非预期方法'); } };
  const tasks = createTaskProof({ bridge, catalog, store: createRequestStore(join(cwd, 'requests.json')), openUri: async uri => state.opened.push(uri) });
  const prepared = await tasks.prepare({ repositoryKey, workspaceKey, requestId: randomUUID() });
  const reload = () => createTaskProof({ bridge, catalog, store: createRequestStore(join(cwd, 'requests.json')), openUri: async uri => state.opened.push(uri) });
  return { cwd, state, tasks, prepared, reload, thread: id => ({ id, cwd, projectId: 'project-a', createdAt: Math.floor(Date.now() / 1000) }) };
}

test('草稿编码中文与换行，连续误点不重复打开', async t => {
  const f = await fixture(t);
  const same = await f.tasks.prepare({ repositoryKey, workspaceKey, requestId: f.prepared.requestId }); assert.deepEqual(same, f.prepared);
  await f.tasks.open({ requestId: f.prepared.requestId }); await f.tasks.open({ requestId: f.prepared.requestId });
  assert.equal(f.state.opened.length, 1); const uri = new URL(f.state.opened[0]); assert.equal(uri.hostname, 'new'); assert.equal(uri.searchParams.get('path'), f.cwd); assert.equal(uri.searchParams.get('prompt'), f.prepared.prompt);
  assert.equal(uri.searchParams.get('send'), null);
  assert.throws(() => draftUri(f.cwd, '长'.repeat(5000)), { code: 'LINK_TOO_LONG' });
});

test('先发送才能按完整首条引用关联，并用已知标识返回', async t => {
  const f = await fixture(t);
  await assert.rejects(f.tasks.check({ requestId: f.prepared.requestId }), { code: 'REQUEST_NOT_OPENED' });
  await f.tasks.open({ requestId: f.prepared.requestId });
  f.state.threads = [f.thread(firstThread)]; f.state.pages.set(firstThread, { data: [{ type: 'userMessage', content: [{ type: 'text', text: f.prepared.prompt }] }] });
  const result = await f.tasks.check({ requestId: f.prepared.requestId }); assert.equal(result.status, 'linked'); assert.equal(result.threadId, firstThread);
  await f.tasks.open({ requestId: f.prepared.requestId }); assert.equal(f.state.opened[1], `codex://threads/${firstThread}`);
  assert.equal(f.state.calls.find(([method]) => method === 'thread/list')[1].cwd, f.cwd);
});

test('相同引用出现在两个聊天时不猜最近一个', async t => {
  const f = await fixture(t); await f.tasks.open({ requestId: f.prepared.requestId });
  f.state.threads = [f.thread(firstThread), f.thread(secondThread)];
  for (const thread of f.state.threads) f.state.pages.set(thread.id, { data: [{ type: 'userMessage', content: [{ type: 'text', text: f.prepared.prompt }] }] });
  const result = await f.tasks.check({ requestId: f.prepared.requestId }); assert.equal(result.status, 'ambiguous'); assert.equal(result.threadId, null);
});

test('不完整候选页、截断预览和无关工作区均不能自动认领', async t => {
  const f = await fixture(t); await f.tasks.open({ requestId: f.prepared.requestId });
  f.state.threads = [f.thread(firstThread), { ...f.thread(secondThread), cwd: join(f.cwd, 'other'), preview: f.prepared.prompt }];
  f.state.pages.set(firstThread, { data: [{ type: 'userMessage', content: [{ type: 'text', text: f.prepared.prompt }] }] });
  f.state.nextCursor = 'more'; const incomplete = await f.tasks.check({ requestId: f.prepared.requestId }); assert.equal(incomplete.status, 'waiting-for-send'); assert.equal(incomplete.coverage, 'partial');
  assert.equal(f.state.calls.filter(([method]) => method === 'thread/items/list').length, 1);
  f.state.nextCursor = null; f.state.pages.set(firstThread, { data: [{ type: 'userMessage', content: [{ type: 'text', text: '无任务引用' }] }] });
  assert.equal((await f.tasks.check({ requestId: f.prepared.requestId })).threadId, null);
});

test('目录复核期间身份切换会在系统打开前阻止请求', async t => {
  const f = await fixture(t); f.state.flipOnResolve = true;
  await assert.rejects(f.tasks.open({ requestId: f.prepared.requestId }), { code: 'IDENTITY_CHANGED' }); assert.equal(f.state.opened.length, 0);
});

test('未知请求不读取聊天，本机损坏数据不被静默覆盖', async t => {
  const f = await fixture(t);
  await assert.rejects(f.tasks.check({ requestId: randomUUID() }), { code: 'REQUEST_UNKNOWN' }); assert.equal(f.state.calls.length, 0);
  const path = join(f.cwd, 'broken.json'); await writeFile(path, 'broken');
  await assert.rejects(createRequestStore(path).transaction(() => {}), { code: 'STATE_INVALID' }); assert.equal(await readFile(path, 'utf8'), 'broken');
});

test('重建服务后按身份和工作区恢复待关联请求，再确认并恢复真实聊天', async t => {
  const f = await fixture(t); await f.tasks.open({ requestId: f.prepared.requestId });
  const restored = await f.reload().latest({ repositoryKey, workspaceKey });
  assert.equal(restored.requestId, f.prepared.requestId); assert.equal(restored.status, 'requested'); assert.equal(f.state.calls.length, 0);
  assert.equal(await f.reload().latest({ repositoryKey: 'c'.repeat(20), workspaceKey }), null);
  assert.equal(await f.reload().latest({ repositoryKey, workspaceKey: 'd'.repeat(20) }), null);
  f.state.identity = 'another-account'; assert.equal(await f.reload().latest({ repositoryKey, workspaceKey }), null);
  f.state.identity = 'account-a'; f.state.threads = [f.thread(firstThread)];
  f.state.pages.set(firstThread, { data: [{ type: 'userMessage', content: [{ type: 'text', text: f.prepared.prompt }] }] });
  assert.equal((await f.reload().check({ requestId: restored.requestId })).status, 'linked');
  const linked = await f.reload().latest({ repositoryKey, workspaceKey }); assert.equal(linked.threadId, firstThread);
  await f.reload().open({ requestId: linked.requestId }); assert.equal(f.state.opened.at(-1), `codex://threads/${firstThread}`);
  f.state.flipOnResolve = true;
  await assert.rejects(f.reload().check({ requestId: linked.requestId }), { code: 'IDENTITY_CHANGED' });
});
