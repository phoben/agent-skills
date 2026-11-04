import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';
import { createSummaryPainter } from '../ui/summary.mjs';
import { esc, safeUrl } from '../ui/ui.mjs';

const source = await readFile(new URL('../ui/app.mjs', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

test('来源链接空态明确区分正文附件暂无、活动未读与完整读取后无关联PR', () => {
  const context = createContext({ esc, safeUrl });
  new Script(`${section('function sourceLinks(issue)', 'function activityMarkup(')}\nglobalThis.sources = sourceLinks;`).runInContext(context);
  const unread = context.sources({ body: '正文已读取', attachments: [], relatedPr: [], coverage: { activity: { complete: false, loaded: 0, nextCursor: '1' } } });
  assert.match(unread, /附件：暂无/); assert.match(unread, /关联 PR：尚未读取活动/); assert.doesNotMatch(unread, /关联 PR：暂无/);
  const complete = context.sources({ body: '正文已读取', attachments: [], relatedPr: [], coverage: { activity: { complete: true, loaded: 0, page: 1, nextCursor: null } } });
  assert.match(complete, /关联 PR：暂无/); assert.doesNotMatch(complete, /尚未读取活动/);
});

test('活动部分覆盖或不可用时不宣称无PR，已有安全来源仍展示并转义', () => {
  const context = createContext({ esc, safeUrl });
  new Script(`${section('function sourceLinks(issue)', 'function activityMarkup(')}\nglobalThis.sources = sourceLinks;`).runInContext(context);
  const result = context.sources({ body: '已读正文', attachments: [{ url: 'https://github.com/user-attachments/files/1/proof.txt', name: '附件证据' }], relatedPr: [{ url: 'https://github.com/team/one/pull/7', title: '<script>不可执行</script>' }, { url: 'javascript:alert(1)', title: '危险链接' }], coverage: { activity: { complete: false, page: 1, loaded: 1, nextCursor: '2' } } });
  assert.match(result, /活动尚未全部读取/); assert.match(result, /pull\/7/); assert.match(result, /附件证据/);
  assert.match(result, /&lt;script&gt;/); assert.doesNotMatch(result, /javascript:|<script>/);
  const unavailable = context.sources({ body: '', attachments: [], relatedPr: [], coverage: { activity: { complete: false, loaded: 0, unavailable: 'PERMISSION_DENIED' } } });
  assert.match(unavailable, /活动暂不可用/); assert.doesNotMatch(unavailable, /关联 PR：暂无/);
});

test('自动轮询已取得strict摘要且H1聚焦时，列表和详情只读标题都更新', async () => {
  const issue = { number: 5, title: '旧标题', body: '旧正文' }, title = { id: 'detail-title', tagName: 'H1', textContent: '旧标题', focus() {} };
  const row = { textContent: '旧标题' }, detail = { scrollTop: 240, contains: () => true };
  const state = { repo: 'team/one', selected: 5, editor: null, comment: '', refreshing: false, saving: false };
  let wholeRenders = 0, summaryPaints = 0;
  const context = createContext({
    state, detailGeneration: 0, store: { identity: 42, closed: false, readSignal: () => ({ cached: false }), repository: () => ({}), async refresh() { issue.title = '远端新标题'; issue.body = '远端新正文'; return { accountChanged: false }; } },
    document: { activeElement: title, getElementById: () => title }, $: () => detail, hasEditor: () => false,
    renderRows() { row.textContent = issue.title; }, renderNav() {}, renderDetail() { wholeRenders++; },
    paintCurrentSummary() { summaryPaints++; title.textContent = issue.title; }, renderDetailStaleness() {}, hydrateIssue() {}, status() {}, announce() {},
  });
  new Script(`${section('async function refresh(manual = false)', 'function focusables(')}\nglobalThis.poll = refresh;`).runInContext(context);
  await context.poll(false);
  assert.equal(row.textContent, '远端新标题'); assert.equal(title.textContent, '远端新标题');
  assert.equal(summaryPaints, 1); assert.equal(wholeRenders, 0); assert.equal(detail.scrollTop, 240); assert.equal(state.selected, 5);
});

function summaryPage() {
  const document = { activeElement: null };
  class Node {
    constructor(tag = 'SPAN', text = '') { this.tagName = tag; this.textContent = text; this.html = ''; this.htmlWrites = 0; this.children = new Set(); this.disabled = false; }
    get innerHTML() { return this.html; }
    set innerHTML(value) { this.html = value; this.htmlWrites++; if (this.children.has(document.activeElement)) document.activeElement = null; this.children.clear(); }
    contains(node) { return this === node || this.children.has(node); }
    matches(selector) { return this.tagName === 'BUTTON' && selector.includes('button') || this.tagName === 'A' && selector.includes('a[href]') || this.tagName === 'TEXTAREA' && selector.includes('textarea'); }
    focus() { document.activeElement = this; }
    setAttribute() {}
    remove() { if (root.banner === this) root.banner = null; }
  }
  const issue = { number: 5, title: '旧标题', body: '旧正文', author: '作者', created: '昨日', state: 'open', labels: ['bug'], assignees: ['one'], milestone: '旧里程碑', updated: '旧时间', revision: 'old' };
  const title = new Node('H1', issue.title); title.id = 'detail-title';
  const body = new Node('DIV'), links = new Node('DIV'), author = new Node(), openState = new Node();
  body.html = '<p>旧正文</p>';
  const propertyValues = { labels: new Node('BUTTON'), assignees: new Node('BUTTON', 'one'), milestone: new Node('BUTTON', '旧里程碑'), updated: new Node('SPAN', '旧时间') };
  const properties = Object.entries({ 标签: 'labels', 负责人: 'assignees', 里程碑: 'milestone', 更新: 'updated' }).map(([name, key]) => ({ querySelector: selector => selector === '.property-name' ? new Node('SPAN', name) : propertyValues[key], lastElementChild: propertyValues[key] }));
  const comment = new Node('TEXTAREA'); comment.id = 'comment-body'; comment.value = '正在输入的评论'; comment.selectionStart = 3; comment.selectionEnd = 5;
  const root = { ownerDocument: document, scrollTop: 240, banner: null, querySelector: selector => ({ '#detail-title': title, '#issue-body-view': body, '.related-links': links, '.issue-author': author, '.open-state': openState }[selector]), querySelectorAll: () => properties, contains: () => true, prepend(node) { this.banner = node; } };
  document.activeElement = title;
  document.getElementById = id => id === 'comment-body' ? comment : title;
  document.createElement = () => new Node('DIV');
  return { document, root, issue, title, body, links, author, openState, propertyValues, comment, Node };
}

test('首批活动异步到达后立即局部显示关联PR，保留评论输入焦点与选区', async () => {
  const p = summaryPage(), summaryPainter = createSummaryPainter(); summaryPainter.remember(p.root, p.issue);
  p.document.activeElement = p.comment;
  const state = { repo: 'team/one', selected: 5, editor: null, comment: p.comment.value, saving: false, detailLoading: false };
  const context = createContext({
    state, summaryPainter, document: p.document, current: () => p.issue, permission: () => true, esc, safeUrl,
    $: selector => selector === '#detail-stale-banner' ? p.root.banner : p.root,
    store: { online: true, readSignal: () => ({ cached: false }), async loadDiscussion(_repo, _number, kind) { if (kind === 'activity') { p.issue.relatedPr = [{ url: 'https://github.com/team/one/pull/18', title: '首批活动中的PR' }]; p.issue.coverage = { activity: { complete: true, loaded: 1, page: 1 } }; } }, async loadTask() {} },
    renderDiscussionOnly() {}, renderTaskOnly() {}, status() {}, announce() {},
    renderDetail() { throw new Error('活动到达不能重建详情或评论编辑器'); },
  });
  new Script(`${section('function sourceLinks(issue)', 'function activityMarkup(')}\n${section('function renderDetailStaleness()', 'function renderWriteOutcome(')}\n${section('async function hydrateIssue(', 'function editIssue(')}\nglobalThis.hydrate = hydrateIssue;`).runInContext(context);
  await context.hydrate(state.repo, 5, () => true);
  assert.match(p.links.innerHTML, /https:\/\/github\.com\/team\/one\/pull\/18/);
  assert.equal(p.comment.value, '正在输入的评论'); assert.equal(p.comment.selectionStart, 3); assert.equal(p.comment.selectionEnd, 5);
  assert.equal(p.document.activeElement, p.comment); assert.equal(p.root.scrollTop, 240); assert.equal(p.body.htmlWrites, 0);
});

test('明确加载更多活动可更新聚焦的分页区，完成后焦点回活动标签且不重建评论', async () => {
  const p = summaryPage(), summaryPainter = createSummaryPainter(); summaryPainter.remember(p.root, p.issue);
  const content = new p.Node('DIV'), more = new p.Node('BUTTON'), activityTab = new p.Node('BUTTON');
  more.dataset = { action: 'more-activity' }; content.children.add(more); content.html = '旧活动'; p.document.activeElement = more;
  const state = { repo: 'team/one', selected: 5, editor: null, comment: p.comment.value, saving: false, detailLoading: false, discussionTab: 'activities' };
  const context = createContext({
    state, summaryPainter, document: p.document, current: () => p.issue, permission: () => true, esc, safeUrl, captureInputs() {},
    $: selector => ({ '#detail': p.root, '#discussion-content': content, '#detail-stale-banner': p.root.banner, '.discussion-tabs [data-tab="activities"]': activityTab }[selector] || null),
    store: { identity: 42, async loadMore() { p.issue.activities = [{ text: '第二页活动', time: '现在' }]; p.issue.relatedPr = [{ url: 'https://github.com/team/one/pull/19', title: '第二页关联PR' }]; p.issue.coverage = { activity: { complete: true, page: 2, loaded: 1, nextCursor: null } }; } },
    renderDetail() { throw new Error('活动分页不能重建评论编辑器'); },
  });
  new Script(`${section('function sourceLinks(issue)', 'function renderDetail(')}\n${section('function renderDetailStaleness()', 'function renderWriteOutcome(')}\n${section('function renderDiscussionOnly(', 'function renderTaskOnly(')}\n${section('async function handleAction(', "document.addEventListener('click'")}\nglobalThis.act = handleAction;`).runInContext(context);
  await context.act('more-activity', more);
  assert.match(content.innerHTML, /第二页活动/); assert.match(p.links.innerHTML, /pull\/19/);
  assert.equal(p.document.activeElement, activityTab); assert.equal(p.comment.value, '正在输入的评论'); assert.equal(p.comment.selectionStart, 3); assert.equal(p.root.scrollTop, 240);
});

test('活动分页在途切到其他Issue后不绘制旧详情或来源链接', async () => {
  const state = { repo: 'team/one', selected: 5 }, target = { dataset: { action: 'more-activity' } };
  let release, paints = 0; const waiting = new Promise(resolve => release = resolve);
  const context = createContext({ state, store: { identity: 42, loadMore: () => waiting }, captureInputs() {}, renderDiscussionOnly() { paints++; }, paintCurrentSummary() { paints++; }, renderDetail() { throw new Error('不能重绘其他Issue'); } });
  new Script(`${section('async function handleAction(', "document.addEventListener('click'")}\nglobalThis.act = handleAction;`).runInContext(context);
  const request = context.act('more-activity', target); state.selected = 6; release(); await request;
  assert.equal(paints, 0); assert.equal(state.selected, 6);
});

test('局部摘要更新标题、正文和属性，保留H1、属性按钮、滚动及评论控件对象', () => {
  const p = summaryPage(), painter = createSummaryPainter(); painter.remember(p.root, p.issue);
  const next = { ...p.issue, title: '新标题', body: '新正文', state: 'closed', labels: ['triaged'], assignees: ['one', 'two'], milestone: '新里程碑', updated: '新时间' };
  const result = painter.paint(p.root, next, { manage: true });
  assert.equal(result.changed, true); assert.equal(p.title.textContent, '新标题'); assert.equal(p.body.innerHTML, '<p>新正文</p>');
  assert.match(p.propertyValues.labels.innerHTML, /triaged/); assert.equal(p.propertyValues.assignees.textContent, 'one、two'); assert.equal(p.propertyValues.milestone.textContent, '新里程碑');
  assert.equal(p.document.activeElement, p.title); assert.equal(p.root.scrollTop, 240); assert.equal(p.comment.value, '正在输入的评论');
  p.document.activeElement = p.propertyValues.labels;
  painter.paint(p.root, { ...next, labels: ['needs-review'] }, { manage: true });
  assert.match(p.propertyValues.labels.innerHTML, /needs-review/); assert.equal(p.document.activeElement, p.propertyValues.labels);
});

test('正文未变化不替换；正文链接正聚焦时延后该区，但标题仍更新', () => {
  const p = summaryPage(), painter = createSummaryPainter(); painter.remember(p.root, p.issue);
  painter.paint(p.root, { ...p.issue, title: '只改标题' }); assert.equal(p.body.htmlWrites, 0);
  const link = new p.Node('A', '正在阅读链接'); p.body.children.add(link); p.document.activeElement = link;
  const next = { ...p.issue, title: '远端再改标题', body: '远端已改正文' };
  assert.equal(painter.paint(p.root, next).deferred, true); assert.equal(p.title.textContent, '远端再改标题'); assert.equal(p.body.htmlWrites, 0); assert.equal(p.document.activeElement, link);
  p.document.activeElement = p.comment;
  assert.equal(painter.paint(p.root, next).deferred, false); assert.equal(p.body.htmlWrites, 1); assert.equal(p.comment.value, '正在输入的评论');
});

test('自动和手动刷新保留评论输入DOM与选择范围，并更新只读摘要', async () => {
  for (const manual of [false, true]) {
    const p = summaryPage(), summaryPainter = createSummaryPainter(); summaryPainter.remember(p.root, p.issue);
    p.document.activeElement = p.comment;
    const state = { repo: 'team/one', selected: 5, editor: null, comment: p.comment.value, refreshing: false, saving: false, detailLoading: false };
    let args;
    const context = createContext({
      state, detailGeneration: 0, summaryPainter, document: p.document, current: () => p.issue, permission: () => true, sourceLinks: () => '',
      store: { identity: 42, closed: false, repository: () => ({}), async refresh(input) { args = input; p.issue.title = '远端新标题'; p.issue.body = '远端新正文'; return { accountChanged: false }; } },
      $: selector => selector === '#detail-stale-banner' ? p.root.banner : p.root, hasEditor: () => true,
      renderRows() {}, renderNav() {}, renderDetail() { throw new Error('不能重建评论编辑器'); }, hydrateIssue() {}, status() {}, announce() {},
    });
    new Script(`${section('function renderDetailStaleness()', 'function renderWriteOutcome(')}\n${section('async function refresh(manual = false)', 'function focusables(')}\nglobalThis.poll = refresh;`).runInContext(context);
    await context.poll(manual);
    assert.equal(args.number, 5); assert.equal(p.title.textContent, '远端新标题'); assert.equal(p.body.innerHTML, '<p>远端新正文</p>');
    assert.equal(p.document.activeElement, p.comment); assert.equal(p.comment.value, '正在输入的评论'); assert.equal(p.comment.selectionStart, 3); assert.equal(p.comment.selectionEnd, 5); assert.equal(p.root.scrollTop, 240);
  }
});

test('Issue正文编辑时不重建或覆盖表单，远端变更明确显示旧投影提示', async () => {
  const p = summaryPage(), summaryPainter = createSummaryPainter(); summaryPainter.remember(p.root, p.issue);
  const editor = { title: '正在编辑的标题', body: '正在编辑的正文', revision: 'old' };
  const state = { repo: 'team/one', selected: 5, editor, comment: '', refreshing: false, saving: false, detailLoading: false };
  let args;
  const context = createContext({
    state, detailGeneration: 0, summaryPainter, document: p.document, current: () => p.issue,
    store: { identity: 42, closed: false, repository: () => ({}), async refresh(input) { args = input; p.issue.title = '远端标题'; p.issue.body = '远端正文'; p.issue.revision = 'new'; return { accountChanged: false }; } },
    $: selector => selector === '#detail-stale-banner' ? p.root.banner : p.root, hasEditor: () => true,
    renderRows() {}, renderNav() {}, renderDetail() { throw new Error('不能重建Issue编辑表单'); }, hydrateIssue() { throw new Error('编辑时不读取讨论覆盖输入'); }, status() {}, announce() {},
  });
  new Script(`${section('function renderDetailStaleness()', 'function renderWriteOutcome(')}\n${section('async function refresh(manual = false)', 'function focusables(')}\nglobalThis.poll = refresh;`).runInContext(context);
  await context.poll(false);
  assert.equal(args.number, null); assert.equal(state.editor, editor); assert.equal(editor.body, '正在编辑的正文'); assert.equal(p.body.htmlWrites, 0);
  assert.match(p.root.banner.textContent, /远端已有更新，当前编辑输入已保留/); assert.equal(p.root.scrollTop, 240);
});

test('轮询在途才开始写入时不绘制摘要，写入结束后仍可局部更新', async () => {
  const p = summaryPage(), summaryPainter = createSummaryPainter(); summaryPainter.remember(p.root, p.issue);
  const state = { repo: 'team/one', selected: 5, editor: null, comment: '', refreshing: false, saving: false, detailLoading: false };
  let release; const pending = new Promise(resolve => release = resolve);
  const context = createContext({
    state, detailGeneration: 0, summaryPainter, document: p.document, current: () => p.issue, permission: () => true, sourceLinks: () => '',
    store: { identity: 42, closed: false, repository: () => ({}), async refresh() { await pending; p.issue.title = '远端新标题'; p.issue.body = '远端新正文'; return { accountChanged: false }; } },
    $: selector => selector === '#detail-stale-banner' ? p.root.banner : p.root,
    renderRows() {}, renderNav() {}, hydrateIssue() {}, status() {}, announce() {},
  });
  new Script(`${section('function renderDetailStaleness()', 'function renderWriteOutcome(')}\n${section('async function refresh(manual = false)', 'function focusables(')}\nglobalThis.poll = refresh; globalThis.paint = paintCurrentSummary;`).runInContext(context);
  const polling = context.poll(false); state.saving = true; release(); await polling;
  assert.equal(p.title.textContent, '旧标题'); assert.equal(p.body.htmlWrites, 0); assert.equal(p.root.scrollTop, 240);
  state.saving = false; context.paint();
  assert.equal(p.title.textContent, '远端新标题'); assert.equal(p.body.innerHTML, '<p>远端新正文</p>');
});
