import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';
import { createSummaryPainter } from '../../../../packages/issue-hub/ui/summary.mjs';
import { LiveStore, StoreError } from '../../../../packages/issue-hub/ui/store.mjs';

// 临时反馈使用实际控制器和Store；没有真实网络、数据库、插件或聊天操作。
const source = await readFile(new URL('../../../../packages/issue-hub/ui/app.mjs', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

for (const manual of [false, true]) test(`${manual ? '手动' : '后台'}刷新已读回摘要后应恢复此前详情错误页`, async () => {
  const issue = { number: 185, title: '最新标题', body: '最新正文', state: 'closed', labels: [], assignees: [] };
  const detail = { innerHTML: '<h1>详情读取失败</h1>', scrollTop: 10, ownerDocument: { activeElement: null }, querySelector: () => null, querySelectorAll: () => [] };
  const state = { repo: 'team/repository', selected: 185, editor: null, refreshing: false, saving: false, detailLoading: false, detailError: '暂时无法连接 GitHub', comment: '' };
  let rendered = 0;
  const store = { identity: 42, online: false, closed: false, repository: () => ({}), async refresh() { this.online = true; return { accountChanged: false }; } };
  const context = createContext({ state, store, detailGeneration: 0, document: { activeElement: null }, $: () => detail, current: () => issue, summaryPainter: createSummaryPainter(), permission: () => false, sourceLinks: () => '',
    renderRows() {}, renderNav() {}, renderDetailStaleness() {}, hydrateIssue() {}, status() {}, announce() {},
    renderDetail() { rendered++; detail.innerHTML = '<h1>最新标题</h1>'; },
  });
  new Script(`${section('function paintCurrentSummary()', 'function renderWriteOutcome(')}\n${section('async function refresh(manual = false)', 'function focusables(')}\nglobalThis.run = refresh;`).runInContext(context);
  await context.run(manual);
  assert.equal(store.online, true);
  assert.equal(state.detailError, '', '已取得新正文后，旧详情错误状态仍保留');
  assert.doesNotMatch(detail.innerHTML, /详情读取失败/, '局部Painter找不到错误页内的详情节点，错误画面仍在');
  assert.equal(rendered, 1);
});

test('较早后台请求迟到失败不应覆盖较新严格读取的联网成功', async () => {
  let rejectOlder;
  const older = new Promise((_, reject) => { rejectOlder = reject; });
  const repo = { key: 'a'.repeat(20), fullName: 'team/repository', workspaces: [], permissions: {} };
  const envelope = data => ({ schemaVersion: 1, identity: 42, networkChecked: true, offline: false, cached: false, sampledAt: '2026-11-05T00:00:00Z', data });
  const store = new LiveStore(async (_group, action) => action === 'bootstrap' ? envelope({ account: { id: 42, login: 'member' }, repositories: [repo], catalog: { status: 'complete' }, drafts: {}, preferences: {} }) : action === 'options' ? older : envelope({ issue: { number: 185, title: '最新标题', body: '最新正文' } }));
  await store.load();
  const oldRequest = store.request('query', 'options', { repositoryKey: repo.key });
  await store.request('query', 'read-summary', { repositoryKey: repo.key, number: 185 });
  assert.equal(store.online, true);
  rejectOlder(new StoreError('NETWORK_UNAVAILABLE', '旧请求连接失败'));
  await assert.rejects(oldRequest, { code: 'NETWORK_UNAVAILABLE' });
  assert.equal(store.online, true, '旧请求的迟到失败覆盖了后开始并成功的严格GitHub读取');
});
