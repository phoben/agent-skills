import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, writeFile, appendFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { zstdCompressSync } from 'node:zlib';
import { createCollector } from '../src/collector.mjs';

const range = { accountId: 'account-a', startDate: '2026-11-01', endDate: '2026-11-03', timeZone: 'Asia/Shanghai' };
const raw = (input = 100, output = 20, cached = 40, reasoning = 5, write = 10) => ({ input_tokens: input, cached_input_tokens: cached, cache_write_input_tokens: write, output_tokens: output, reasoning_output_tokens: reasoning, total_tokens: input + output });
const meta = (id, extra = {}) => ({ ordinal: 0, type: 'session_meta', payload: { id, creator_account_id: 'account-a', ...extra } });
const count = (ordinal, total = raw(), last = total, timestamp = '2026-11-02T12:00:00Z') => ({ ordinal, timestamp, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: total, last_token_usage: last } } });

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'usage-collector-'));
  await mkdir(path.join(root, 'sessions'));
  const db = new DatabaseSync(path.join(root, 'state_5.sqlite'));
  db.exec('CREATE TABLE threads(id TEXT PRIMARY KEY,rollout_path TEXT,creator_account_id TEXT,project_id TEXT,cwd TEXT,title TEXT,name TEXT,model TEXT,source TEXT,updated_at INTEGER,first_user_message TEXT)');
  const collector = createCollector({ codexHome: root, cacheDir: path.join(root, 'cache') });
  t.after(async () => { await collector.close(); db.close(); await rm(root, { recursive: true, force: true }); });
  async function thread(id, records = [meta(id), count(1)], options = {}) {
    const file = options.file ?? path.join(root, 'sessions', `${id}.jsonl`);
    await writeFile(file, `${records.map(record => JSON.stringify(record)).join('\n')}\n`);
    db.prepare('INSERT INTO threads(id,rollout_path,creator_account_id,project_id,cwd,title,name,model,source,updated_at,first_user_message) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id, file, options.account === undefined ? 'account-a' : options.account, options.project ?? null, options.cwd ?? root, options.title ?? id, options.name ?? null, null, options.source ?? null, 1793620800, 'SECRET_USER_BODY');
    return file;
  }
  return { root, db, collector, thread };
}

test('按账号隔离，未知和其他账号不读日志，源文件保持不变', async t => {
  const f = await fixture(t);
  const file = await f.thread('mine');
  await f.thread('other', [meta('other', { creator_account_id: 'account-b' }), count(1, raw(900, 50))], { account: 'account-b' });
  await f.thread('unknown', [meta('unknown'), count(1, raw(900, 50))], { account: null });
  const before = await readFile(file);
  const local = await f.collector.dashboard(range);
  assert.equal(local.totals.totalTokens, 120);
  assert.deepEqual({ ...local.coverage, indexedAt: null }, { scannedThreads: 3, attributedThreads: 1, unassignedAccountThreads: 1, excludedAccountThreads: 1, failedThreads: 0, partialRollouts: 0, indexedAt: null });
  const other = await f.collector.dashboard({ ...range, accountId: 'account-b' });
  assert.equal(other.totals.totalTokens, 950);
  assert.deepEqual(await readFile(file), before);
  const cache = new DatabaseSync(path.join(f.root, 'cache', 'token-usage.sqlite'), { readOnly: true });
  const cached = cache.prepare('SELECT account_key,data FROM rollout_stats').all();
  cache.close();
  assert.equal(cached.length, 2);
  assert.notEqual(cached[0].account_key, cached[1].account_key);
  assert.ok(!JSON.stringify(cached).includes('SECRET_USER_BODY'));
});

