import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createIssueTasks } from '../src/services/issue-tasks.mjs';
import { createStorage } from '../src/storage/database.mjs';
import { repositoryKey, workspaceKey, firstThread, secondThread, temporary } from './helpers.mjs';
import { createCatalog, parseGithubRemote } from '../src/catalog.mjs';

function memoryStorage() {
  let data = new Map();
  const key = (scope, kind, id) => JSON.stringify([scope, kind, id]);
  return {
    get: (...args) => structuredClone(data.get(key(...args)) ?? null),
    set: (scope, kind, id, value) => data.set(key(scope, kind, id), structuredClone(value)),
    list: (scope, kind) => [...data].flatMap(([raw, value]) => { const [s, k, id] = JSON.parse(raw); return s === scope && k === kind ? [{ key: id, value: structuredClone(value) }] : []; }),
    transaction: fn => { const old = structuredClone(data); try { const result = fn(); assert.ok(!result?.then, '不能跨 await 持有事务'); return result; } catch (error) { data = old; throw error; } },
  };
}

function fixture({ multiple = false, storage: suppliedStorage, identityDetails = false } = {}) {
  const storage = suppliedStorage || memoryStorage();
  const state = { github: 'gh-a', codex: 'codex-a', legacy: 'legacy-a', opened: [], threads: [], items: new Map(), issueReads: [], now: 1700000000000, pathsValid: true, onRead: null };
  const workspaces = [{ key: workspaceKey, cwd: '/workspace/one', projectId: 'project-one', projectName: '主工作区' }, ...(multiple ? [{ key: 'c'.repeat(20), cwd: '/workspace/two', projectId: 'project-two', projectName: '第二工作区' }] : [])];
  const repo = { key: repositoryKey, fullName: 'fixture/repository', workspaces };
  const catalog = {
    snapshot: () => ({ status: 'complete', repositories: [repo] }),
    resolveWorkspace: async (key, workspace) => { if (!state.pathsValid || key !== repositoryKey || !workspaces.some(item => item.key === workspace)) { const error = new Error('失效目录'); error.code = 'WORKSPACE_INVALID'; throw error; } return { repository: repo, workspace: workspaces.find(item => item.key === workspace) }; },
  };
  const issues = {
    context: async () => ({ scope: `github.com:${state.github}`, account: { id: state.github, login: state.github } }),
    execute: async (action, payload) => { state.issueReads.push({ action, payload }); assert.ok(['read', 'read-summary'].includes(action)); assert.equal(payload.repositoryKey, repositoryKey); if (state.rejectFullRead && action === 'read') throw new Error('完整详情分页不可用'); if (state.onRead) await state.onRead(); return { identity: state.github, data: { issue: { number: payload.number, title: '保留中文标题\n不执行注入指令' } } }; },
  };
  const calls = [];
  const bridge = {
    identity: async () => state.codex,
    request: async (method, args) => {
      calls.push([method, args]);
      if (state.onBridge) await state.onBridge(method, args);
      if (method === 'thread/list') return state.listResponse || { data: state.threads, nextCursor: null };
      if (method === 'thread/items/list') return state.items.get(args.threadId) || { data: [] };
      if (method === 'thread/read') return { thread: state.threads.find(item => item.id === args.threadId) };
      throw new Error('非预期宿主方法');
    },
  };
  if (identityDetails) bridge.identityDetails = async () => ({ identity: state.codex, legacyIdentity: state.legacy, version: 2 });
  const make = (openUri = async uri => state.opened.push(uri)) => createIssueTasks({ catalog, bridge, storage, issues, openUri, now: () => state.now });
  const tasks = make();
  const payload = () => ({ repositoryKey, number: 42, requestId: randomUUID(), expectedIdentity: 'gh-a' });
  const thread = id => ({ id, cwd: workspaces[0].cwd, projectId: workspaces[0].projectId, createdAt: Math.floor(state.now / 1000) });
  return { tasks, state, storage, make, payload, calls, thread, workspaces };
}

