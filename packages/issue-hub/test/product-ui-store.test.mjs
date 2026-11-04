import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LiveStore, StoreError } from '../ui/store.mjs';
import { bodyMarkup, issueForm, safeUrl, taskText, taskAction, issueCountLabels } from '../ui/ui.mjs';

globalThis.crypto ||= { randomUUID };
const repo = { key: 'a'.repeat(20), fullName: 'team/repository', permissions: { createIssue: true, comment: true, manage: true }, workspaces: [] };
const account = { id: 42, login: 'member', name: '成员', initials: '成' };
const envelope = (data, identity = 42, extra = {}) => ({ schemaVersion: 1, identity, data, sampledAt: '2026-11-04T00:00:00Z', ...extra });
const bootstrap = (id = 42) => ({ account: { ...account, id }, repositories: [repo], catalog: { status: 'complete' }, drafts: {}, preferences: {} });
const issue = (extra = {}) => ({ id: 90, number: 7, title: '原始标题', body: '正文', state: 'open', revision: '2026-11-04T00:00:00Z', labels: ['bug'], assignee: 'one', assignees: ['one', 'two'], milestone: '', commentItems: [], activities: [], permissions: { edit: true, comment: true, manage: true, editOwnComment: true }, ...extra });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { resolve, reject, promise }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

test('较早网络失败不能覆盖较新严格读取的联网成功', async () => {
  const older = deferred();
  const store = new LiveStore(async (_group, action) => action === 'bootstrap' ? envelope(bootstrap()) : action === 'options' ? older.promise : envelope({ issue: issue() }, 42, { networkChecked: true, cached: false, offline: false }));
  await store.load();
  const first = store.request('query', 'options', { repositoryKey: repo.key });
  await store.request('query', 'read-summary', { repositoryKey: repo.key, number: 7 });
  older.reject(new StoreError('NETWORK_UNAVAILABLE', '旧连接失败')); await assert.rejects(first, { code: 'NETWORK_UNAVAILABLE' });
  assert.equal(store.online, true);
});

test('旧首次摘要成功不能覆盖后完成的严格摘要投影', async () => {
  const older = deferred();
  const store = new LiveStore(async (_group, action, payload) => action === 'bootstrap' ? envelope(bootstrap()) : payload.cacheFirst ? older.promise : envelope({ issue: issue({ body: '严格新正文', revision: 'new' }) }, 42, { networkChecked: true }));
  await store.load(); const initial = store.loadIssue(repo.fullName, 7, { summary: true, cacheFirst: true });
  await store.loadIssue(repo.fullName, 7, { summary: true });
  older.resolve(envelope({ issue: issue({ body: '旧缓存正文', revision: 'old' }) }, 42, { cached: true, networkChecked: false })); await initial;
  assert.equal(store.issue(repo.fullName, 7).body, '严格新正文'); assert.equal(store.issue(repo.fullName, 7).revision, 'new');
});

test('仓库raw键归一后，旧首次摘要仍不能绕过同Issue的新读取序号', async () => {
  const older = deferred(), canonical = { ...repo, key: 'b'.repeat(20), id: 99, sourceKeys: [repo.key] };
  const store = new LiveStore(async (_group, action, payload) => action === 'bootstrap' ? envelope(bootstrap()) : payload.cacheFirst ? older.promise : envelope({ issue: issue({ body: '规范仓库新正文', revision: 'new' }) }, 42, { networkChecked: true }));
  await store.load(); const initial = store.loadIssue(repo.fullName, 7, { summary: true, cacheFirst: true });
  store.applyBootstrap({ ...bootstrap(), repositories: [canonical] });
  await store.loadIssue(repo.fullName, 7, { summary: true });
  const rejected = assert.rejects(initial, { code: 'stale' });
  older.resolve(envelope({ issue: issue({ body: 'raw仓库旧正文', revision: 'old' }) }, 42, { cached: true, networkChecked: false })); await rejected;
  assert.equal(store.issue(repo.fullName, 7).body, '规范仓库新正文'); assert.equal(store.issue(repo.fullName, 7).revision, 'new');
});

test('缓存、本机写入和任务成功都不能冒充GitHub联网证据', async () => {
  const store = new LiveStore(async (_group, action) => action === 'bootstrap' ? envelope(bootstrap()) : envelope({}, 42, { networkChecked: false, cached: true }));
  await store.load(); store.online = false; const last = store.data.lastSuccess;
  for (const [group, action] of [['query', 'local-state'], ['mutate', 'draft-save'], ['task', 'latest']]) await store.request(group, action, { repositoryKey: repo.key });
  assert.equal(store.online, false); assert.equal(store.data.lastSuccess, last);
});

test('旧授权与失权错误仍须撤销数据，不被较新联网成功屏蔽', async () => {
  for (const code of ['AUTH_REQUIRED', 'PERMISSION_DENIED']) {
    const older = deferred(); let invalidated = 0;
    const store = new LiveStore(async (_group, action) => action === 'bootstrap' ? envelope(bootstrap()) : action === 'options' ? older.promise : envelope({}, 42, { networkChecked: true }), { onRepositoryAccessLost: () => invalidated++ });
    await store.load(); const first = store.request('query', 'options', { repositoryKey: repo.key });
    await store.request('query', 'read-summary', { repositoryKey: repo.key, number: 7 });
    older.reject(new StoreError(code, '授权失败')); await assert.rejects(first, { code });
    if (code === 'AUTH_REQUIRED') assert.equal(store.identity, null);
    else { assert.equal(invalidated, 1); assert.equal(store.repository(repo.fullName).access, 'unavailable'); }
  }
});

