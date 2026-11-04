import test from 'node:test';
import assert from 'node:assert/strict';
import { createIssueService } from '../src/services/issues.mjs';
import { createStorage } from '../src/storage/database.mjs';
import { createCatalog, parseGithubRemote } from '../src/catalog.mjs';
import { ProofError } from '../src/errors.mjs';
import { temporary, repositoryKey } from './helpers.mjs';

const pause = () => { let release; return { promise: new Promise(resolve => release = resolve), release: value => release(value) }; };
async function setup(t) {
  let storage;
  storage = createStorage({ directory: await temporary({ after: cleanup => t.after(async () => { storage?.close(); await cleanup(); }) }) });
  const counters = { identity: 0, metadata: 0, issue: 0, comments: 0, activity: 0 }, gate = pause();
  const account = { id: 8, login: 'member', name: '成员' };
  const entries = [{ key: repositoryKey, fullName: 'team/repo', workspaces: [] }];
  const catalog = { snapshot: () => ({ status: 'complete', repositories: entries, warnings: [], sampledAt: '2026-11-04T00:00:00Z' }), refresh: async () => {} };
  const state = { delayIdentity: false, delayMetadata: false, delayDiscussion: false, credential: 'fingerprint8', invalidAuth: false, resource401: false };
  const issue = { id: 12, number: 1, title: '先显示正文', body: '正文内容', state: 'open', updated_at: '2026-11-04T00:00:00Z', user: { id: 8, login: 'member' }, comments: 200 };
  const github = {
    fingerprint: async () => state.credential,
    identity: async () => { counters.identity++; if (state.invalidAuth) throw new ProofError('AUTH_REQUIRED', '身份失效'); if (state.delayIdentity) await gate.promise; return { ...account, credentialFingerprint: state.credential }; },
    request: async (_method, path) => {
      const response = data => ({ data, headers: {}, status: 200 });
      if (path === '/repos/team/repo') { counters.metadata++; if (state.resource401) throw new ProofError('AUTH_REQUIRED', '资源身份失效'); if (state.delayMetadata) await gate.promise; return response({ id: 11, full_name: 'team/repo', name: 'repo', permissions: { push: true }, has_issues: true }); }
      if (path.endsWith('/issues/1')) { counters.issue++; return response(issue); }
      if (path.includes('/issues?')) { counters.issue++; return response([issue]); }
      if (path.includes('/comments')) { counters.comments++; if (state.delayDiscussion) await gate.promise; return response([]); }
      if (path.includes('/timeline')) { counters.activity++; if (state.delayDiscussion) await gate.promise; return response([]); }
      throw new Error(`非预期请求 ${path}`);
    },
  };
  return { storage, counters, gate, state, github, catalog, service: createIssueService({ github, storage, catalog }) };
}
async function settlesBeforeGate(operation, gate) {
  let settled = false; operation.then(() => settled = true, () => settled = true);
  await new Promise(resolve => setImmediate(resolve));
  try { assert.equal(settled, true, '首屏仍被与当前画面无关的慢请求阻塞'); }
  finally { gate.release(); }
  return operation;
}
test('已验证同凭据的首页快照不等待远端用户接口', async t => {
  const { service, storage, state, gate, counters } = await setup(t);
  storage.set('_identity', 'credential', 'fingerprint8', { account: { id: 8, login: 'member' }, scope: 'github.com:8' });
  state.delayIdentity = true;
  const result = await settlesBeforeGate(service.execute('bootstrap'), gate);
  assert.equal(result.data.refreshNeeded, true); assert.equal(result.data.checking.identity, true);
  assert.equal(counters.identity, 0);
});
test('首页目录不等待所有仓库元数据', async t => {
  const { service, state, gate, counters } = await setup(t); state.delayMetadata = true;
  const result = await settlesBeforeGate(service.execute('bootstrap'), gate);
  assert.equal(result.data.repositories.length, 1); assert.equal(result.data.refreshNeeded, true);
  assert.equal(counters.metadata, 0);
});
test('详情概览不请求评论活动，完整模型读取仍取得讨论', async t => {
  const { service, state, gate, counters } = await setup(t); state.delayDiscussion = true;
  const result = await settlesBeforeGate(service.execute('read-summary', { repositoryKey, number: 1 }), gate);
  assert.equal(result.data.issue.title, '先显示正文'); assert.equal(result.data.issue.coverage.comments.complete, false);
  assert.equal(counters.comments, 0); assert.equal(counters.activity, 0);
  state.delayDiscussion = false;
  await service.execute('read', { repositoryKey, number: 1 }); assert.ok(counters.comments > 0 && counters.activity > 0);
});