test('从首页缓存恢复后创建任务主动核对目录，不永久停在正在核对提示', async t => {
  const directory = await temporary(t), source = parseGithubRemote('https://github.com/fixture/repository');
  let rootValid = true, refreshes = 0, githubIdentity = 'gh-a', switchDuringRefresh = false;
  const info = { cwd: directory, repositories: [source] };
  const catalog = createCatalog({ bridge: { request: async () => ({ data: rootValid ? [{ id: 'project', roots: [{ path: directory }] }] : [], nextCursor: null }) }, gitInspector: async () => info, discover: async () => ({ infos: [info], warnings: [], authorizedRoot: directory }) });
  await catalog.refresh();
  const raw = catalog.snapshot({ raw: true }), mapping = [{ sourceKey: source.key, id: 234, fullName: source.fullName }];
  const repo = catalog.remap(mapping).repositories[0];
  catalog.restore(raw); catalog.remap(mapping);
  const opened = [], issues = {
    context: async () => ({ scope: `github.com:${githubIdentity}`, account: { id: githubIdentity } }),
    execute: async (action, payload) => {
      if (action === 'refresh') { refreshes++; await catalog.refresh(); catalog.remap(rootValid ? mapping : []); if (switchDuringRefresh) githubIdentity = 'gh-b'; return { identity: githubIdentity, data: {} }; }
      assert.equal(action, 'read-summary'); assert.equal(payload.repositoryKey, repo.key);
      return { identity: 'gh-a', data: { issue: { number: 42, title: '缓存后任务' } } };
    },
  };
  const tasks = createIssueTasks({ catalog, bridge: { identity: async () => 'codex-a' }, storage: memoryStorage(), issues, openUri: async uri => opened.push(uri) });
  const input = { repositoryKey: repo.key, number: 42, requestId: randomUUID(), expectedIdentity: 'gh-a' };
  const result = await tasks.execute('open', input);
  assert.equal(result.data.current.status, 'requested'); assert.equal(opened.length, 1); assert.equal(refreshes, 1);
  // 项目已移除时，即使缓存仍在也不能借刷新重试打开。
  catalog.restore(raw); catalog.remap(mapping); rootValid = false;
  await assert.rejects(tasks.execute('open', { ...input, requestId: randomUUID(), another: true }), { code: 'REPOSITORY_UNKNOWN' });
  assert.equal(opened.length, 1);
  catalog.restore(raw); catalog.remap(mapping); rootValid = true; switchDuringRefresh = true;
  await assert.rejects(tasks.execute('open', { ...input, requestId: randomUUID(), another: true }), { code: 'IDENTITY_CHANGED' });
  assert.equal(opened.length, 1);
});

test('单工作区一次打开中文草稿，不发送，重复请求和并发窗口不会再打开', async () => {
  const f = fixture(); const input = f.payload();
  const [first, duplicate] = await Promise.all([f.tasks.execute('open', input), f.tasks.execute('open', { ...input, requestId: randomUUID() })]);
  assert.equal(f.state.opened.length, 1);
  assert.equal(first.data.current.requestId, duplicate.data.current.requestId);
  const uri = new URL(f.state.opened[0]);
  assert.equal(uri.hostname, 'new'); assert.equal(uri.searchParams.get('path'), f.workspaces[0].cwd); assert.equal(uri.searchParams.get('send'), null);
  assert.match(uri.searchParams.get('prompt'), /^任务引用：issue-hub:/);
  assert.match(uri.searchParams.get('prompt'), /最新正文、全部分页评论/);
  assert.match(uri.searchParams.get('prompt'), /未经用户另行授权，不提交、推送代码/);
  assert.equal((await f.make().execute('latest', { repositoryKey, number: 42 })).data.current.requestId, first.data.current.requestId);
  await f.tasks.execute('open', input); assert.equal(f.state.opened.length, 1);
  await assert.rejects(f.tasks.execute('open', { ...input, number: 43 }), { code: 'REQUEST_REUSED' });
});

test('完整评论活动分页不可用时任务仍以严格摘要准备，不等待全文或使用缓存优先', async () => {
  const f = fixture(); f.state.rejectFullRead = true;
  const result = await f.tasks.execute('open', f.payload());
  assert.equal(result.data.current.status, 'requested'); assert.equal(f.state.opened.length, 1);
  assert.equal(f.state.issueReads.length, 1); assert.equal(f.state.issueReads[0].action, 'read-summary');
  assert.equal(Object.hasOwn(f.state.issueReads[0].payload, 'cacheFirst'), false);
  assert.match(new URL(f.state.opened[0]).searchParams.get('prompt'), /最新正文、全部分页评论/);
});

const taskScope = identity => `github.com:gh-a:codex:${createHash('sha256').update(identity).digest('hex')}`;