test('晚加入旧物理请求不能取得新序号并覆盖严格读取成功', async () => {
  const older = deferred(); let calls = 0;
  const store = new LiveStore(async (_group, action) => {
    if (action === 'bootstrap') return envelope(bootstrap());
    if (action === 'options') { calls++; return older.promise; }
    return envelope({ issue: issue() }, 42, { networkChecked: true, offline: false });
  });
  await store.load(); const first = store.request('query', 'options', { repositoryKey: repo.key });
  await store.request('query', 'read-summary', { repositoryKey: repo.key, number: 7 });
  const joined = store.request('query', 'options', { repositoryKey: repo.key });
  const failures = Promise.allSettled([first, joined]); older.reject(new StoreError('NETWORK_UNAVAILABLE', '旧请求超时')); await failures;
  assert.equal(calls, 1); assert.equal(store.online, true);
});

test('最新网络失败仍显示离线，旧成功不能回退最新成功时间', async () => {
  const older = deferred();
  const store = new LiveStore(async (_group, action) => action === 'bootstrap' ? envelope(bootstrap()) : action === 'options' ? older.promise : envelope({ issue: issue() }, 42, { networkChecked: true, sampledAt: '2026-11-05T12:00:00Z' }));
  await store.load(); const first = store.request('query', 'options', { repositoryKey: repo.key });
  await store.request('query', 'read-summary', { repositoryKey: repo.key, number: 7 }); const successTime = store.data.lastSuccess;
  older.resolve(envelope({}, 42, { networkChecked: true, sampledAt: '2026-11-05T01:00:00Z' })); await first;
  assert.equal(store.data.lastSuccess, successTime);
  store.call = async () => { throw new StoreError('NETWORK_UNAVAILABLE', '最新连接失败'); };
  await assert.rejects(store.request('query', 'activity', { repositoryKey: repo.key, number: 7 }), { code: 'NETWORK_UNAVAILABLE' });
  assert.equal(store.online, false);
});

test('冷目录选仓记忆在规范key替换后仍指向用户最后选择的仓库', async () => {
  const rawKey = 'b'.repeat(20), stableKey = 'c'.repeat(20), second = { ...repo, key: rawKey, fullName: 'team/second' };
  let normalized = false, persisted;
  const data = () => ({ ...bootstrap(), repositories: [repo, normalized ? { ...second, key: stableKey, sourceKeys: [rawKey] } : second] });
  const store = new LiveStore(async (_group, action, payload) => {
    if (action === 'bootstrap' || action === 'refresh') return envelope(data());
    if (!normalized) throw new StoreError('REPOSITORY_UNVERIFIED', '等待元信息');
    persisted = payload.value; return envelope({ viewState: persisted });
  });
  await store.load();
  await assert.rejects(store.saveViewState({ repositoryKey: rawKey }), { code: 'REPOSITORY_UNVERIFIED' });
  normalized = true; await store.refreshCatalog();
  assert.equal(store.preferredRepository(), second.fullName); assert.equal(store.viewState.repositoryKey, stableKey);
  await store.saveViewState({ repositoryKey: store.repositoryKey(second.fullName) });
  assert.equal(persisted.repositoryKey, stableKey);
  const reopened = new LiveStore(async () => envelope({ ...data(), viewState: persisted }));
  await reopened.load(); assert.equal(reopened.preferredRepository(), second.fullName);
});

test('同仓库冷别名归一迁移详情与草稿，不触发失权清理', async () => {
  const raw = { ...repo, fullName: 'team/old-name' }, canonical = { ...repo, key: 'd'.repeat(20), id: 99, fullName: 'Team/new-name', sourceKeys: [repo.key], sourceNames: [raw.fullName] };
  let lost = 0;
  const store = new LiveStore(async () => envelope({ ...bootstrap(), repositories: [raw] }), { onRepositoryAccessLost: () => lost++ });
  await store.load(); store.installIssue(raw.fullName, issue({ body: '已经读到的正文' }));
  store.retainDraft(raw.fullName, 7, 'comment', { text: '尚未发布的输入' });
  store.pages[raw.fullName] = { complete: true };
  store.applyBootstrap({ ...bootstrap(), repositories: [canonical] });
  assert.equal(lost, 0); assert.equal(store.issue(canonical.fullName, 7).body, '已经读到的正文');
  assert.equal(store.issue(raw.fullName, 7).body, '已经读到的正文');
  assert.equal(store.commentDraft(canonical.fullName, 7).text, '尚未发布的输入');
  assert.equal(store.pages[canonical.fullName].complete, true);
});

test('迟到的待检查目录不删除用户已选仓库和已经读取的正文', async () => {
  const second = { ...repo, key: 'b'.repeat(20), fullName: 'team/second' };
  const store = new LiveStore(async () => envelope({ ...bootstrap(), repositories: [repo, second] }));
  await store.load(); store.activeRepo = second.fullName; store.installIssue(second.fullName, issue({ body: '用户已选正文' }));
  store.applyBootstrap({ ...bootstrap(), repositories: [repo], refreshNeeded: true, catalog: { status: 'partial', checking: true } });
  assert.equal(store.repository(second.fullName).key, second.key);
  assert.equal(store.issue(second.fullName, 7).body, '用户已选正文');
});