test('已缓存Issue列表与正文先显示，不等待远端身份与元信息', async t => {
  const { service, state, gate, counters } = await setup(t);
  await service.execute('list', { repositoryKey }); await service.execute('read-summary', { repositoryKey, number: 1 });
  const previous = { ...counters }; state.delayIdentity = true; state.delayMetadata = true;
  const results = await settlesBeforeGate(Promise.all([service.execute('list', { repositoryKey, cacheFirst: true }), service.execute('read-summary', { repositoryKey, number: 1, cacheFirst: true })]), gate);
  assert.equal(results[0].data.issues.length, 1); assert.equal(results[1].data.issue.body, '正文内容');
  assert.ok(results.every(result => result.cached && result.checking.identity && result.checking.data)); assert.deepEqual(counters, previous);
  t.diagnostic(JSON.stringify({ cachedFirstScreen: true, extraRemoteCalls: 0 }));
});
test('凭据改变未验证时不走旧账号快照，401撤销后不能复活', async t => {
  const { service, state, gate, counters } = await setup(t);
  await service.execute('read-summary', { repositoryKey, number: 1 });
  state.credential = 'fingerprint-new'; state.delayIdentity = true;
  let settled = false; const pending = service.execute('read-summary', { repositoryKey, number: 1, cacheFirst: true }).then(value => { settled = true; return value; });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false); gate.release(); await pending;
  state.delayIdentity = false; state.resource401 = true;
  await assert.rejects(service.execute('read-summary', { repositoryKey, number: 1 }), { code: 'AUTH_REQUIRED' });
  state.invalidAuth = true;
  await assert.rejects(service.execute('read-summary', { repositoryKey, number: 1, cacheFirst: true }), { code: 'AUTH_REQUIRED' });
  assert.ok(counters.identity >= 3);
});
test('相同在途读取只执行一次身份和API链路', async t => {
  const { service, state, gate, counters } = await setup(t); state.delayMetadata = true;
  const first = service.execute('read-summary', { repositoryKey, number: 1 });
  const second = service.execute('read-summary', { repositoryKey, number: 1 });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(counters.identity, 1); assert.equal(counters.metadata, 1);
  gate.release(); const result = await Promise.all([first, second]); assert.equal(counters.issue, 1); assert.equal(result[0].data.issue.id, result[1].data.issue.id);
});
test('列宽和选仓记忆只写当前账号本机状态并校验范围', async t => {
  const { service, counters, storage } = await setup(t);
  await service.execute('read-summary', { repositoryKey, number: 1 }); const previous = { ...counters };
  const result = await service.execute('view-state-save', { expectedIdentity: 8, value: { navigationWidth: 240, queueWidth: 420, repositoryKey } });
  const canonicalKey = storage.get('github.com:8', 'repository-alias', repositoryKey).key;
  assert.deepEqual(result.data.viewState, { navigationWidth: 240, queueWidth: 420, repositoryKey: canonicalKey }); assert.deepEqual(counters, previous);
  await assert.rejects(service.execute('view-state-save', { expectedIdentity: 8, value: { queueWidth: 900 } }), { code: 'INVALID_ARGUMENT' });
  await assert.rejects(service.execute('view-state-save', { expectedIdentity: 9, value: { queueWidth: 400 } }), { code: 'IDENTITY_CHANGED' });
  assert.equal(storage.get('github.com:9', 'view', 'layout'), null);
});

test('缓存快读在途发生401撤销时不返回旧私有正文', async t => {
  const { service, state, github } = await setup(t);
  await service.execute('read-summary', { repositoryKey, number: 1 });
  const stopped = pause(), entered = pause(); let fingerprints = 0;
  github.fingerprint = async () => { if (++fingerprints === 3) { entered.release(); await stopped.promise; } return state.credential; };
  const reading = service.execute('read-summary', { repositoryKey, number: 1, cacheFirst: true });
  const rejected = assert.rejects(reading, { code: 'AUTH_REQUIRED' });
  await entered.promise;
  state.resource401 = true;
  await assert.rejects(service.execute('read-summary', { repositoryKey, number: 1 }), { code: 'AUTH_REQUIRED' });
  stopped.release(); await rejected;
});

test('冷目录名称键选仓记忆在归一后使用稳定ID键，旧记忆也可恢复', async t => {
  const { service, storage } = await setup(t);
  await service.execute('read-summary', { repositoryKey, number: 1 });
  const canonicalKey = storage.get('github.com:8', 'repository-alias', repositoryKey).key;
  await service.execute('view-state-save', { expectedIdentity: 8, value: { repositoryKey } });
  assert.equal(storage.get('github.com:8', 'view', 'layout').repositoryKey, canonicalKey);
  storage.set('github.com:8', 'view', 'layout', { repositoryKey });
  assert.equal((await service.execute('bootstrap')).data.viewState.repositoryKey, canonicalKey);
});