test('累计差分去重，首次继承与重置仅取last，缓存更新保持分项守恒', async t => {
  const f = await fixture(t);
  const file = await f.thread('counts', [meta('counts'), count(1), count(2), count(3, raw(200, 40, 80, 10, 20), raw()), count(4, raw(), raw())]);
  let local = await f.collector.dashboard(range);
  assert.equal(local.totals.totalTokens, 360);
  assert.equal(local.coverage.partialRollouts, 1);
  assert.equal((await f.collector.dashboard(range)).totals.totalTokens, 360);
  await appendFile(file, `${JSON.stringify(count(5, raw(200, 40, 80, 10, 20), raw()))}\n`);
  local = await f.collector.dashboard(range);
  assert.equal(local.totals.totalTokens, 480);
  const sum = local.totals;
  assert.equal(sum.totalTokens, sum.inputTokens + sum.outputTokens);
  assert.equal(sum.inputTokens, sum.cachedInputTokens + sum.uncachedInputTokens);
  assert.equal(sum.cacheWriteInputTokens, 40);
  assert.equal(sum.reasoningOutputTokens, 20);
  await f.thread('partial', [meta('partial'), count(1, raw(1000, 200, 400, 50, 100), raw())]);
  assert.equal((await f.collector.dashboard(range)).totals.totalTokens, 600);
});

test('子代理跳过ordinal继承边界，复制父meta不覆盖身份，同账号合并父线程', async t => {
  const f = await fixture(t);
  await f.thread('parent', [meta('parent'), count(1)], { title: '父会话' });
  await f.thread('child', [meta('child', { parent_thread_id: 'parent', subagent_history_start_ordinal: 10 }), { ...meta('parent'), ordinal: 1 }, count(9, raw(900, 50)), count(10), { ordinal: 11, type: 'turn_context', payload: { model: 'test-model' } }, count(12, raw(200, 40, 80, 10, 20), raw())], { cwd: path.join(f.root, 'another'), title: '子会话' });
  const local = await f.collector.dashboard(range);
  assert.equal(local.projects.length, 1);
  assert.equal(local.projects[0].sessionCount, 1);
  assert.equal(local.totals.totalTokens, 360);
  const result = await f.collector.sessions({ ...range, projectId: local.projects[0].id });
  assert.equal(result.sessions[0].id, 'parent');
  assert.equal(result.sessions[0].title, '父会话');
  assert.equal(result.sessions[0].subagentCount, 1);
  await f.thread('foreign-parent', [meta('foreign-parent', { creator_account_id: 'account-b' }), count(1)], { account: 'account-b' });
  await f.thread('orphan', [meta('orphan', { parent_thread_id: 'foreign-parent' }), count(1)], { title: '独立' });
  assert.equal((await f.collector.sessions({ ...range, projectId: local.projects[0].id })).totalCount, 2);
});

test('跨午夜按IANA时区分日，范围搜索排序分页与搜索前totals一致', async t => {
  const f = await fixture(t);
  await f.thread('alpha', [meta('alpha'), { ordinal: 1, type: 'turn_context', payload: { model: 'gpt-test' } }, count(2, raw(), raw(), '2026-11-01T15:59:59Z'), count(3, raw(200, 40, 80, 10, 20), raw(), '2026-11-01T16:00:00Z')], { title: 'Alpha' });
  await f.thread('beta', [meta('beta'), count(1, raw(200, 100), raw(200, 100), '2026-11-02T18:00:00Z')], { title: 'Beta' });
  await f.thread('gamma', [meta('gamma'), count(1, raw(300, 20), raw(300, 20), '2026-11-02T10:00:00Z')], { title: 'Gamma' });
  const local = await f.collector.dashboard(range);
  const project = local.projects[0];
  assert.equal(local.status, 'ok');
  assert.deepEqual(project.daily.map(day => [day.date, day.totalTokens]), [['2026-11-01', 120], ['2026-11-02', 440], ['2026-11-03', 300]]);
  const query = { ...range, projectId: project.id };
  const filtered = await f.collector.sessions({ ...query, search: 'alpha' });
  assert.equal(filtered.totalCount, 3);
  assert.equal(filtered.filteredCount, 1);
  assert.equal(filtered.totals.totalTokens, 860);
  assert.equal(filtered.sessions[0].model, 'gpt-test');
  assert.equal((await f.collector.sessions({ ...query, sort: 'tokens', pageSize: 1, page: 2 })).sessions[0].id, 'beta');
  assert.equal((await f.collector.sessions({ ...query, sort: 'output' })).sessions[0].id, 'beta');
  assert.equal((await f.collector.sessions({ ...query, sort: 'recent' })).sessions[0].id, 'beta');
  const daily = await f.collector.sessions({ ...query, date: '2026-11-01' });
  assert.equal(daily.totalCount, 1);
  assert.equal(daily.totals.totalTokens, 120);
  assert.equal(daily.sessions[0].lastActivityAt, '2026-11-01T15:59:59.000Z');
  const blank = await f.collector.sessions({ ...query, search: 'not present' });
  assert.equal(blank.filteredCount, 0);
  assert.equal(blank.totals.totalTokens, 860);
  assert.equal(blank.totalPages, 0);
  const utc = await f.collector.dashboard({ ...range, timeZone: 'UTC' });
  assert.equal(utc.projects[0].daily[0].totalTokens, 240);
});