test('后台旧列表不能覆盖写后新标题，也不能移除刚创建的Issue', async () => {
  const waiting = deferred();
  const store = new LiveStore(async (_group, action, payload) => {
    if (action === 'bootstrap') return envelope(bootstrap());
    if (action === 'list') return waiting.promise;
    return envelope({ issue: issue({ number: payload.values.number || 8, title: payload.values.title || '新标题', revision: '2026-11-04T02:00:00Z' }) });
  });
  await store.load(); store.installIssue(repo.fullName, issue());
  const listing = store.loadRepository(repo.fullName);
  await store.saveIssue(repo.fullName, { ...issue(), title: '已保存的新标题' });
  await store.saveIssue(repo.fullName, { title: '刚创建的Issue', body: '' });
  waiting.resolve(envelope({ repository: repo, issues: [issue()], pageInfo: { complete: true } })); await listing;
  assert.equal(store.issue(repo.fullName, 7).title, '已保存的新标题');
  assert.equal(store.issue(repo.fullName, 8).title, '刚创建的Issue');
});

test('打开结果未知的现有请求显示核对入口，不误导为新建', () => {
  assert.equal(taskAction('open-unconfirmed'), '核对打开结果');
  assert.equal(taskAction(null), '创建任务');
});

test('未加载或不可访问的数量不是零，部分加载与已确认空仓库分别展示', () => {
  assert.deepEqual(issueCountLabels([]), { open: '—', closed: '—', all: '—' });
  assert.deepEqual(issueCountLabels([issue()], { known: true }), { open: '1+', closed: '0+', all: '1+' });
  assert.deepEqual(issueCountLabels([], { known: true, complete: true }), { open: '0', closed: '0', all: '0' });
});

test('在线元数据缓存不冒充离线', async () => {
  const store = new LiveStore(async () => envelope(bootstrap(), 42, { offline: false, cached: true }));
  await store.load(); assert.equal(store.online, true);
});

test('创建任务先核对缓存目录，只有真实query成功才解除离线并自动继续', async () => {
  const calls = [];
  const store = new LiveStore(async (group, action) => {
    calls.push([group, action]);
    if (action === 'bootstrap') return envelope({ ...bootstrap(), refreshNeeded: true, catalog: { status: 'partial', checking: true } }, 42, { offline: true, cached: true, networkChecked: false });
    if (action === 'refresh') return envelope({ ...bootstrap(), refreshNeeded: false }, 42, { offline: false, networkChecked: true });
    return envelope({ current: { requestId: 'new', status: 'requested' } });
  });
  await store.load(); assert.equal(store.online, false);
  await store.createTask(repo.fullName, 7);
  assert.equal(store.online, true); assert.equal(store.catalog.checking, undefined);
  assert.deepEqual(calls, [['query', 'bootstrap'], ['query', 'refresh'], ['task', 'open']]);
});

test('目录核对失败保留离线和本机输入，不调用打开任务', async () => {
  const calls = [];
  const store = new LiveStore(async (group, action) => {
    calls.push([group, action]);
    return envelope({ ...bootstrap(), refreshNeeded: true, catalog: { status: 'unavailable', checking: true, error: { code: 'HOST_UNAVAILABLE', message: '项目接口暂不可用' } } }, 42, { offline: true, cached: true, networkChecked: false });
  });
  await store.load(); store.retainDraft(repo.fullName, 7, 'comment', { text: '输入保留' });
  await assert.rejects(store.createTask(repo.fullName, 7), { code: 'HOST_UNAVAILABLE' });
  assert.equal(store.online, false); assert.equal(store.commentDraft(repo.fullName, 7).text, '输入保留');
  assert.ok(calls.every(([group]) => group === 'query'));
});

test('核对目录期间GitHub账号变化后不得在新账号下继续旧任务', async () => {
  const calls = [];
  const store = new LiveStore(async (group, action) => {
    calls.push([group, action]);
    return action === 'bootstrap' ? envelope({ ...bootstrap(), refreshNeeded: true, catalog: { status: 'partial', checking: true } }) : envelope({ ...bootstrap(99), refreshNeeded: false }, 99);
  });
  await store.load();
  await assert.rejects(store.createTask(repo.fullName, 7), { code: 'stale' });
  assert.equal(store.identity, 99); assert.ok(calls.every(([group]) => group === 'query'));
});

for (const action of ['createTask', 'bind']) {
  test(`已就绪目录的${action}让出执行期间切账号不能借新身份继续旧操作`, async () => {
    const calls = [];
    const store = new LiveStore(async (group, method) => {
      calls.push([group, method]);
      return method === 'bootstrap' ? envelope(bootstrap()) : envelope({ current: null, binding: null }, 99);
    });
    await store.load();
    const pending = action === 'createTask' ? store.createTask(repo.fullName, 7) : store.bind(repo.fullName, 'b'.repeat(20));
    store.clearIdentity(99); store.applyBootstrap(bootstrap(99));
    await assert.rejects(pending, { code: 'stale' });
    assert.ok(calls.every(([group]) => group === 'query'));
  });
}

test('任务恢复不冒充GitHub重新连接或更新最后成功时间', async () => {
  const store = new LiveStore(async (group, action) => {
    if (action === 'bootstrap') return envelope(bootstrap(), 42, { offline: false, cached: true });
    if (group === 'task') return envelope({ current: null, history: [] });
    return envelope({ issue: issue() }, 42, { offline: true, cached: true });
  });
  await store.load(); assert.equal(store.online, true);
  await store.loadIssue(repo.fullName, 7); assert.equal(store.online, false);
  const before = store.data.lastSuccess;
  await store.loadTask(repo.fullName, 7);
  assert.equal(store.online, false); assert.equal(store.data.lastSuccess, before);
});