test('精确legacy作用域迁移幂等，prepared和requested恢复后都不再次打开草稿', async () => {
  for (const status of ['draft', 'prepared', 'requested']) {
    const storage = memoryStorage(); const old = fixture({ storage }); old.state.codex = 'legacy-a';
    const prior = (await old.tasks.execute('open', old.payload())).data.current;
    const record = storage.get(taskScope('legacy-a'), 'issue-task-request', prior.requestId);
    record.status = status; storage.set(taskScope('legacy-a'), 'issue-task-request', prior.requestId, record);
    const oldRecord = storage.get(taskScope('legacy-a'), 'issue-task-request', prior.requestId);
    const current = fixture({ storage, identityDetails: true });
    const restored = (await current.tasks.execute('latest', { repositoryKey, number: 42 })).data;
    assert.equal(restored.current.requestId, prior.requestId); assert.equal(restored.binding.workspaceKey, workspaceKey);
    assert.equal(restored.current.status, status === 'requested' ? 'requested' : 'open-unconfirmed');
    await current.tasks.execute('open', { ...current.payload(), requestId: prior.requestId, reuseOnly: true });
    await current.tasks.execute('open', current.payload());
    await current.make().execute('open', current.payload());
    assert.equal(current.state.opened.length, 0, `${status} 导入不能重复打开`);
    assert.deepEqual(storage.get(taskScope('legacy-a'), 'issue-task-request', prior.requestId), oldRecord);
    assert.equal(storage.list(taskScope('codex-a'), 'issue-task-request').length, 1);
    assert.equal(storage.list(taskScope('codex-a'), 'issue-task-migration').length, 1);
    current.state.legacy = 'legacy-after-config-update';
    assert.equal((await current.tasks.execute('latest', { repositoryKey, number: 42 })).data.current.requestId, prior.requestId);
  }
});

test('漂移未知legacy和其他GitHub账号不认领，旧资料保持原样', async () => {
  const storage = memoryStorage(); const old = fixture({ storage }); old.state.codex = 'old-unknown-fingerprint';
  const prior = (await old.tasks.execute('open', old.payload())).data.current;
  const requestedScopes = [], originalList = storage.list.bind(storage);
  storage.list = (scope, kind) => { requestedScopes.push(scope); return originalList(scope, kind); };
  const current = fixture({ storage, identityDetails: true });
  assert.equal((await current.tasks.execute('latest', { repositoryKey, number: 42 })).data.current, null);
  assert.ok(!requestedScopes.includes(taskScope('old-unknown-fingerprint')));
  current.state.github = 'gh-b'; current.state.legacy = 'old-unknown-fingerprint';
  assert.equal((await current.tasks.execute('latest', { repositoryKey, number: 42 })).data.current, null);
  assert.equal(storage.get(taskScope('old-unknown-fingerprint'), 'issue-task-request', prior.requestId).status, 'requested');
});

test('旧数据归属异常时迁移原子回滚，不覆盖新记录也不开草稿', async () => {
  const storage = memoryStorage(); const old = fixture({ storage }); old.state.codex = 'legacy-a';
  const prior = (await old.tasks.execute('open', old.payload())).data.current;
  const indexKey = `${repositoryKey}#42`;
  storage.set(taskScope('legacy-a'), 'issue-task-index', indexKey, { currentRequestId: randomUUID(), historyRequestIds: [] });
  const current = fixture({ storage, identityDetails: true });
  await assert.rejects(current.tasks.execute('open', current.payload()), { code: 'TASK_LEGACY_INVALID' });
  assert.equal(storage.list(taskScope('codex-a'), 'issue-task-request').length, 0);
  assert.equal(storage.get(taskScope('legacy-a'), 'issue-task-request', prior.requestId).status, 'requested');
  assert.equal(current.state.opened.length, 0);
});

test('legacy兼容不替换新作用域当前任务，只追加已归属历史', async () => {
  const storage = memoryStorage(); const current = fixture({ storage, identityDetails: true });
  const active = (await current.tasks.execute('open', current.payload())).data.current;
  const old = fixture({ storage }); old.state.codex = 'legacy-a';
  const prior = (await old.tasks.execute('open', old.payload())).data.current;
  const restored = (await current.tasks.execute('latest', { repositoryKey, number: 42 })).data;
  assert.equal(restored.current.requestId, active.requestId);
  assert.equal(restored.history[0].requestId, prior.requestId);
  await current.tasks.execute('open', current.payload());
  assert.equal(current.state.opened.length, 1, '兼容不能把已发打开请求再次交给宿主');
});

test('真实SQLite重建后只导入精确旧请求一次且保留原库记录', async t => {
  const directory = await temporary(t); const initial = createStorage({ directory });
  const old = fixture({ storage: initial }); old.state.codex = 'legacy-a';
  const prior = (await old.tasks.execute('open', old.payload())).data.current; initial.close();
  const next = createStorage({ directory });
  try {
    const current = fixture({ storage: next, identityDetails: true });
    await current.tasks.execute('latest', { repositoryKey, number: 42 });
    await current.tasks.execute('open', current.payload());
    assert.equal(current.state.opened.length, 0);
    assert.equal(next.get(taskScope('legacy-a'), 'issue-task-request', prior.requestId).status, 'requested');
    assert.equal(next.get(taskScope('codex-a'), 'issue-task-request', prior.requestId).identityVersion, 2);
  } finally { next.close(); }
});