test('冷目录先取直接根仓库，全量子仓库发现不阻塞首批目录', async t => {
  const directory = await temporary(t), gate = pause(); let deepCalls = 0;
  const source = parseGithubRemote('https://github.com/team/repo.git');
  const info = { cwd: directory, repositories: [source] };
  const catalog = createCatalog({ bridge: { request: async () => ({ data: [{ id: 'project', roots: [{ path: directory }] }], nextCursor: null }) }, gitInspector: async () => info, discover: async () => { deepCalls++; await gate.promise; return { infos: [info], authorizedRoot: directory, warnings: [] }; } });
  const complete = catalog.refresh();
  const quick = await settlesBeforeGate(catalog.refresh({ quick: true }), gate);
  assert.equal(quick.repositories.length, 1); assert.equal(quick.status, 'partial'); assert.ok(quick.checking);
  await assert.rejects(catalog.resolveWorkspace(source.key, quick.repositories[0].workspaces[0].key), { code: 'CATALOG_CHECKING' });
  await complete; assert.equal(deepCalls, 1); assert.equal(catalog.snapshot().checking, undefined);
});
test('新进程目录快照按当前scope恢复且复核前禁止打开工作区', async t => {
  const { storage, github } = await setup(t); const directory = await temporary(t);
  const source = parseGithubRemote('https://github.com/team/repo.git'), info = { cwd: directory, repositories: [source] };
  let scans = 0;
  const options = { bridge: { request: async () => ({ data: [{ id: 'project', roots: [{ path: directory }] }], nextCursor: null }) }, gitInspector: async () => info, discover: async () => { scans++; return { infos: [info], warnings: [], authorizedRoot: directory }; } };
  const original = createIssueService({ storage, github, catalog: createCatalog(options) });
  const initial = await original.execute('refresh'); assert.equal(initial.data.repositories.length, 1);
  const restoredCatalog = createCatalog(options), restored = createIssueService({ storage, github, catalog: restoredCatalog });
  const result = await restored.execute('bootstrap'); assert.equal(result.data.repositories.length, 1); assert.equal(scans, 1); assert.ok(result.data.catalog.checking);
  const repository = result.data.repositories[0]; await assert.rejects(restoredCatalog.resolveWorkspace(repository.key, repository.workspaces[0].key), { code: 'CATALOG_CHECKING' });
});

test('真实服务目录刷新失败保留当前scope仓库与已读正文，复核前不能打开工作区', async t => {
  const { storage, github } = await setup(t); const directory = await temporary(t);
  const source = parseGithubRemote('https://github.com/team/repo.git'), info = { cwd: directory, repositories: [source] };
  let unavailable = false;
  const catalog = createCatalog({ bridge: { request: async () => { if (unavailable) throw new ProofError('HOST_UNAVAILABLE', '宿主暂不可用'); return { data: [{ id: 'project', roots: [{ path: directory }] }], nextCursor: null }; } }, gitInspector: async () => info, discover: async () => ({ infos: [info], warnings: [], authorizedRoot: directory }) });
  const service = createIssueService({ storage, github, catalog });
  const initial = await service.execute('refresh'), repository = initial.data.repositories[0];
  await service.execute('read-summary', { repositoryKey: repository.key, number: 1 });
  unavailable = true;
  const failed = await service.execute('refresh');
  assert.equal(failed.data.repositories.length, 1); assert.equal(failed.data.repositories[0].key, repository.key);
  assert.equal(failed.data.catalog.status, 'unavailable'); assert.equal(failed.data.catalog.checking, true);
  assert.equal(failed.data.catalog.error.code, 'HOST_UNAVAILABLE'); assert.equal(failed.cached, true);
  const reopened = await service.execute('bootstrap'); assert.equal(reopened.data.repositories[0].key, repository.key);
  const cachedBody = await service.execute('read-summary', { repositoryKey: repository.key, number: 1, cacheFirst: true });
  assert.equal(cachedBody.data.issue.body, '正文内容');
  await assert.rejects(catalog.resolveWorkspace(repository.key, repository.workspaces[0].key), { code: 'CATALOG_CHECKING' });
  unavailable = false; await service.execute('refresh');
  assert.equal((await catalog.resolveWorkspace(repository.key, repository.workspaces[0].key)).workspace.cwd, directory);
});

test('冷启动宿主失败明确报目录不可用，不把成功空数组当没有项目', async t => {
  const { storage, github } = await setup(t);
  const catalog = createCatalog({ bridge: { request: async () => { throw new ProofError('HOST_UNAVAILABLE', '宿主暂不可用'); } } });
  const service = createIssueService({ storage, github, catalog });
  const result = await service.execute('bootstrap');
  assert.equal(result.data.repositories.length, 0); assert.equal(result.data.catalog.status, 'unavailable');
  assert.equal(result.data.catalog.error.code, 'HOST_UNAVAILABLE'); assert.equal(result.data.catalog.checking, true);
  assert.equal(result.data.refreshNeeded, true);
});