test('历史范围与单日的最近活动及recent排序只取已统计事件', async t => {
  const f = await fixture(t);
  await f.thread('old-with-future', [meta('old-with-future'), count(1, raw(), raw(), '2026-11-01T01:00:00Z'), count(2, raw(200, 40, 80, 10, 20), raw(), '2026-11-03T10:00:00Z')]);
  await f.thread('recent-in-day', [meta('recent-in-day'), count(1, raw(), raw(), '2026-11-01T02:00:00Z')]);
  const local = await f.collector.dashboard(range);
  const query = { ...range, projectId: local.projects[0].id, sort: 'recent' };
  for (const scoped of [{ ...query, endDate: '2026-11-01' }, { ...query, date: '2026-11-01' }]) {
    const result = await f.collector.sessions(scoped);
    assert.deepEqual(result.sessions.map(session => session.id), ['recent-in-day', 'old-with-future']);
    assert.equal(result.sessions[0].lastActivityAt, '2026-11-01T02:00:00.000Z');
    assert.equal(result.sessions[1].lastActivityAt, '2026-11-01T01:00:00.000Z');
    assert.equal(result.totals.totalTokens, 240);
    assert.ok(result.sessions.every(session => !('days' in session)));
  }
  const full = await f.collector.sessions(query);
  assert.equal(full.sessions[0].id, 'old-with-future');
  assert.equal(full.sessions[0].lastActivityAt, '2026-11-03T10:00:00.000Z');
});