test('真实仓库列表分页保留已加载结果且不把一页标为全部', async () => {
  const calls = [];
  const store = new LiveStore(async (group, action, payload) => {
    calls.push({ group, action, payload });
    if (action === 'bootstrap') return envelope(bootstrap());
    return envelope({ repository: repo, issues: [issue({ number: payload.cursor ? 8 : 7 })], pageInfo: payload.cursor ? { complete: true } : { complete: false, nextCursor: '2' } });
  });
  await store.load(); await store.loadRepository(repo.fullName); assert.equal(store.pages[repo.fullName].complete, false);
  await store.loadRepository(repo.fullName, { more: true });
  assert.deepEqual(store.list(repo.fullName).map(row => row.number), [8, 7]);
  assert.equal(calls.at(-1).payload.cursor, '2'); assert.equal(store.pages[repo.fullName].complete, true);
});

test('过期初始工具结果不能覆盖显式读取后的账号与仓库', async () => {
  const store = new LiveStore(async () => envelope(bootstrap())); await store.load();
  assert.equal(store.acceptBootstrap(envelope(bootstrap(99), 99)), false);
  assert.equal(store.account.id, 42); assert.equal(store.identity, 42);
});

test('同版本列表刷新保留已加载详情评论和分页覆盖', async () => {
  const detail = issue({ commentItems: [{ id: 1, text: '已加载讨论' }], activities: [{ id: 2, text: '已有活动' }], coverage: { comments: { loaded: 1, complete: true } } });
  const store = new LiveStore(async (_group, action) => {
    if (action === 'bootstrap') return envelope(bootstrap());
    if (action === 'read') return envelope({ issue: detail });
    return envelope({ repository: repo, issues: [issue()], pageInfo: { complete: true } });
  });
  await store.load(); await store.loadIssue(repo.fullName, 7); await store.loadRepository(repo.fullName);
  assert.equal(store.issue(repo.fullName, 7).commentItems[0].text, '已加载讨论');
  assert.equal(store.issue(repo.fullName, 7).coverage.comments.loaded, 1);
});

test('编辑中版本变化和首屏换页仍保留已读讨论与草稿，明确标记旧详情', async () => {
  let phase = 'before';
  const detail = issue({ commentItems: [{ id: 1, text: '已读评论' }], activities: [{ id: 2, text: '已读活动' }], coverage: { comments: { loaded: 1, complete: true } } });
  const store = new LiveStore(async (_group, action) => {
    if (action === 'bootstrap') return envelope(bootstrap());
    if (action === 'read') return envelope({ issue: phase === 'before' ? detail : { ...detail, revision: '2026-11-04T01:00:00Z', commentItems: [{ id: 1, text: '远端新评论' }] } });
    return envelope({ repository: repo, issues: phase === 'outside' ? [issue({ number: 8 })] : [issue({ revision: '2026-11-04T01:00:00Z' })], pageInfo: { complete: false, nextCursor: '2' } });
  });
  await store.load(); store.activeNumber = 7; await store.loadIssue(repo.fullName, 7);
  const draftKey = `${repo.key}#7:comment`;
  store.data.drafts[draftKey] = { text: '正在编辑的评论草稿', baseText: '已读评论' };
  phase = 'changed'; await store.loadRepository(repo.fullName);
  assert.equal(store.issue(repo.fullName, 7).commentItems[0].text, '已读评论');
  assert.equal(store.issue(repo.fullName, 7).activities[0].text, '已读活动');
  assert.equal(store.issue(repo.fullName, 7).detailStale, true);
  assert.equal(store.commentDraft(repo.fullName, 7).text, '正在编辑的评论草稿');
  phase = 'outside'; await store.loadRepository(repo.fullName);
  assert.equal(store.issue(repo.fullName, 7).commentItems[0].text, '已读评论');
  await store.loadIssue(repo.fullName, 7);
  assert.equal(store.issue(repo.fullName, 7).detailStale, false);
  assert.equal(store.issue(repo.fullName, 7).commentItems[0].text, '远端新评论');
  assert.equal(store.commentDraft(repo.fullName, 7).text, '正在编辑的评论草稿');
});

test('账号切换先清除私有投影，旧账号在途响应不能恢复它', async () => {
  const waiting = deferred(); let changes = 0;
  const store = new LiveStore(async (_group, action) => action === 'bootstrap' ? envelope(bootstrap()) : waiting.promise, { onIdentityChange: () => changes++ });
  await store.load(); store.installIssue(repo.fullName, issue());
  const pending = store.loadIssue(repo.fullName, 7);
  store.clearIdentity(99); waiting.resolve(envelope({ issue: issue({ body: '旧账号私有正文' }) }));
  await assert.rejects(pending, error => error.code === 'stale');
  assert.equal(store.list(repo.fullName).length, 0); assert.equal(changes, 1); assert.equal(store.account.login, '');
});

test('旧账号迟到的授权错误不能清除新账号投影', async () => {
  const waiting = deferred();
  const store = new LiveStore(async (_group, action) => action === 'bootstrap' ? envelope(bootstrap()) : waiting.promise);
  await store.load(); const pending = store.loadIssue(repo.fullName, 7);
  store.clearIdentity(99); store.applyBootstrap(bootstrap(99));
  waiting.reject(new StoreError('AUTH_REQUIRED', '旧账号授权失败'));
  await assert.rejects(pending, { code: 'stale' });
  assert.equal(store.identity, 99); assert.equal(store.account.id, 99);
});

