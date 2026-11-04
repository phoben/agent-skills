import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { createIssueService } from '../src/services/issues.mjs';
import { createStorage } from '../src/storage/database.mjs';
import { createCatalog, parseGithubRemote } from '../src/catalog.mjs';
import { ProofError } from '../src/errors.mjs';
import { temporary, repositoryKey } from './helpers.mjs';

const fullName = 'team/repo';
const initial = () => ({ id: 21, number: 1, title: '原始标题', body: '正文', state: 'open', labels: [{ id: 1, name: 'bug' }], assignees: [{ id: 8, login: 'member' }], milestone: null, user: { id: 8, login: 'member' }, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T01:00:00Z', comments: 0, html_url: 'https://github.com/team/repo/issues/1' });
async function setup(t, options = {}) {
  let storage;
  storage = createStorage({ directory: await temporary({ after: cleanup => t.after(async () => { storage?.close(); await cleanup(); }) }) });
  const state = { user: { id: 8, login: 'member', name: '成员', credentialFingerprint: 'fingerprint8' }, issue: initial(), comments: [], writes: 0, online: true, failWrite: false, failReadback: false, manage: true, ...options };
  const github = {
    async fingerprint() { return state.user.credentialFingerprint; },
    async identity() { if (!state.online) throw new ProofError('NETWORK_UNAVAILABLE', '离线'); if (state.invalidAuth) throw new ProofError('AUTH_REQUIRED', '身份失效'); return structuredClone(state.user); },
    async request(method, path, body) {
      if (!state.online) throw new ProofError('NETWORK_UNAVAILABLE', '离线');
      if (state.onRequest) await state.onRequest(method, path, body);
      const url = new URL(path, 'https://api.github.com'); const endpoint = url.pathname;
      const result = data => ({ data: structuredClone(data), headers: {}, status: 200 });
      if (endpoint === `/repos/${fullName}`) return result({ id: 11, name: 'repo', full_name: fullName, owner: { login: 'team' }, html_url: `https://github.com/${fullName}`, has_issues: true, permissions: { push: state.manage } });
      if (method === 'POST' || method === 'PATCH') {
        state.writes++;
        if (state.failWrite) throw new ProofError('WRITE_UNKNOWN', '响应丢失');
        if (endpoint.endsWith('/comments') || endpoint.includes('/issues/comments/')) {
          if (method === 'POST') { const comment = { id: 400 + state.comments.length, body: body.body, user: { id: 8, login: 'member' }, created_at: '2026-11-04T00:00:00Z', updated_at: '2026-11-04T00:00:00Z', issue_url: `https://api.github.com/repos/${fullName}/issues/1` }; state.comments.push(comment); state.issue.comments = state.comments.length; return result(comment); }
          const comment = state.comments.find(row => row.id === Number(endpoint.split('/').pop())); comment.body = body.body; return result(comment);
        }
        state.issue = { ...state.issue, ...body, updated_at: '2026-11-04T00:00:00Z' };
        if (body.labels) state.issue.labels = body.labels.map(name => ({ name }));
        if (body.assignees) state.issue.assignees = body.assignees.map(login => ({ login }));
        if ('milestone' in body) state.issue.milestone = body.milestone ? { number: body.milestone, title: 'v1' } : null;
        if (method === 'POST') state.issue.number = 2;
        return result(state.issue);
      }
      if (endpoint.endsWith('/issues/1') || endpoint.endsWith('/issues/2')) { if (state.failReadback && state.writes) throw new ProofError('NETWORK_UNAVAILABLE', '读回失败'); return result(state.issue); }
      if (endpoint.endsWith('/issues')) return result([state.issue, { ...state.issue, id: 22, number: 3, pull_request: { url: 'pr' } }]);
      if (endpoint.includes('/issues/comments/')) return result(state.comments.find(row => row.id === Number(endpoint.split('/').pop())));
      if (endpoint.endsWith('/comments')) {
        const page = Number(url.searchParams.get('page') || 1), items = state.comments.slice((page - 1) * 100, page * 100), response = result(items);
        if (page * 100 < state.comments.length) response.headers.link = `<https://api.github.com${endpoint}?per_page=100&page=${page + 1}>; rel="next"`;
        return response;
      }
      if (endpoint.endsWith('/timeline')) return result([]);
      if (endpoint.endsWith('/labels')) return result([{ id: 1, name: 'bug', color: 'ffffff' }, { id: 2, name: 'enhancement' }]);
      if (endpoint.endsWith('/assignees')) return result([{ id: 8, login: 'member' }]);
      if (endpoint.endsWith('/milestones')) return result([{ id: 4, number: 4, title: 'v1', state: 'open' }]);
      throw new Error(`未覆盖测试请求 ${method} ${endpoint}`);
    },
  };
  const catalog = { snapshot: () => ({ status: 'complete', repositories: [{ key: repositoryKey, fullName, workspaces: [] }], warnings: [] }), refresh: async () => {} };
  const service = createIssueService({ github, storage, catalog, pageLimit: state.pageLimit || 10 });
  const run = (action, payload = {}) => service.execute(action, { repositoryKey, ...(['save-issue', 'change-state', 'save-comment', 'draft-save', 'preference-save', 'operation-resolve'].includes(action) ? { expectedIdentity: 8 } : {}), ...payload });
  return { storage, service, github, catalog, state, run };
}

test('列表排除 PR，详情取得 101 条评论且保存明确覆盖状态', async t => {
  const { run, state } = await setup(t);
  state.comments = Array.from({ length: 101 }, (_, index) => ({ id: index + 1, body: `评论${index}`, user: { id: 8, login: 'member' }, created_at: 'today' })); state.issue.comments = 101;
  const list = await run('list'); assert.equal(list.data.issues.length, 1); assert.equal(list.data.issues[0].revision, state.issue.updated_at);
  const read = await run('read', { number: 1 }); assert.equal(read.data.issue.commentItems.length, 101); assert.equal(read.data.issue.coverage.comments.complete, true);
});
test('超过读取上限保留分页续读，不称完整', async t => {
  const { run, state } = await setup(t, { pageLimit: 1 });
  state.comments = Array.from({ length: 101 }, (_, index) => ({ id: index + 1, body: `评论${index}`, user: { id: 8, login: 'member' } })); state.issue.comments = 101;
  const read = await run('read', { number: 1 }); assert.equal(read.data.issue.commentItems.length, 100); assert.equal(read.data.issue.coverage.comments.complete, false); assert.equal(read.data.issue.coverage.comments.nextCursor, '2');
  const remaining = await run('comments', { number: 1, cursor: '2' }); assert.equal(remaining.data.items.length, 1); assert.equal(remaining.data.pageInfo.complete, true);
});
test('编辑冲突不写远端，显式覆盖后写入并重新读取', async t => {
  const { run, state } = await setup(t);
  const values = { number: 1, title: '新标题', body: '新正文', revision: '旧版本' };
  await assert.rejects(run('save-issue', { values, operationId: randomUUID() }), error => error.code === 'CONFLICT' && error.remote.title === '原始标题'); assert.equal(state.writes, 0);
  const saved = await run('save-issue', { values, force: true, operationId: randomUUID() });
  assert.equal(saved.data.operation.status, 'confirmed'); assert.equal(saved.data.issue.title, '新标题'); assert.equal(state.writes, 1);
});
test('创建响应未知时同ID和新ID重试都不重复创建', async t => {
  const { run, state } = await setup(t); state.failWrite = true;
  const operationId = randomUUID(), values = { title: '新建中文标题', body: '正文' };
  await assert.rejects(run('save-issue', { values, operationId }), { code: 'OPERATION_UNKNOWN' });
  await assert.rejects(run('save-issue', { values, operationId }), { code: 'OPERATION_UNKNOWN' });
  await assert.rejects(run('save-issue', { values, operationId: randomUUID() }), { code: 'OPERATION_UNKNOWN' }); assert.equal(state.writes, 1);
});
test('并发相同内容只允许一份远端创建请求在途', async t => {
  const { run, state } = await setup(t);
  let release, entered;
  const gate = new Promise(resolve => release = resolve), started = new Promise(resolve => entered = resolve);
  state.onRequest = async method => { if (method === 'POST') { entered(); await gate; } };
  const values = { title: '连续误点只创建一次', body: '' };
  const first = run('save-issue', { values, operationId: randomUUID() });
  await started;
  await assert.rejects(run('save-issue', { values, operationId: randomUUID() }), { code: 'OPERATION_UNKNOWN' });
  release(); assert.equal((await first).data.operation.status, 'confirmed'); assert.equal(state.writes, 1);
});
test('创建被接受但读回失败保留回执，不再次提交', async t => {
  const { run, state } = await setup(t); state.failReadback = true;
  const values = { title: '已创建但读回失败', body: '' }, operationId = randomUUID();
  await assert.rejects(run('save-issue', { values, operationId }), error => error.code === 'READBACK_PENDING' && error.operation.status === 'readback-failed');
  await assert.rejects(run('save-issue', { values, operationId }), { code: 'OPERATION_UNKNOWN' }); assert.equal(state.writes, 1);
  await assert.rejects(run('operation-resolve', { operationId, resolution: 'not-created', confirmed: true }), { code: 'OPERATION_STATE' });
  state.failReadback = false;
  const checked = await run('operation-resolve', { operationId, resolution: 'readback', confirmed: true });
  assert.equal(checked.data.operation.status, 'confirmed'); assert.equal(checked.data.issue.number, 2); assert.equal(state.writes, 1);
});
test('未知结果仅经人工确认解除，解除不发布，再次提交需新ID', async t => {
  const { run, state } = await setup(t); state.failWrite = true;
  const values = { title: '人工核对的创建', body: '正文' }, operationId = randomUUID();
  await assert.rejects(run('save-issue', { values, operationId }), { code: 'OPERATION_UNKNOWN' });
  await assert.rejects(run('operation-resolve', { operationId, resolution: 'not-created', confirmed: false }), { code: 'INVALID_ARGUMENT' });
  const resolved = await run('operation-resolve', { operationId, resolution: 'not-created', confirmed: true }); assert.equal(resolved.data.operation.status, 'resolved-not-created'); assert.equal(state.writes, 1);
  await assert.rejects(run('save-issue', { values, operationId }), { code: 'OPERATION_RESOLVED' });
  state.failWrite = false;
  const saved = await run('save-issue', { values, operationId: randomUUID() }); assert.equal(saved.data.operation.status, 'confirmed'); assert.equal(state.writes, 2);
});
test('本机草稿离线持久化，恢复连接不自动写入', async t => {
  const { run, service, state } = await setup(t);
  await service.execute('bootstrap'); await run('read', { number: 1 }); state.online = false;
  const cached = await run('read', { number: 1 }); assert.equal(cached.offline, true); assert.equal(cached.data.issue.title, '原始标题');
  const saved = await run('draft-save', { number: 1, kind: 'comment', value: { text: '离线草稿', operationId: randomUUID() } });
  assert.equal(saved.data.drafts[`${repositoryKey}#1:comment`].text, '离线草稿');
  state.online = true; await service.execute('bootstrap'); assert.equal(state.writes, 0);
});
test('凭据变化或401不能回退上一个私有缓存，独立账号草稿隔离', async t => {
  const { run, service, state } = await setup(t);
  await run('list');
  await run('draft-save', { number: 1, kind: 'issue', value: { body: '账号8的私有草稿' } });
  state.user = { id: 9, login: 'other', credentialFingerprint: 'fingerprint9' }; state.online = false;
  await assert.rejects(service.execute('bootstrap'), { code: 'NETWORK_UNAVAILABLE' });
  state.online = true; const second = await service.execute('bootstrap'); assert.deepEqual(second.data.drafts, {});
  state.invalidAuth = true; await assert.rejects(service.execute('refresh'), { code: 'AUTH_REQUIRED' });
  state.invalidAuth = false; state.online = false; await assert.rejects(service.execute('bootstrap'), { code: 'NETWORK_UNAVAILABLE' });
});
test('查询在途切换身份时不返回旧账号结果', async t => {
  const { run, state } = await setup(t);
  state.onRequest = async (_method, path) => { if (path.endsWith('/issues/1')) state.user = { id: 9, login: 'other', credentialFingerprint: 'fingerprint9' }; };
  await assert.rejects(run('read', { number: 1 }), { code: 'IDENTITY_CHANGED' });
});
test('旧页面在账号切换后不能将输入写入新账号作用域', async t => {
  const { run, state, storage } = await setup(t);
  state.user = { id: 9, login: 'other', credentialFingerprint: 'fingerprint9' };
  await assert.rejects(run('draft-save', { number: 1, kind: 'issue', value: { body: '旧账号输入' } }), { code: 'IDENTITY_CHANGED' });
  assert.deepEqual(storage.list('github.com:9', 'draft'), []); assert.equal(state.writes, 0);
});
test('本人评论比较基线，拒绝其他Issue/其他作者的评论', async t => {
  const { run, state } = await setup(t);
  state.comments = [{ id: 40, body: '旧评论', user: { id: 8, login: 'member' }, issue_url: `https://api.github.com/repos/${fullName}/issues/1` }];
  await assert.rejects(run('save-comment', { number: 1, text: '新评论', commentId: 40, expectedText: '错误基线', operationId: randomUUID() }), { code: 'CONFLICT' });
  state.comments[0].user.id = 9;
  await assert.rejects(run('save-comment', { number: 1, text: '新评论', commentId: 40, expectedText: '旧评论', operationId: randomUUID() }), { code: 'PERMISSION_DENIED' });
  assert.equal(state.writes, 0);
});
test('标签负责人里程碑按当前仓库候选验证且要求管理权限', async t => {
  const { run, state } = await setup(t);
  const values = { number: 1, revision: state.issue.updated_at, labels: ['enhancement'], assignee: 'member', milestone: 'v1' };
  const saved = await run('save-issue', { values, operationId: randomUUID() });
  assert.deepEqual(saved.data.issue.labels, ['enhancement']); assert.equal(saved.data.issue.milestoneNumber, 4);
  state.manage = false;
  await assert.rejects(run('save-issue', { values: { number: 1, revision: state.issue.updated_at, labels: ['bug'] }, operationId: randomUUID() }), { code: 'PERMISSION_DENIED' });
  await assert.rejects(run('save-issue', { values: { number: 1, revision: state.issue.updated_at, labels: ['not-existing'] }, operationId: randomUUID() }), { code: 'INVALID_LABEL' });
});
test('恶意字段与任意仓库路径在服务边界拒绝', async t => {
  const { run, state } = await setup(t);
  await assert.rejects(run('save-issue', { values: { title: '标题', arbitraryUrl: 'https://evil.test' }, operationId: randomUUID() }), { code: 'INVALID_ARGUMENT' });
  await assert.rejects(run('list', { repositoryKey: '../anything' }), { code: 'INVALID_ARGUMENT' }); assert.equal(state.writes, 0);
});

test('仓库明确失权后离线不能再次读取旧私有缓存，草稿仍保留', async t => {
  const { run, state, storage } = await setup(t);
  await run('read', { number: 1 });
  await run('draft-save', { number: 1, kind: 'comment', value: { text: '未发布草稿' } });
  state.onRequest = async (_method, path) => { if (path === `/repos/${fullName}`) throw new ProofError('PERMISSION_DENIED', '权限已撤销'); };
  await assert.rejects(run('read', { number: 1 }), { code: 'PERMISSION_DENIED' });
  state.online = false;
  await assert.rejects(run('read', { number: 1 }), { code: 'OFFLINE_UNCACHED' });
  assert.equal(storage.list('github.com:8', 'draft')[0].value.text, '未发布草稿');
});

test('资源请求401同样撤销离线身份映射', async t => {
  const { run, state, service } = await setup(t);
  await run('read', { number: 1 });
  state.onRequest = async (_method, path) => { if (path === `/repos/${fullName}`) throw new ProofError('AUTH_REQUIRED', '资源身份失效'); };
  await assert.rejects(run('read', { number: 1 }), { code: 'AUTH_REQUIRED' });
  state.online = false;
  await assert.rejects(service.execute('bootstrap'), { code: 'NETWORK_UNAVAILABLE' });
});

test('Issue读回内容不一致不能误报保存确认', async t => {
  const { run, state } = await setup(t);
  state.onRequest = async (method, path) => { if (method === 'GET' && path.endsWith('/issues/1') && state.writes) state.issue.title = '其他成员已修改'; };
  await assert.rejects(run('save-issue', { values: { number: 1, title: '本次标题', revision: state.issue.updated_at }, operationId: randomUUID() }), error => error.code === 'READBACK_PENDING' && error.operation.status === 'readback-failed');
  assert.equal(state.writes, 1);
});

test('评论必须按真实ID读回一致正文，恢复检查不会重复发布', async t => {
  const { run, state } = await setup(t);
  let changed = true;
  state.onRequest = async (method, path) => { if (changed && method === 'GET' && path.includes('/issues/comments/')) state.comments[0].body = '远端另有修改'; };
  const operationId = randomUUID();
  await assert.rejects(run('save-comment', { number: 1, text: '本次评论', operationId }), error => error.code === 'READBACK_PENDING' && error.operation.verification.kind === 'comment');
  await assert.rejects(run('operation-resolve', { operationId, resolution: 'readback', confirmed: true }), { code: 'READBACK_MISMATCH' });
  assert.equal(state.writes, 1);
  changed = false; state.comments[0].body = '本次评论';
  const confirmed = await run('operation-resolve', { operationId, resolution: 'readback', confirmed: true });
  assert.equal(confirmed.data.operation.status, 'confirmed'); assert.equal(state.writes, 1);
});

async function aliasSetup(t, count = 2) {
  const { github, storage, state } = await setup(t);
  const directory = await temporary(t), names = Array.from({ length: count }, (_, index) => `team/alias-${index}`);
  const infos = names.map((name, index) => ({ cwd: join(directory, `clone-${index}`), repositories: [parseGithubRemote(`https://github.com/${name}.git`)] }));
  const catalog = createCatalog({ bridge: { request: async () => ({ data: [{ id: 'project', roots: [{ path: directory }] }], nextCursor: null }) }, discover: async () => ({ infos, warnings: [], authorizedRoot: directory }) });
  await catalog.refresh();
  const original = github.request; let canonicalName = fullName;
  github.request = async (method, path, body) => {
    if (method === 'GET' && names.some(name => path === `/repos/${name}`)) {
      if (state.metadataHook) await state.metadataHook();
      return { status: 200, headers: {}, data: { id: 11, name: canonicalName.split('/')[1], full_name: canonicalName, owner: { login: 'team' }, html_url: `https://github.com/${canonicalName}`, has_issues: true, permissions: { push: true } } };
    }
    return original(method, path.replace(`/repos/${canonicalName}`, `/repos/${fullName}`), body);
  };
  const service = createIssueService({ github, storage, catalog });
  return { service, catalog, github, storage, state, names, rename: name => canonicalName = name };
}

test('不同Git别名指向同稳定ID时导航合并且保留全部工作区', async t => {
  const { service, catalog } = await aliasSetup(t);
  const expectedKey = createHash('sha256').update('github.com:id:11').digest('hex').slice(0, 20);
  const result = await service.execute('refresh');
  assert.equal(result.data.repositories.length, 1); assert.equal(result.data.repositories[0].key, expectedKey);
  assert.equal(result.data.repositories[0].fullName, fullName); assert.equal(result.data.repositories[0].workspaces.length, 2);
  assert.equal(catalog.snapshot({ raw: true }).repositories.length, 2);
  assert.equal((await service.execute('list', { repositoryKey: expectedKey })).data.issues.length, 1);
});

test('仓库改名后规范key与已存草稿不变，刷新更新规范名称', async t => {
  const { service, rename } = await aliasSetup(t);
  const first = await service.execute('refresh'), key = first.data.repositories[0].key;
  await service.execute('draft-save', { repositoryKey: key, expectedIdentity: 8, number: 1, kind: 'issue', value: { body: '保留的正文草稿' } });
  rename('team/renamed');
  const next = await service.execute('refresh');
  assert.equal(next.data.repositories.length, 1); assert.equal(next.data.repositories[0].key, key); assert.equal(next.data.repositories[0].fullName, 'team/renamed');
  assert.equal(next.data.drafts[`${key}#1:issue`].body, '保留的正文草稿');
});

test('账号切换后失权仓库保留诊断项，不复用另一个账号元数据和Issue缓存', async t => {
  const { service, state, names } = await aliasSetup(t);
  const first = await service.execute('refresh');
  await service.execute('read', { repositoryKey: first.data.repositories[0].key, number: 1 });
  state.user = { id: 9, login: 'other', credentialFingerprint: 'fingerprint9' };
  state.metadataHook = async () => { throw new ProofError('PERMISSION_DENIED', '此账号无权读取'); };
  const second = await service.execute('refresh');
  assert.equal(second.data.repositories.length, 2); assert.equal(second.data.catalog.status, 'partial');
  for (const item of second.data.repositories) {
    assert.equal(item.access, 'unavailable'); assert.equal(item.id, null); assert.equal(item.permissions.read, false); assert.ok(names.includes(item.fullName));
    assert.equal(item.diagnostic.code, 'PERMISSION_DENIED'); assert.equal(Object.hasOwn(item, 'issueCount'), false);
  }
  assert.deepEqual(second.data.drafts, {});
});

test('仓库元信息查询在途切换身份时拒绝整轮归一结果', async t => {
  const { service, state, catalog } = await aliasSetup(t);
  state.metadataHook = async () => { state.user = { id: 9, login: 'other', credentialFingerprint: 'fingerprint9' }; };
  await assert.rejects(service.execute('refresh'), { code: 'IDENTITY_CHANGED' });
  assert.equal(catalog.snapshot().repositories.length, 2);
});

test('启动仓库元信息查询并发有界', async t => {
  const { service, state } = await aliasSetup(t, 8);
  let active = 0, maximum = 0;
  state.metadataHook = async () => { active++; maximum = Math.max(maximum, active); await new Promise(resolve => setImmediate(resolve)); active--; };
  const result = await service.execute('refresh'); assert.equal(result.data.repositories.length, 1); assert.ok(maximum > 1 && maximum <= 4);
});

test('仓库403后纯本机草稿与偏好仍可保存，关闭重开恢复且不返回读取缓存', async t => {
  const { service, catalog, github, storage, state } = await aliasSetup(t);
  const key = (await service.execute('refresh')).data.repositories[0].key;
  await service.execute('read', { repositoryKey: key, number: 1 });
  let metadataRequests = 0;
  state.onRequest = async (_method, path) => { if (path === `/repos/${fullName}`) { metadataRequests++; throw new ProofError('PERMISSION_DENIED', '权限已撤销'); } };
  await assert.rejects(service.execute('read', { repositoryKey: key, number: 1 }), { code: 'PERMISSION_DENIED' });
  metadataRequests = 0;
  const saved = await service.execute('draft-save', { repositoryKey: key, expectedIdentity: 8, number: 1, kind: 'comment', value: { text: '刚失权时尚未发布的输入' } });
  await service.execute('preference-save', { repositoryKey: key, expectedIdentity: 8, value: { query: '保留筛选', state: 'all' } });
  assert.equal(saved.data.drafts[`${key}#1:comment`].text, '刚失权时尚未发布的输入'); assert.equal(metadataRequests, 0);
  assert.deepEqual(storage.list('github.com:8', 'issue-raw'), []); assert.deepEqual(storage.list('github.com:8', 'issue-detail'), []);
  const directory = dirname(storage.filename); storage.close();
  const reopened = createStorage({ directory });
  try {
    await catalog.refresh();
    const next = createIssueService({ github, storage: reopened, catalog });
    const restored = await next.execute('local-state', { repositoryKey: key, expectedIdentity: 8 });
    assert.equal(restored.data.drafts[`${key}#1:comment`].text, '刚失权时尚未发布的输入');
    assert.equal(restored.data.preferences[key].query, '保留筛选'); assert.equal(metadataRequests, 0);
    assert.deepEqual(Object.keys(restored.data).sort(), ['drafts', 'preferences']);
    state.user = { id: 9, login: 'other', credentialFingerprint: 'fingerprint9' };
    await assert.rejects(next.execute('draft-save', { repositoryKey: key, expectedIdentity: 8, number: 1, kind: 'issue', value: { body: '旧账号输入' } }), { code: 'IDENTITY_CHANGED' });
    await assert.rejects(next.execute('local-state', { repositoryKey: key, expectedIdentity: 9 }), { code: 'REPOSITORY_UNVERIFIED' });
    assert.deepEqual(reopened.list('github.com:9', 'draft'), []);
  } finally { reopened.close(); }
});

test('纯本机保存不接收任意仓库key或未验证的Git别名', async t => {
  const { run, service, storage } = await setup(t);
  await assert.rejects(run('draft-save', { number: 1, kind: 'issue', value: { body: '无已确认仓库' } }), { code: 'REPOSITORY_UNVERIFIED' });
  await run('list');
  await assert.rejects(service.execute('draft-save', { repositoryKey: 'c'.repeat(20), expectedIdentity: 8, number: 1, kind: 'issue', value: { body: '任意仓库' } }), { code: 'REPOSITORY_UNVERIFIED' });
  assert.deepEqual(storage.list('github.com:8', 'draft'), []);
});

test('已确认Issue编辑用同一操作标识重放时返回原确认且不重复写入', async t => {
  const { run, state } = await setup(t);
  const operationId = randomUUID(), values = { number: 1, title: '已确认的新标题', body: '已确认的正文', revision: state.issue.updated_at };
  const first = await run('save-issue', { values, operationId });
  const replay = await run('save-issue', { values: { revision: values.revision, body: values.body, title: values.title, number: 1 }, operationId });
  assert.equal(replay.data.operation.status, 'confirmed'); assert.deepEqual(replay.data.issue, first.data.issue); assert.equal(state.writes, 1);
});

test('已确认本人评论编辑同ID重放不以旧正文基线误报冲突', async t => {
  const { run, state } = await setup(t);
  state.comments = [{ id: 40, body: '评论原文', user: { id: 8, login: 'member' }, issue_url: `https://api.github.com/repos/${fullName}/issues/1` }]; state.issue.comments = 1;
  const payload = { number: 1, text: '评论新文', commentId: 40, expectedText: '评论原文', operationId: randomUUID() };
  const first = await run('save-comment', payload), replay = await run('save-comment', payload);
  assert.equal(replay.data.operation.status, 'confirmed'); assert.deepEqual(replay.data.issue, first.data.issue); assert.equal(state.writes, 1);
});

test('已确认状态变更同ID重放不以旧revision误报冲突', async t => {
  const { run, state } = await setup(t);
  const payload = { number: 1, state: 'closed', revision: state.issue.updated_at, operationId: randomUUID() };
  const first = await run('change-state', payload), replay = await run('change-state', payload);
  assert.equal(replay.data.issue.state, 'closed'); assert.deepEqual(replay.data.operation, first.data.operation); assert.equal(state.writes, 1);
});

test('已确认请求同ID不同内容或不同Issue仍拒绝，新请求旧基线仍冲突', async t => {
  const { run, state, github } = await setup(t);
  const values = { number: 1, title: '确认过的标题', revision: state.issue.updated_at }, operationId = randomUUID();
  await run('save-issue', { values, operationId });
  await assert.rejects(run('save-issue', { values: { ...values, title: '换了其他内容' }, operationId }), { code: 'OPERATION_REUSED' });
  const original = github.request;
  github.request = async (method, path, body) => method === 'GET' && path.endsWith('/issues/2') ? { status: 200, headers: {}, data: { ...state.issue, id: 22, number: 2 } } : original(method, path, body);
  await assert.rejects(run('save-issue', { values: { ...values, number: 2 }, operationId }), { code: 'OPERATION_REUSED' });
  await assert.rejects(run('save-issue', { values, operationId: randomUUID() }), { code: 'CONFLICT' }); assert.equal(state.writes, 1);
});

test('已确认回执不能跨仓库重放或跨账号带入旧页面请求', async t => {
  const { run, service, state, github, catalog } = await setup(t);
  const values = { number: 1, title: '当前仓库标题', revision: state.issue.updated_at }, operationId = randomUUID();
  await run('save-issue', { values, operationId });
  const originalSnapshot = catalog.snapshot, originalRequest = github.request, otherKey = 'c'.repeat(20);
  catalog.snapshot = () => { const snapshot = originalSnapshot(); snapshot.repositories.push({ key: otherKey, fullName: 'team/other', workspaces: [] }); return snapshot; };
  github.request = async (method, path, body) => {
    if (path === '/repos/team/other') return { status: 200, headers: {}, data: { id: 99, name: 'other', full_name: 'team/other', permissions: { push: true }, has_issues: true } };
    if (method === 'GET' && path === '/repos/team/other/issues/1') return { status: 200, headers: {}, data: { ...state.issue, id: 99 } };
    return originalRequest(method, path, body);
  };
  await assert.rejects(service.execute('save-issue', { repositoryKey: otherKey, expectedIdentity: 8, values, operationId }), { code: 'OPERATION_REUSED' });
  state.user = { id: 9, login: 'other-member', credentialFingerprint: 'fingerprint9' };
  await assert.rejects(run('save-issue', { values, operationId }), { code: 'IDENTITY_CHANGED' }); assert.equal(state.writes, 1);
});

test('相同已确认请求仍需当前Issue权限和评论作者核验', async t => {
  const { run, state } = await setup(t);
  const values = { number: 1, title: '确认的标题', revision: state.issue.updated_at }, operationId = randomUUID();
  await run('save-issue', { values, operationId });
  state.manage = false; state.issue.user.id = 9;
  await assert.rejects(run('save-issue', { values, operationId }), { code: 'PERMISSION_DENIED' });
  state.manage = true; state.issue.user.id = 8;
  state.comments = [{ id: 40, body: '原评论', user: { id: 8, login: 'member' }, issue_url: `https://api.github.com/repos/${fullName}/issues/1` }]; state.issue.comments = 1;
  const comment = { number: 1, commentId: 40, text: '新评论', expectedText: '原评论', operationId: randomUUID() };
  await run('save-comment', comment); state.comments[0].user.id = 9;
  await assert.rejects(run('save-comment', comment), { code: 'PERMISSION_DENIED' }); assert.equal(state.writes, 2);
});

test('旧confirmed回执仅在原摘要可证明一致时兼容重放', async t => {
  const { run, state, storage } = await setup(t);
  const values = { number: 1, title: '兼容标题', body: '正文', labels: ['bug'], revision: state.issue.updated_at }, operationId = randomUUID();
  const first = await run('save-issue', { values, operationId });
  const prior = storage.get('github.com:8', 'operation', operationId); delete prior.requestSignature; storage.set('github.com:8', 'operation', operationId, prior);
  const replay = await run('save-issue', { values, operationId }); assert.deepEqual(replay.data.issue, first.data.issue); assert.equal(state.writes, 1);
  await assert.rejects(run('save-issue', { values: { ...values, body: '修改原本未变的字段' }, operationId }), { code: 'OPERATION_REUSED' });
  state.comments = [{ id: 40, body: '旧版评论', user: { id: 8, login: 'member' }, issue_url: `https://api.github.com/repos/${fullName}/issues/1` }]; state.issue.comments = 1;
  const comment = { number: 1, commentId: 40, text: '兼容新文', expectedText: '旧版评论', operationId: randomUUID() };
  await run('save-comment', comment);
  const oldComment = storage.get('github.com:8', 'operation', comment.operationId); delete oldComment.requestSignature; storage.set('github.com:8', 'operation', comment.operationId, oldComment);
  assert.equal((await run('save-comment', comment)).data.operation.status, 'confirmed'); assert.equal(state.writes, 2);
});

test('评论仅推进updatedAt时关闭与重开不误判为状态冲突', async t => {
  const { run, state } = await setup(t);
  const beforeComment = state.issue.updated_at;
  state.issue.updated_at = '2026-11-04T06:27:02Z'; state.issue.comments = 1;
  const closed = await run('change-state', { number: 1, state: 'closed', revision: beforeComment, operationId: randomUUID() });
  assert.equal(closed.data.issue.state, 'closed');
  const beforeActivity = closed.data.issue.revision; state.issue.updated_at = '2026-11-04T06:28:00Z';
  const opened = await run('change-state', { number: 1, state: 'open', revision: beforeActivity, operationId: randomUUID() });
  assert.equal(opened.data.issue.state, 'open'); assert.equal(state.writes, 2);
});

test('关闭仅改state且保留其他成员最新字段，真正状态变化仍冲突', async t => {
  const { run, state } = await setup(t), revision = state.issue.updated_at;
  state.issue = { ...state.issue, title: '其他成员的新标题', body: '其他成员的新正文', labels: [{ name: 'enhancement' }], updated_at: '2026-11-04T06:29:00Z' };
  const closed = await run('change-state', { number: 1, state: 'closed', revision, operationId: randomUUID() });
  assert.equal(closed.data.issue.title, '其他成员的新标题'); assert.equal(closed.data.issue.body, '其他成员的新正文'); assert.deepEqual(closed.data.issue.labels, ['enhancement']);
  await assert.rejects(run('change-state', { number: 1, state: 'closed', revision, operationId: randomUUID() }), { code: 'CONFLICT' }); assert.equal(state.writes, 1);
});

test('confirmed重放保留历史回执但返回最新Issue投影供后续写入', async t => {
  const { run, state } = await setup(t);
  state.comments = [{ id: 40, body: '评论原文', user: { id: 8, login: 'member' }, issue_url: `https://api.github.com/repos/${fullName}/issues/1` }]; state.issue.comments = 1;
  const payload = { number: 1, text: '编辑后的评论', commentId: 40, expectedText: '评论原文', operationId: randomUUID() };
  const first = await run('save-comment', payload);
  state.issue.updated_at = '2026-11-04T06:27:02Z';
  const replay = await run('save-comment', payload);
  assert.equal(replay.data.operation.issue.revision, first.data.issue.revision); assert.equal(replay.data.issue.revision, state.issue.updated_at);
  assert.equal(replay.data.projectionFresh, true); assert.equal(state.writes, 1);
});

test('confirmed重放新投影失败不降级成功回执，恢复只读忽略后续合法编辑差异', async t => {
  const { run, state, storage } = await setup(t);
  const values = { number: 1, title: '已经确认写入的标题', revision: state.issue.updated_at }, operationId = randomUUID();
  await run('save-issue', { values, operationId });
  let rawReads = 0;
  state.onRequest = async (method, path) => { if (method === 'GET' && path.endsWith('/issues/1') && ++rawReads >= 2) throw new ProofError('NETWORK_UNAVAILABLE', '连接暂不可用'); };
  const replay = await run('save-issue', { values, operationId });
  assert.equal(replay.data.issue, null); assert.equal(replay.data.operation.status, 'confirmed'); assert.equal(replay.data.projectionFresh, false); assert.ok(replay.data.readbackWarning.message);
  assert.equal(storage.get('github.com:8', 'operation', operationId).status, 'confirmed'); assert.equal(state.writes, 1);
  state.onRequest = null; state.issue.title = '之后成员合法修改的标题'; state.issue.updated_at = '2026-11-04T06:30:00Z';
  const restored = await run('operation-resolve', { operationId, resolution: 'readback', confirmed: true });
  assert.equal(restored.data.issue.title, '之后成员合法修改的标题'); assert.equal(restored.data.operation.issue.title, '已经确认写入的标题');
  assert.equal(restored.data.projectionFresh, true); assert.equal(state.writes, 1);
});

test('confirmed只读刷新期间身份变化仍拒绝回执结果', async t => {
  const { run, state } = await setup(t);
  const values = { number: 1, title: '当前账号确认的标题', revision: state.issue.updated_at }, operationId = randomUUID();
  await run('save-issue', { values, operationId });
  let rawReads = 0;
  state.onRequest = async (method, path) => { if (method === 'GET' && path.endsWith('/issues/1') && ++rawReads === 2) state.user = { id: 9, login: 'other-member', credentialFingerprint: 'fingerprint9' }; };
  await assert.rejects(run('save-issue', { values, operationId }), { code: 'IDENTITY_CHANGED' }); assert.equal(state.writes, 1);
});