test('合并项目保留跨日期会话，搜索前合计与全局排序分页一致', async t => {
  const f = await fixture(t);
  await f.thread('group-alpha', [meta('group-alpha'), count(1, raw(), raw(), '2026-11-01T01:00:00Z'), count(2, raw(200, 40, 80, 10, 20), raw(), '2026-11-02T01:00:00Z')], { project: 'alpha', title: 'Alpha 跨日' });
  await f.thread('group-beta', [meta('group-beta'), count(1, raw(300, 70), raw(300, 70), '2026-11-02T03:00:00Z')], { project: 'beta', title: 'Beta 主会话' });
  await f.thread('group-gamma', [meta('group-gamma'), count(1, raw(150, 100), raw(150, 100), '2026-11-03T01:00:00Z')], { project: 'alpha', title: 'Alpha 高输出' });
  await f.thread('not-selected', [meta('not-selected'), count(1, raw(900, 100), raw(900, 100))], { project: 'excluded' });
  const local = await f.collector.dashboard(range);
  const excludedId = local.projects.find(project => project.totalTokens === 1000).id;
  const projectIds = local.projects.filter(project => project.id !== excludedId).map(project => project.id);
  const query = { ...range, projectIds };
  const all = await f.collector.sessions(query);
  assert.deepEqual(all.project, { id: 'group:other', name: '其他 2 个项目', memberCount: 2 });
  assert.equal(all.totalCount, 3);
  assert.equal(all.filteredCount, 3);
  assert.equal(all.totals.totalTokens, 860);
  assert.deepEqual(all.sessions.map(session => session.id), ['group-beta', 'group-gamma', 'group-alpha']);
  assert.equal((await f.collector.sessions({ ...query, pageSize: 1, page: 2 })).sessions[0].id, 'group-gamma');
  assert.deepEqual((await f.collector.sessions({ ...query, sort: 'output' })).sessions.map(session => session.id), ['group-gamma', 'group-beta', 'group-alpha']);
  assert.deepEqual((await f.collector.sessions({ ...query, sort: 'recent' })).sessions.map(session => session.id), ['group-gamma', 'group-beta', 'group-alpha']);
  const searched = await f.collector.sessions({ ...query, search: '高输出' });
  assert.equal(searched.totalCount, 3);
  assert.equal(searched.filteredCount, 1);
  assert.equal(searched.totals.totalTokens, 860);
  const daily = await f.collector.sessions({ ...query, date: '2026-11-02', search: 'Alpha' });
  assert.equal(daily.totalCount, 2);
  assert.equal(daily.filteredCount, 1);
  assert.equal(daily.totals.totalTokens, 490);
  assert.equal(daily.sessions[0].totalTokens, 120);
  assert.equal(daily.sessions[0].lastActivityAt, '2026-11-02T01:00:00.000Z');
  const emptyDay = await f.collector.sessions({ ...query, date: '2026-11-01', search: 'Beta' });
  assert.equal(emptyDay.totalCount, 1);
  assert.equal(emptyDay.filteredCount, 0);
  assert.equal(emptyDay.totals.totalTokens, 120);
  const single = await f.collector.sessions({ ...range, projectId: projectIds[0] });
  assert.deepEqual(single.project, { id: projectIds[0], name: local.projects.find(project => project.id === projectIds[0]).name });
  assert.ok(all.sessions.every(session => !('days' in session) && !('projectId' in session)));
  assert.ok(!JSON.stringify(all).includes(f.root));
});

test('合并查询拒绝非法选择器及未知或其他账号项目，不返回部分成员结果', async t => {
  const f = await fixture(t);
  await f.thread('own-project', undefined, { project: 'own' });
  await f.thread('foreign-project', [meta('foreign-project', { creator_account_id: 'account-b' }), count(1)], { project: 'foreign', account: 'account-b' });
  const ownId = (await f.collector.dashboard(range)).projects[0].id;
  const foreignId = (await f.collector.dashboard({ ...range, accountId: 'account-b' })).projects[0].id;
  for (const selector of [{}, { projectId: ownId, projectIds: [ownId] }, { projectIds: [] }, { projectIds: [ownId, ownId] }, { projectIds: [''] }, { projectIds: [' '] }, { projectIds: ['x'.repeat(201)] }, { projectIds: Array.from({ length: 1001 }, (_, index) => `p-${index}`) }]) {
    await assert.rejects(f.collector.sessions({ ...range, ...selector }), { code: 'INVALID_SESSION_QUERY' });
  }
  for (const projectIds of [[ownId, 'unknown'], [foreignId], [ownId, foreignId]]) {
    await assert.rejects(f.collector.sessions({ ...range, projectIds }), { code: 'PROJECT_NOT_FOUND' });
  }
  await assert.rejects(f.collector.sessions({ ...range, accountId: 'account-b', projectIds: [ownId] }), { code: 'PROJECT_NOT_FOUND' });
});

test('显式项目优先，Git worktree用共同目录合并且不同仓库不混合', async t => {
  const f = await fixture(t);
  const repo = path.join(f.root, 'repo');
  const worktree = path.join(f.root, 'worktree');
  const second = path.join(f.root, 'repo2');
  await mkdir(repo); await mkdir(second);
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { stdio: 'pipe', windowsHide: true });
  git(repo, 'init'); git(repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '--allow-empty', '-m', 'test');
  git(repo, 'worktree', 'add', '-b', 'fixture', worktree);
  git(second, 'init');
  await f.thread('main', undefined, { cwd: repo });
  await f.thread('worktree', undefined, { cwd: worktree });
  await f.thread('second', undefined, { cwd: second });
  await f.thread('explicit', undefined, { cwd: repo, project: 'stable-project' });
  const local = await f.collector.dashboard(range);
  assert.equal(local.projects.length, 3);
  assert.equal(local.projects.find(project => project.sessionCount === 2).totalTokens, 240);
  assert.ok(!JSON.stringify(local.projects).includes(f.root));
});