test('Codex宿主错误不清GitHub账号正文或伪造GitHub断网，目录失败缓存仍可展示', async () => {
  let changes = 0, failure = 'HOST_IDENTITY_CHANGED';
  const store = new LiveStore(async (group, action) => {
    if (action === 'bootstrap') return envelope(bootstrap());
    if (group === 'task') throw new StoreError(failure, 'Codex上下文变化');
    if (action === 'refresh') return envelope({ ...bootstrap(), refreshNeeded: true, catalog: { status: 'unavailable', checking: true, error: { code: 'HOST_UNAVAILABLE' } } }, 42, { cached: true, networkChecked: true });
    return envelope({ issue: issue({ body: '已读GitHub正文' }) });
  }, { onIdentityChange: () => changes++ });
  await store.load(); await store.loadIssue(repo.fullName, 7);
  for (const code of ['HOST_IDENTITY_CHANGED', 'HOST_IDENTITY_UNAVAILABLE', 'HOST_UNAVAILABLE']) {
    failure = code; await assert.rejects(store.loadTask(repo.fullName, 7), { code });
    assert.equal(store.identity, 42); assert.equal(store.online, true); assert.equal(store.issue(repo.fullName, 7).body, '已读GitHub正文');
  }
  await store.refreshCatalog();
  assert.equal(store.catalog.error.code, 'HOST_UNAVAILABLE'); assert.equal(store.list(repo.fullName).length, 1); assert.equal(changes, 0);
});

test('同名称仓库失权刷新清读取投影并保留原账号未发布草稿', async () => {
  let unavailable = false, invalidations = 0, store;
  store = new LiveStore(async (_group, action) => {
    if (action === 'bootstrap') return envelope({ ...bootstrap(), repositories: [{ ...repo, ...(unavailable ? { access: 'unavailable', permissions: { read: false } } : {}) }] });
    return envelope({ issue: issue({ body: '旧私有正文' }) });
  }, { onRepositoryAccessLost: name => { invalidations++; store.retainDraft(name, 7, 'comment', { text: '尚未发布的当前输入' }); } });
  await store.load(); await store.loadIssue(repo.fullName, 7);
  store.pages[repo.fullName] = { complete: true }; store.taskRecords[`${repo.fullName}#7`] = { current: { title: '旧关联' } };
  unavailable = true; await store.load();
  assert.equal(store.issue(repo.fullName, 7), undefined); assert.equal(store.pages[repo.fullName], undefined);
  assert.equal(store.task(repo.fullName, 7).current, null); assert.equal(invalidations, 1);
  assert.equal(store.commentDraft(repo.fullName, 7).text, '尚未发布的当前输入');
  await store.load(); assert.equal(store.commentDraft(repo.fullName, 7).text, '尚未发布的当前输入');
  store.clearIdentity(99); store.applyBootstrap(bootstrap(99));
  assert.equal(store.commentDraft(repo.fullName, 7), null);
});

test('失权时较旧草稿的迟到保存不能覆盖刚保留的新输入', async () => {
  const first = deferred(); let saves = 0;
  const store = new LiveStore(async (_group, action) => {
    if (action === 'bootstrap') return envelope(bootstrap());
    saves++; if (saves === 1) return first.promise;
    throw new StoreError('storage', '本机持久化失败');
  });
  await store.load();
  const old = store.saveDraft(repo.fullName, 7, 'comment', { text: '较旧输入' }); await tick();
  store.retainDraft(repo.fullName, 7, 'comment', { text: '失权时最新输入' });
  const current = store.saveDraft(repo.fullName, 7, 'comment', { text: '失权时最新输入' });
  const failed = assert.rejects(current, { code: 'storage' });
  first.resolve(envelope({})); await old; await failed;
  assert.equal(store.commentDraft(repo.fullName, 7).text, '失权时最新输入');
});

test('读取明确失权立即通知隐藏详情，写权限不足不误清读取内容', async () => {
  let mode = 'read', hidden = 0;
  const store = new LiveStore(async (group, action) => {
    if (action === 'bootstrap') return envelope(bootstrap());
    throw new StoreError('PERMISSION_DENIED', mode === 'read' ? '读取失权' : '写入不足');
  }, { onRepositoryAccessLost: () => hidden++ });
  await store.load(); store.installIssue(repo.fullName, issue());
  await assert.rejects(store.loadIssue(repo.fullName, 7), { code: 'PERMISSION_DENIED' });
  assert.equal(hidden, 1); assert.equal(store.issue(repo.fullName, 7), undefined);
  mode = 'write'; store.installIssue(repo.fullName, issue());
  await assert.rejects(store.saveComment(repo.fullName, 7, '正文'), { code: 'PERMISSION_DENIED' });
  assert.equal(hidden, 1); assert.equal(store.issue(repo.fullName, 7).title, '原始标题');
});

test('所有远端与本机写入绑定页面已确认的稳定身份', async () => {
  const calls = [];
  const store = new LiveStore(async (group, action, payload) => {
    calls.push({ group, action, payload });
    if (action === 'bootstrap') return envelope(bootstrap());
    if (action === 'save-issue') return envelope({ issue: issue(), operation: { state: 'confirmed' } });
    return envelope({});
  });
  await store.load(); store.activeRepo = repo.fullName; store.installIssue(repo.fullName, issue());
  await store.saveDraft(repo.fullName, 7, 'comment', { text: '未发布' });
  await store.savePreference(repo.fullName, { query: 'test' });
  await store.saveIssue(repo.fullName, issue({ title: '调整标题' }));
  assert.ok(calls.filter(call => call.group === 'mutate').every(call => call.payload.expectedIdentity === '42'));
});