test('修改有效绑定只用于之后另建，已有聊天和历史返回保留原工作区', async () => {
  const f = fixture({ multiple: true });
  await f.tasks.execute('bind', { repositoryKey, workspaceKey, expectedIdentity: 'gh-a' });
  const first = (await f.tasks.execute('open', f.payload())).data.current;
  f.state.threads = [f.thread(firstThread)]; f.state.items.set(firstThread, { data: [{ type: 'userMessage', content: [{ type: 'text', text: first.prompt }] }] });
  await f.tasks.execute('check', { requestId: first.requestId, expectedIdentity: 'gh-a' });
  await f.tasks.execute('bind', { repositoryKey, workspaceKey: f.workspaces[1].key, expectedIdentity: 'gh-a' });
  await f.tasks.execute('open', f.payload()); assert.equal(f.state.opened.at(-1), `codex://threads/${firstThread}`);
  f.state.now += 3000;
  const current = (await f.tasks.execute('open', { ...f.payload(), another: true })).data.current;
  assert.equal(new URL(f.state.opened.at(-1)).searchParams.get('path'), f.workspaces[1].cwd);
  const returned = (await f.tasks.execute('open-history', { repositoryKey, number: 42, requestId: first.requestId, expectedIdentity: 'gh-a' })).data;
  assert.equal(f.state.opened.at(-1), `codex://threads/${firstThread}`);
  assert.equal(returned.current.requestId, current.requestId); assert.equal(returned.history[0].path, f.workspaces[0].cwd);
  assert.equal(returned.binding.workspaceKey, f.workspaces[1].key);
  const calls = f.calls.length;
  await assert.rejects(f.tasks.execute('open-history', { repositoryKey, number: 43, requestId: first.requestId, expectedIdentity: 'gh-a' }), { code: 'TASK_HISTORY_UNKNOWN' });
  assert.equal(f.calls.length, calls, '未归属历史不能读取任意会话');
});

test('歧义只返回完整nonce候选，明确核对重验后关联并标来源，不自动打开', async () => {
  const f = fixture(); const first = (await f.tasks.execute('open', f.payload())).data.current;
  assert.equal(first.reference, first.prompt.split('\n')[0]); assert.notEqual(first.reference, first.requestId);
  f.state.threads = [f.thread(firstThread), f.thread(secondThread)];
  for (const id of [firstThread, secondThread]) f.state.items.set(id, { data: [{ type: 'userMessage', content: [{ type: 'text', text: first.prompt }] }] });
  const ambiguous = (await f.tasks.execute('check', { requestId: first.requestId, expectedIdentity: 'gh-a' })).data.current;
  assert.equal(ambiguous.status, 'ambiguous'); assert.equal(ambiguous.candidates.length, 2);
  assert.equal('prompt' in ambiguous.candidates[0], false);
  const selected = { requestId: first.requestId, threadId: secondThread, confirmed: true, expectedIdentity: 'gh-a' };
  const calls = f.calls.length;
  await assert.rejects(f.tasks.execute('resolve', { ...selected, threadId: randomUUID() }), { code: 'TASK_CANDIDATE_UNKNOWN' });
  await assert.rejects(f.tasks.execute('resolve', { ...selected, confirmed: false }), { code: 'INVALID_ARGUMENT' });
  assert.equal(f.calls.length, calls, '未知候选不得读取任意聊天');
  const linked = (await f.tasks.execute('resolve', selected)).data.current;
  assert.equal(linked.status, 'linked'); assert.equal(linked.threadId, secondThread); assert.equal(linked.associationSource, 'user-confirmed');
  assert.equal(f.state.opened.length, 1, '核对只关联，不打开或发送消息');
});

test('候选nonce或工作区变化拒绝，过期候选不覆盖现有可靠关联', async () => {
  const f = fixture(); const first = (await f.tasks.execute('open', f.payload())).data.current;
  f.state.threads = [f.thread(firstThread), f.thread(secondThread)];
  for (const id of [firstThread, secondThread]) f.state.items.set(id, { data: [{ type: 'userMessage', content: [{ type: 'text', text: first.prompt }] }] });
  await f.tasks.execute('check', { requestId: first.requestId, expectedIdentity: 'gh-a' });
  const input = { requestId: first.requestId, threadId: firstThread, confirmed: true, expectedIdentity: 'gh-a' };
  f.state.items.set(firstThread, { data: [{ type: 'userMessage', content: [{ type: 'text', text: '任务引用已改动' }] }] });
  await assert.rejects(f.tasks.execute('resolve', input), { code: 'TASK_CANDIDATE_CHANGED' });
  f.state.items.set(firstThread, { data: [{ type: 'userMessage', content: [{ type: 'text', text: first.prompt }] }] });
  f.state.threads[0].cwd = '/other-workspace';
  await assert.rejects(f.tasks.execute('resolve', input), { code: 'TASK_CANDIDATE_CHANGED' });
  await f.tasks.execute('resolve', { ...input, threadId: secondThread });
  await assert.rejects(f.tasks.execute('resolve', input), { code: 'TASK_ALREADY_LINKED' });
});