test('显式项目从可选projects表读取真实名称，缺表及缺名称时继续兼容', async t => {
  const f = await fixture(t);
  f.db.exec('CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT,metadata TEXT)');
  f.db.prepare('INSERT INTO projects VALUES(?,?,?)').run('project-1', '正式产品名称', 'SECRET_PROJECT_METADATA');
  await f.thread('named', undefined, { project: 'project-1' });
  await f.thread('unnamed', undefined, { project: 'project-2' });
  const local = await f.collector.dashboard(range);
  assert.ok(local.projects.some(project => project.name === '正式产品名称'));
  assert.equal(local.projects.length, 2);
  assert.ok(!JSON.stringify(local).includes('SECRET_PROJECT_METADATA'));
  f.db.exec('DROP TABLE projects');
  const absent = await f.collector.dashboard(range);
  assert.equal(absent.projects.length, 2);
  assert.equal(absent.coverage.failedThreads, 0);
});

test('不允许越出会话目录；最新合法schema可用，缺失源明确unavailable', async t => {
  const f = await fixture(t);
  await f.thread('outside', [meta('outside'), count(1)], { file: path.join(f.root, 'outside.jsonl') });
  const newer = new DatabaseSync(path.join(f.root, 'state_99.sqlite'));
  newer.exec('CREATE TABLE irrelevant(id TEXT)'); newer.close();
  const local = await f.collector.dashboard(range);
  assert.equal(local.coverage.failedThreads, 1);
  assert.equal(local.totals.totalTokens, 0);
  await assert.rejects(f.collector.dashboard({ ...range, timeZone: 'invalid' }), { code: 'INVALID_TIME_ZONE' });
  await assert.rejects(f.collector.dashboard({ ...range, startDate: '2026-02-30' }), { code: 'INVALID_RANGE' });
  const absent = createCollector({ codexHome: path.join(f.root, 'absent') });
  const unavailable = await absent.dashboard(range);
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.totals, null);
  assert.ok(!JSON.stringify(unavailable).includes(f.root));
  await assert.rejects(absent.sessions({ ...range, projectId: 'anything' }), { code: 'LOCAL_SOURCE_UNAVAILABLE' });
  await absent.close();
});

test('异常负数、越界子项及账号meta矛盾不计入；行号兼容明确partial', async t => {
  const f = await fixture(t);
  await f.thread('invalid', [meta('invalid'), count(1, raw(-1, 20)), count(2, raw(100, 20, 101)), count(3, raw(100, 20, 40, 21)), { ...count(4), ordinal: undefined }]);
  await f.thread('mismatch', [meta('mismatch', { creator_account_id: 'account-b' }), count(1)]);
  const local = await f.collector.dashboard(range);
  assert.equal(local.totals.totalTokens, 120);
  assert.equal(local.coverage.failedThreads, 1);
  assert.equal(local.coverage.partialRollouts, 1);
});

test('读取历史Zstandard日志，兼容索引仍指向压缩前文件名并拒绝损坏流', async t => {
  const f = await fixture(t);
  const file = await f.thread('compressed');
  const body = await readFile(file);
  await writeFile(`${file}.zst`, zstdCompressSync(body));
  await rm(file);
  const direct = await f.thread('direct');
  await writeFile(`${direct}.zst`, zstdCompressSync(await readFile(direct)));
  await rm(direct);
  f.db.prepare('UPDATE threads SET rollout_path=? WHERE id=?').run(`${direct}.zst`, 'direct');
  const local = await f.collector.dashboard(range);
  assert.equal(local.totals.totalTokens, 240);
  assert.equal(local.coverage.failedThreads, 0);
  await writeFile(`${file}.zst`, 'broken compressed stream');
  const broken = await f.collector.dashboard(range);
  assert.equal(broken.coverage.failedThreads, 1);
  assert.equal(broken.totals.totalTokens, 120);
});