test('同一草稿串行保存，失败后仍可保存新输入', async () => {
  const first = deferred(); let calls = 0;
  const store = new LiveStore(async (_group, action) => {
    if (action === 'bootstrap') return envelope(bootstrap());
    calls++; return calls === 1 ? first.promise : envelope({});
  });
  await store.load();
  const old = store.saveDraft(repo.fullName, 7, 'comment', { text: '旧输入' });
  const current = store.saveDraft(repo.fullName, 7, 'comment', { text: '新输入' });
  await tick(); assert.equal(calls, 1);
  first.reject(new StoreError('STORAGE_FAILED', '写入失败')); await assert.rejects(old);
  await current; assert.equal(store.draft(repo.fullName, 7, 'comment').text, '新输入');
});

test('长评论Issue编辑草稿只保存输入和最小基线，不重复塞入整段讨论', async () => {
  let submitted;
  const store = new LiveStore(async (_group, action, payload) => {
    if (action === 'bootstrap') return envelope(bootstrap());
    submitted = payload.value; return envelope({});
  });
  await store.load();
  const source = issue({ commentItems: [{ id: 1, text: '长评论'.repeat(180000) }], activities: [{ id: 2, text: '活动' }] });
  await store.saveDraft(repo.fullName, 7, 'issue', { ...source, body: '正在编辑的正文', _base: source });
  assert.equal(submitted.body, '正在编辑的正文'); assert.equal(submitted._base.body, '正文');
  assert.equal(submitted.revision, source.revision); assert.deepEqual(submitted.labels, ['bug']);
  assert.equal(Object.hasOwn(submitted, 'commentItems'), false); assert.equal(Object.hasOwn(submitted._base, 'commentItems'), false);
  assert.ok(Buffer.byteLength(JSON.stringify(submitted)) < 512 * 1024);
});

test('排队草稿在账号变化后不发送到新账号', async () => {
  const first = deferred(); let calls = 0;
  const store = new LiveStore(async (_group, action) => {
    if (action === 'bootstrap') return envelope(bootstrap()); calls++; return first.promise;
  });
  await store.load();
  const p1 = store.saveDraft(repo.fullName, 7, 'comment', { text: '旧输入' });
  const p2 = store.saveDraft(repo.fullName, 7, 'comment', { text: '另一个旧输入' });
  const rejected = [assert.rejects(p1), assert.rejects(p2)];
  await tick(); store.clearIdentity(99); first.resolve(envelope({})); await Promise.all(rejected);
  assert.equal(calls, 1); assert.equal(Object.keys(store.data.drafts).length, 0);
});

test('标题编辑只提交变化元数据，保留多个负责人', async () => {
  let payload;
  const store = new LiveStore(async (_group, action, input) => action === 'bootstrap' ? envelope(bootstrap()) : (payload = input, envelope({ issue: issue() })));
  await store.load(); store.installIssue(repo.fullName, issue());
  await store.saveIssue(repo.fullName, { ...issue(), title: '新的标题', _base: issue() });
  assert.equal(payload.values.assignee, undefined); assert.equal(payload.values.labels, undefined); assert.equal(payload.values.milestone, undefined);
  assert.equal(payload.values._base, undefined); assert.equal(payload.values.title, '新的标题');
});

test('未知创建重试复用操作标识，不因按钮重按生成新的提交', async () => {
  const ids = [];
  const store = new LiveStore(async (_group, action, payload) => {
    if (action === 'bootstrap') return envelope(bootstrap());
    ids.push(payload.operationId); throw new StoreError('OPERATION_UNKNOWN', '结果未知，先核对 GitHub');
  });
  await store.load();
  const values = { title: '创建新任务', body: '内容', labels: [], assignee: '', milestone: '' };
  await assert.rejects(store.saveIssue(repo.fullName, values)); await assert.rejects(store.saveIssue(repo.fullName, values));
  assert.equal(ids.length, 2); assert.equal(ids[0], ids[1]);
});

test('刷新和恢复网络只读取，不自动发布草稿', async () => {
  const groups = [];
  const store = new LiveStore(async (group, action) => {
    groups.push(group);
    if (action === 'bootstrap') return envelope(bootstrap());
    return envelope({ repository: repo, issues: [issue()], pageInfo: { complete: true } });
  });
  await store.load(); store.online = false; await store.refresh({ repo: repo.fullName });
  assert.ok(groups.every(group => group === 'query')); assert.equal(store.online, true);
});

test('评论继续分页按真实ID去重，保存覆盖状态', async () => {
  const store = new LiveStore(async (_group, action) => action === 'bootstrap' ? envelope(bootstrap()) : envelope({ items: [{ id: 2, text: '第二条' }], pageInfo: { complete: true, loaded: 2 } }));
  await store.load(); store.installIssue(repo.fullName, issue({ commentItems: [{ id: 1, text: '第一条' }, { id: 2, text: '第二条' }], coverage: { comments: { complete: false, nextCursor: '2' } } }));
  await store.loadMore(repo.fullName, 7, 'comments');
  assert.equal(store.issue(repo.fullName, 7).commentItems.length, 2);
  assert.equal(store.issue(repo.fullName, 7).coverage.comments.complete, true);
});