test('候选核对期间账号变化拒绝持久关联，双窗口不同选择不互相覆盖', async () => {
  const f = fixture(); const first = (await f.tasks.execute('open', f.payload())).data.current;
  f.state.threads = [f.thread(firstThread), f.thread(secondThread)];
  for (const id of [firstThread, secondThread]) f.state.items.set(id, { data: [{ type: 'userMessage', content: [{ type: 'text', text: first.prompt }] }] });
  await f.tasks.execute('check', { requestId: first.requestId, expectedIdentity: 'gh-a' });
  const input = { requestId: first.requestId, threadId: firstThread, confirmed: true, expectedIdentity: 'gh-a' };
  f.state.onBridge = async method => { if (method === 'thread/items/list') f.state.github = 'gh-b'; };
  await assert.rejects(f.tasks.execute('resolve', input), { code: 'IDENTITY_CHANGED' });
  f.state.github = 'gh-a'; f.state.onBridge = null;
  assert.equal((await f.tasks.execute('latest', { repositoryKey, number: 42 })).data.current.threadId, null);
  const concurrent = await Promise.allSettled([f.tasks.execute('resolve', input), f.tasks.execute('resolve', { ...input, threadId: secondThread })]);
  assert.equal(concurrent.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(concurrent.filter(item => item.status === 'rejected' && item.reason.code === 'TASK_ALREADY_LINKED').length, 1);
});

test('多个路径首次选择且记住，路径失效不能静默落入其他工作区', async () => {
  const f = fixture({ multiple: true });
  await assert.rejects(f.tasks.execute('open', f.payload()), { code: 'WORKSPACE_REQUIRED' });
  assert.equal(f.state.opened.length, 0);
  await f.tasks.execute('bind', { repositoryKey, workspaceKey, expectedIdentity: 'gh-a' });
  await f.tasks.execute('open', f.payload()); assert.equal(f.state.opened.length, 1);
  f.state.pathsValid = false;
  assert.equal((await f.tasks.execute('latest', { repositoryKey, number: 42 })).data.binding.valid, false);
  await assert.rejects(f.tasks.execute('open', f.payload()), { code: 'WORKSPACE_INVALID' });
  assert.equal(f.state.opened.length, 1);
});

test('打开结果未知持久记录，重新进入后只核查不盲目重新打开', async () => {
  const f = fixture(); let calls = 0;
  const tasks = f.make(async () => { calls++; throw new Error('系统回执丢失'); });
  const result = await tasks.execute('open', f.payload()); assert.equal(result.data.current.status, 'open-unconfirmed');
  assert.equal((await f.make().execute('latest', { repositoryKey, number: 42 })).data.current.status, 'open-unconfirmed');
  await tasks.execute('open', f.payload()); assert.equal(calls, 1);
});

test('双身份隔离，读取期间身份变化不会打开或返回旧账号请求', async () => {
  const f = fixture(); const first = await f.tasks.execute('open', f.payload());
  f.state.github = 'gh-b';
  assert.equal((await f.tasks.execute('latest', { repositoryKey, number: 42 })).data.current, null);
  await assert.rejects(f.tasks.execute('check', { requestId: first.data.current.requestId, expectedIdentity: 'gh-b' }), { code: 'REQUEST_UNKNOWN' });
  f.state.github = 'gh-a'; f.state.codex = 'codex-b';
  assert.equal((await f.tasks.execute('latest', { repositoryKey, number: 42 })).data.current, null);
  f.state.codex = 'codex-a'; f.state.now += 3000;
  f.state.onRead = async () => { f.state.github = 'gh-b'; };
  await assert.rejects(f.tasks.execute('open', { ...f.payload(), another: true }), { code: 'IDENTITY_CHANGED' });
  assert.equal(f.state.opened.length, 1);
});

test('Codex上下文在任务准备中变化使用HOST错误，不误指GitHub账号已切换', async () => {
  const f = fixture(); f.state.onRead = async () => { f.state.codex = 'codex-new-context'; };
  await assert.rejects(f.tasks.execute('open', f.payload()), { code: 'HOST_IDENTITY_CHANGED' });
  assert.equal(f.state.github, 'gh-a'); assert.equal(f.state.opened.length, 0);
});

test('桌面深链聊天未写projectId时按精确工作区查候选并核验完整首条引用', async () => {
  const f = fixture(), task = (await f.tasks.execute('open', f.payload())).data.current;
  const desktopThread = { ...f.thread(firstThread), projectId: null };
  f.state.threads = [desktopThread];
  f.state.onBridge = async (method, args) => {
    if (method === 'thread/list') f.state.listResponse = { data: args.projectId ? [] : f.state.threads, nextCursor: null };
  };
  f.state.items.set(firstThread, { data: [{ type: 'userMessage', content: [{ type: 'text', text: task.prompt }] }] });
  const result = (await f.tasks.execute('check', { requestId: task.requestId, expectedIdentity: 'gh-a' })).data.current;
  assert.equal(result.status, 'linked'); assert.equal(result.threadId, firstThread);
  const parameters = f.calls.find(([method]) => method === 'thread/list')[1];
  assert.equal(parameters.cwd, f.workspaces[0].cwd); assert.equal(Object.hasOwn(parameters, 'projectId'), false);
  assert.equal(f.state.opened.length, 1, '核对仅保存关联，不能再次打开或发送');
});

test('关联检查读取官方turnId和item包装中的首条用户消息', async () => {
  const f = fixture(), task = (await f.tasks.execute('open', f.payload())).data.current;
  f.state.threads = [f.thread(firstThread)];
  f.state.items.set(firstThread, { data: [
    { turnId: 'turn-one', item: { type: 'userMessage', id: 'user-one', clientId: null, content: [{ type: 'text', text: task.prompt, text_elements: [] }] }, startedAtMs: f.state.now, completedAtMs: f.state.now + 1 },
    { turnId: 'turn-one', item: { type: 'agentMessage', id: 'reply-one', text: '验收收到' }, startedAtMs: f.state.now, completedAtMs: f.state.now + 1 },
  ], nextCursor: null });
  const result = (await f.tasks.execute('check', { requestId: task.requestId, expectedIdentity: 'gh-a' })).data.current;
  assert.equal(result.status, 'linked'); assert.equal(result.threadId, firstThread); assert.equal(result.checkedCandidates, 1);
});

test('缺省项目可核验但明确其他项目或工作区不能读取并关联', async () => {
  const f = fixture(), task = (await f.tasks.execute('open', f.payload())).data.current;
  f.state.threads = [{ ...f.thread(firstThread), projectId: 'other-project' }, { ...f.thread(secondThread), cwd: '/workspace/elsewhere', projectId: null }];
  for (const id of [firstThread, secondThread]) f.state.items.set(id, { data: [{ type: 'userMessage', content: [{ type: 'text', text: task.prompt }] }] });
  const result = (await f.tasks.execute('check', { requestId: task.requestId, expectedIdentity: 'gh-a' })).data.current;
  assert.equal(result.status, 'pending'); assert.equal(result.threadId, null);
  assert.equal(f.calls.filter(([method]) => method === 'thread/items/list').length, 0);
});

test('包装中的代理引用或后续用户引用不能代替首条用户消息', async () => {
  const f = fixture(), task = (await f.tasks.execute('open', f.payload())).data.current;
  f.state.threads = [f.thread(firstThread)];
  f.state.items.set(firstThread, { data: [
    { turnId: 'turn-one', item: { type: 'agentMessage', text: task.prompt } },
    { turnId: 'turn-one', item: { type: 'userMessage', content: [{ type: 'text', text: '普通聊天，不是该任务' }] } },
    { turnId: 'turn-two', item: { type: 'userMessage', content: [{ type: 'text', text: task.prompt }] } },
  ], nextCursor: null });
  const result = (await f.tasks.execute('check', { requestId: task.requestId, expectedIdentity: 'gh-a' })).data.current;
  assert.equal(result.status, 'pending'); assert.equal(result.threadId, null); assert.equal(result.coverage, 'complete');
});

test('损坏或任意嵌套包装不得被猜测为有效首条用户消息', async () => {
  const f = fixture(), task = (await f.tasks.execute('open', f.payload())).data.current;
  f.state.threads = [f.thread(firstThread)];
  const item = { type: 'userMessage', content: [{ type: 'text', text: task.prompt }] };
  for (const row of [{ item }, { turnId: 'turn-one', type: 'agentMessage', item }, { turnId: 'turn-one', message: item }, { turnId: 'turn-one', item: null }]) {
    f.state.items.set(firstThread, { data: [row], nextCursor: null });
    await assert.rejects(f.tasks.execute('check', { requestId: task.requestId, expectedIdentity: 'gh-a' }), { code: 'HOST_PROTOCOL' });
    assert.equal((await f.tasks.execute('latest', { repositoryKey, number: 42 })).data.current.threadId, null);
  }
  assert.equal(f.state.opened.length, 1);
});

test('官方包装分页完整唯一时才关联，人工候选核对继续使用相同读取规则', async () => {
  const f = fixture(), task = (await f.tasks.execute('open', f.payload())).data.current;
  f.state.threads = [f.thread(firstThread), f.thread(secondThread)];
  f.state.onBridge = async (method, args) => {
    if (method === 'thread/items/list') f.state.items.set(args.threadId, args.cursor
      ? { data: [{ turnId: 'turn-one', item: { type: 'userMessage', content: [{ type: 'text', text: task.prompt }] } }], nextCursor: null }
      : { data: [{ turnId: 'turn-one', item: { type: 'reasoning' } }], nextCursor: 'next-initial-page' });
  };
  const result = (await f.tasks.execute('check', { requestId: task.requestId, expectedIdentity: 'gh-a' })).data.current;
  assert.equal(result.status, 'ambiguous'); assert.equal(result.candidates.length, 2);
  const selected = (await f.tasks.execute('resolve', { requestId: task.requestId, threadId: secondThread, confirmed: true, expectedIdentity: 'gh-a' })).data.current;
  assert.equal(selected.status, 'linked'); assert.equal(selected.threadId, secondThread); assert.equal(selected.associationSource, 'user-confirmed');
  assert.equal(f.state.opened.length, 1, '人工核对也不打开或发送聊天');
});

test('完整唯一首条引用才关联，可靠关联优先返回真实聊天且不附提示词', async () => {
  const f = fixture(); const opened = await f.tasks.execute('open', f.payload()); const task = opened.data.current;
  f.state.threads = [f.thread(firstThread)];
  f.state.items.set(firstThread, { data: [{ type: 'userMessage', content: [{ type: 'text', text: task.prompt }] }] });
  const linked = await f.tasks.execute('check', { requestId: task.requestId, expectedIdentity: 'gh-a' });
  assert.equal(linked.data.current.status, 'linked'); assert.equal(linked.data.current.threadId, firstThread);
  await f.tasks.execute('open', f.payload()); assert.equal(f.state.opened.at(-1), `codex://threads/${firstThread}`);
  assert.equal(f.calls.find(([method]) => method === 'thread/list')[1].cwd, f.workspaces[0].cwd);
  assert.ok(f.storage.list('github.com:gh-a:codex:unused', 'issue-task-request').length === 0);
});

test('Codex账号在点击返回前切换，reuseOnly旧请求拒绝且不创建新草稿或记录', async () => {
  const f = fixture({ identityDetails: true });
  const first = (await f.tasks.execute('open', f.payload())).data.current;
  f.state.threads = [f.thread(firstThread)];
  f.state.items.set(firstThread, { data: [{ type: 'userMessage', content: [{ type: 'text', text: first.prompt }] }] });
  await f.tasks.execute('check', { requestId: first.requestId, expectedIdentity: 'gh-a' });
  const calls = f.calls.length;
  f.state.codex = 'codex-b';
  let issueReads = 0; f.state.onRead = async () => { issueReads++; };
  await assert.rejects(f.tasks.execute('open', { ...f.payload(), requestId: first.requestId, reuseOnly: true }), { code: 'REQUEST_UNKNOWN' });
  assert.equal(f.state.opened.length, 1); assert.equal(f.calls.length, calls); assert.equal(issueReads, 0);
  assert.equal(f.storage.list(taskScope('codex-b'), 'issue-task-request').length, 0);
  assert.equal(f.storage.list(taskScope('codex-b'), 'issue-task-index').length, 0);
});

test('reuseOnly必须精确匹配请求，不回退当前记录；同账号配置更新仍可返回', async () => {
  const f = fixture({ identityDetails: true });
  const first = (await f.tasks.execute('open', f.payload())).data.current;
  f.state.threads = [f.thread(firstThread)];
  f.state.items.set(firstThread, { data: [{ type: 'userMessage', content: [{ type: 'text', text: first.prompt }] }] });
  await f.tasks.execute('check', { requestId: first.requestId, expectedIdentity: 'gh-a' });
  const calls = f.calls.length;
  await assert.rejects(f.tasks.execute('open', { ...f.payload(), reuseOnly: true }), { code: 'REQUEST_UNKNOWN' });
  await assert.rejects(f.tasks.execute('open', { ...f.payload(), number: 43, requestId: first.requestId, reuseOnly: true }), { code: 'REQUEST_UNKNOWN' });
  assert.equal(f.calls.length, calls); assert.equal(f.state.opened.length, 1);
  f.state.legacy = 'config-was-updated-same-account';
  await f.tasks.execute('open', { ...f.payload(), requestId: first.requestId, reuseOnly: true });
  assert.equal(f.state.opened.at(-1), `codex://threads/${firstThread}`);
  assert.equal(f.storage.list(taskScope('codex-a'), 'issue-task-request').length, 1);
});

test('同引用多匹配、重复游标和截断初始项均保持待确认', async () => {
  const f = fixture(); const task = (await f.tasks.execute('open', f.payload())).data.current;
  f.state.threads = [f.thread(firstThread), f.thread(secondThread)];
  for (const id of [firstThread, secondThread]) f.state.items.set(id, { data: [{ type: 'userMessage', content: [{ type: 'text', text: task.prompt }] }] });
  assert.equal((await f.tasks.execute('check', { requestId: task.requestId, expectedIdentity: 'gh-a' })).data.current.status, 'ambiguous');
  f.state.threads = [f.thread(firstThread)]; f.state.listResponse = { data: f.state.threads, nextCursor: 'repeated' };
  const partial = (await f.tasks.execute('check', { requestId: task.requestId, expectedIdentity: 'gh-a' })).data.current;
  assert.equal(partial.status, 'pending'); assert.equal(partial.coverage, 'partial'); assert.equal(partial.threadId, null);
  delete f.state.listResponse;
  f.state.items.set(firstThread, { data: [{ type: 'reasoning' }], nextCursor: 'repeated' });
  const truncated = (await f.tasks.execute('check', { requestId: task.requestId, expectedIdentity: 'gh-a' })).data.current;
  assert.equal(truncated.coverage, 'partial'); assert.equal(truncated.threadId, null);
  f.state.threads = [f.thread(firstThread), { cwd: f.workspaces[0].cwd, id: '损坏的聊天标识', createdAt: f.state.now / 1000 }];
  f.state.items.set(firstThread, { data: [{ type: 'userMessage', content: [{ type: 'text', text: task.prompt }] }] });
  const damaged = (await f.tasks.execute('check', { requestId: task.requestId, expectedIdentity: 'gh-a' })).data.current;
  assert.equal(damaged.coverage, 'partial'); assert.equal(damaged.threadId, null);
});

test('另建明确保留历史，连续误点一次，已有草稿不被覆盖', async () => {
  const f = fixture(); const first = (await f.tasks.execute('open', f.payload())).data.current;
  f.state.now += 3000;
  const input = { ...f.payload(), another: true };
  const second = (await f.tasks.execute('open', input)).data;
  assert.notEqual(second.current.requestId, first.requestId); assert.equal(second.history[0].requestId, first.requestId);
  const third = (await f.tasks.execute('open', { ...f.payload(), another: true })).data;
  assert.equal(third.current.requestId, second.current.requestId); assert.equal(f.state.opened.length, 2);
  assert.equal(third.history[0].prompt, first.prompt);
});

test('参数拒绝任意路径、未知动作和不合法请求，不触发宿主读取', async () => {
  const f = fixture();
  await assert.rejects(f.tasks.execute('open', { ...f.payload(), cwd: '/escape' }), { code: 'INVALID_ARGUMENT' });
  await assert.rejects(f.tasks.execute('exec', {}), { code: 'INVALID_ARGUMENT' });
  await assert.rejects(f.tasks.execute('check', { requestId: 'bad' }), { code: 'INVALID_ARGUMENT' });
  await assert.rejects(f.tasks.execute('open', { ...f.payload(), expectedIdentity: '旧页面账号' }), { code: 'IDENTITY_CHANGED' });
  assert.equal(f.calls.length, 0); assert.equal(f.state.opened.length, 0);
});

test('两个独立 SQLite 连接共享任务 claim，关闭重开后请求和绑定可恢复', async t => {
  const directory = await temporary(t);
  const firstStorage = createStorage({ directory }), secondStorage = createStorage({ directory });
  const first = fixture({ storage: firstStorage }), second = fixture({ storage: secondStorage });
  try {
    const values = await Promise.all([first.tasks.execute('open', first.payload()), second.tasks.execute('open', second.payload())]);
    assert.equal(first.state.opened.length + second.state.opened.length, 1);
    assert.equal(values[0].data.current.requestId, values[1].data.current.requestId);
  } finally { firstStorage.close(); secondStorage.close(); }
  const reopened = createStorage({ directory });
  try {
    const restored = await fixture({ storage: reopened }).tasks.execute('latest', { repositoryKey, number: 42 });
    assert.equal(restored.data.current.status, 'requested'); assert.equal(restored.data.binding.workspaceKey, workspaceKey);
    assert.ok(restored.data.current.prompt.startsWith('任务引用：issue-hub:'));
  } finally { reopened.close(); }
});