test('后续活动页及时合并关联PR并按真实URL去重，覆盖数量为累计值', async () => {
  const firstUrl = 'https://github.com/team/repository/pull/11', laterUrl = 'https://github.com/team/repository/pull/12';
  const store = new LiveStore(async (_group, action, payload) => {
    if (action === 'bootstrap') return envelope(bootstrap());
    assert.equal(action, 'activity');
    return envelope(payload.cursor ? { items: [
      { id: 2, sourceIsPr: true, sourceUrl: firstUrl, text: '相同PR的另一条活动' },
      { id: 3, sourceIsPr: true, sourceUrl: laterUrl, text: '第二页才有的PR' },
      { id: 4, sourceIsPr: false, sourceUrl: 'https://github.com/team/repository/issues/8', text: '普通Issue引用' },
    ], pageInfo: { complete: true, loaded: 3, page: 2, nextCursor: null } } : { items: [{ id: 1, sourceIsPr: true, sourceUrl: firstUrl, text: '第一条PR' }], pageInfo: { complete: false, loaded: 1, page: 1, nextCursor: '2' } });
  });
  await store.load(); store.installIssue(repo.fullName, issue());
  await store.loadDiscussion(repo.fullName, 7, 'activity');
  await store.loadMore(repo.fullName, 7, 'activity');
  const result = store.issue(repo.fullName, 7);
  assert.deepEqual(result.relatedPr.map(item => item.url), [firstUrl, laterUrl]);
  assert.equal(result.activities.length, 4); assert.equal(result.coverage.activity.loaded, 4); assert.equal(result.coverage.activity.complete, true);
});

test('任务调用不提供模拟发送或猜测关联，只使用真实服务状态', async () => {
  const actions = [];
  const current = { id: randomUUID(), requestId: randomUUID(), status: 'pending', title: '任务' };
  const store = new LiveStore(async (group, action, payload) => {
    if (action === 'bootstrap') return envelope(bootstrap());
    actions.push({ group, action, payload }); return envelope({ current, history: [], workspaces: [], binding: null });
  });
  await store.load(); await store.loadTask(repo.fullName, 7); await store.createTask(repo.fullName, 7); await store.checkTask(repo.fullName, 7);
  assert.deepEqual(actions.map(call => call.action), ['latest', 'open', 'check']);
  assert.ok(actions.every(call => call.payload.expectedIdentity === '42')); assert.equal(store.task(repo.fullName, 7).current.status, 'pending');
});

test('不可信Markdown保持可读且脚本、图片和危险协议不能执行', () => {
  const html = bodyMarkup('# 标题\n\n<script>alert(1)</script>\n\n[安全](https://github.com/team/repository/issues/7)\n\n![附件](https://example.com/image.png)\n\n[危险](javascript:alert(1))\n\n```js\n<img onerror=alert(1)>\n```');
  assert.match(html, /<h2>标题<\/h2>/); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script|<img|href="javascript:/);
  assert.match(html, /data-action="open-link"/); assert.equal(safeUrl('https://user:password@github.com/'), null);
  assert.equal(safeUrl('javascript:alert(1)'), null); assert.match(taskText('requested'), /打开草稿/);
});

test('属性编辑与正文编辑分开授权，现有属性不因候选缺页消失', () => {
  const html = issueForm(issue(), { labels: [], assignees: [''], milestones: [''] }, { isNew: false, offline: false, manage: false });
  assert.match(html, /<fieldset disabled>/); assert.match(html, /value="bug" checked/); assert.match(html, /id="issue-assignee"[^>]+disabled/);
  assert.match(html, /id="issue-body"/);
});

test('人工解除未知回执不会立即发布，下次明确提交才生成新ID', async () => {
  const calls = []; let unknownId;
  const store = new LiveStore(async (group, action, payload) => {
    calls.push({ group, action, payload });
    if (action === 'bootstrap') return envelope(bootstrap());
    if (action === 'operation-resolve') return envelope({ operation: { id: unknownId, status: 'resolved-not-created' } });
    unknownId ||= payload.operationId;
    throw new StoreError('OPERATION_UNKNOWN', '结果待核对', { operation: { id: payload.operationId, status: 'unknown' } });
  });
  await store.load();
  const values = { title: '待确认创建', body: '内容', labels: [], assignee: '', milestone: '' };
  await assert.rejects(store.saveIssue(repo.fullName, values));
  await store.resolveOperation(repo.fullName, { id: unknownId, status: 'unknown' }, 'not-created');
  assert.deepEqual(calls.map(call => call.action), ['bootstrap', 'save-issue', 'operation-resolve']);
  assert.equal(calls.at(-1).payload.confirmed, true); assert.equal(calls.at(-1).payload.expectedIdentity, '42');
  await assert.rejects(store.saveIssue(repo.fullName, values));
  assert.notEqual(calls.at(-1).payload.operationId, unknownId);
});

test('已接受写入的重新读回只读结果，不调用创建或编辑接口', async () => {
  const actions = [];
  const store = new LiveStore(async (_group, action) => {
    actions.push(action);
    if (action === 'bootstrap') return envelope(bootstrap());
    return envelope({ issue: issue({ body: '已接受的内容' }), operation: { id: 'known', status: 'confirmed' } });
  });
  await store.load();
  await store.resolveOperation(repo.fullName, { id: 'known', status: 'readback-failed' }, 'readback');
  assert.deepEqual(actions, ['bootstrap', 'operation-resolve']);
  assert.equal(store.issue(repo.fullName, 7).body, '已接受的内容');
});

test('首页消费宿主已送达的bootstrap，不重复请求身份与目录', async () => {
  let calls = 0;
  const store = new LiveStore(async () => { calls++; return envelope(bootstrap()); });
  store.acceptBootstrap(envelope({ ...bootstrap(), viewState: { repositoryKey: repo.key, navigationWidth: 220, queueWidth: 360 }, checking: { catalog: true }, refreshNeeded: true }, 42, { cached: true, networkChecked: false }));
  await store.load();
  assert.equal(calls, 0); assert.equal(store.preferredRepository(), repo.fullName);
  assert.equal(store.viewState.navigationWidth, 220); assert.equal(store.refreshNeeded, true);
  assert.equal(store.data.lastSuccess, '缓存，待后台检查');
});

test('列宽与上次仓库走稳定账号的本机偏好，切账号即清旧值', async () => {
  const calls = [];
  const store = new LiveStore(async (_group, action, payload) => {
    calls.push({ action, payload }); return action === 'bootstrap' ? envelope(bootstrap()) : envelope({ viewState: payload.value });
  });
  await store.load(); await store.saveViewState({ repositoryKey: repo.key, navigationWidth: 260, queueWidth: 400 });
  assert.equal(calls.at(-1).action, 'view-state-save'); assert.equal(calls.at(-1).payload.expectedIdentity, '42');
  assert.equal(store.preferredRepository(), repo.fullName);
  store.clearIdentity(99); assert.deepEqual(store.viewState, {}); assert.equal(store.preferredRepository(), '');
});

test('快照或纯本机调用不伪造联网与GitHub最后成功时间', async () => {
  let cached = true;
  const store = new LiveStore(async (_group, action) => action === 'bootstrap' ? envelope(bootstrap()) : envelope({}, 42, cached ? { cached: true, checking: { data: true }, networkChecked: false } : { networkChecked: true }));
  await store.load(); const before = store.data.lastSuccess; store.online = false;
  await store.request('query', 'list', { repositoryKey: repo.key });
  assert.equal(store.online, false); assert.equal(store.data.lastSuccess, before);
  cached = false; await store.request('query', 'list', { repositoryKey: repo.key }); assert.equal(store.online, true);
});

test('同一仓库在途列表请求合并，首次正文只走摘要而不取整段讨论', async () => {
  const calls = [], waiting = deferred();
  const store = new LiveStore(async (_group, action, payload) => {
    calls.push({ action, payload });
    if (action === 'bootstrap') return envelope(bootstrap());
    if (action === 'list') return waiting.promise;
    return envelope({ issue: issue({ coverage: { comments: { complete: false, loaded: 0, nextCursor: '1' }, activity: { complete: false, loaded: 0, nextCursor: '1' } } }) });
  });
  await store.load(); const first = store.loadRepository(repo.fullName, { cacheFirst: true }), second = store.loadRepository(repo.fullName, { cacheFirst: true });
  await tick(); assert.equal(calls.filter(call => call.action === 'list').length, 1);
  waiting.resolve(envelope({ repository: repo, issues: [issue()], pageInfo: { complete: true } })); await Promise.all([first, second]);
  await store.loadIssue(repo.fullName, 7, { summary: true, cacheFirst: true });
  assert.equal(calls.at(-1).action, 'read-summary'); assert.equal(calls.at(-1).payload.cacheFirst, true);
  assert.equal(calls.some(call => ['read', 'comments', 'activity'].includes(call.action)), false);
});

test('后台会话恢复的旧结果不能覆盖用户刚打开的新请求', async () => {
  const latest = deferred(), current = { id: 'new', requestId: 'new', status: 'requested' };
  const store = new LiveStore(async (_group, action) => action === 'bootstrap' ? envelope(bootstrap()) : action === 'latest' ? latest.promise : envelope({ current, history: [], workspaces: [], binding: null }));
  await store.load(); const recovering = store.loadTask(repo.fullName, 7);
  await store.createTask(repo.fullName, 7);
  latest.resolve(envelope({ current: { id: 'old', status: 'pending' }, history: [] })); await recovering;
  assert.equal(store.task(repo.fullName, 7).current.id, 'new');
});

test('后台旧评论页不能覆盖写入后已经读回的新评论', async () => {
  const comments = deferred();
  const store = new LiveStore(async (_group, action) => action === 'bootstrap' ? envelope(bootstrap()) : action === 'comments' ? comments.promise : envelope({ issue: issue({ commentItems: [{ id: 2, text: '已写入的新评论' }] }) }));
  await store.load(); store.installIssue(repo.fullName, issue());
  const pending = store.loadDiscussion(repo.fullName, 7, 'comments');
  await store.saveComment(repo.fullName, 7, '已写入的新评论');
  comments.resolve(envelope({ items: [{ id: 1, text: '此前评论' }], pageInfo: { complete: true } })); await pending;
  assert.equal(store.issue(repo.fullName, 7).commentItems[0].text, '已写入的新评论');
});

test('仓库明确失权后此前在途摘要不能恢复私有内容', async () => {
  const summary = deferred();
  const store = new LiveStore(async (_group, action) => {
    if (action === 'bootstrap') return envelope(bootstrap());
    if (action === 'read-summary') return summary.promise;
    throw new StoreError('NOT_FOUND', '仓库当前无法访问');
  });
  await store.load(); store.installIssue(repo.fullName, issue());
  const pending = store.loadIssue(repo.fullName, 7, { summary: true });
  await assert.rejects(store.request('query', 'list', { repositoryKey: repo.key }));
  summary.resolve(envelope({ issue: issue({ body: '失权前私有正文' }) }));
  await assert.rejects(pending, error => error.code === 'stale'); assert.equal(store.list(repo.fullName).length, 0);
});
