import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';
import { createColumnLayout, constrainWidths } from '../ui/layout.mjs';
import { createLatestSelection } from '../ui/selection.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { resolve, reject, promise }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const source = await readFile(new URL('../ui/app.mjs', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

test('后台目录归一完成会本机重存当前选仓，且不等待保存才更新页面', async () => {
  const saves = [], state = { repo: 'team/second' }, never = new Promise(() => {});
  const context = createContext({ state, store: { identity: 8, async refreshCatalog() {}, repository: () => ({}), repositoryKey: () => 'canonical-key', saveViewState: value => { saves.push(value); return never; } }, renderNav() {}, announce() {}, renderAll() {}, renderQueue() {}, switchRepository() {} });
  new Script(`${section('async function refreshCatalogInBackground()', 'function applyTheme(')}\nglobalThis.refresh = refreshCatalogInBackground;`).runInContext(context);
  await context.refresh();
  assert.equal(saves[0].repositoryKey, 'canonical-key');
});

test('后台规范名称更新保留用户当前Issue和编辑表单，不跳首仓', async () => {
  const state = { repo: 'team/old-name', selected: 182, editor: { title: '未发布标题' } }, nodes = new Map();
  const canonical = 'Team/new-name', saves = [];
  const context = createContext({ state, store: { identity: 8, async refreshCatalog() {}, repository: () => ({ fullName: canonical }), repositoryKey: () => 'stable-key', saveViewState: async value => saves.push(value) }, $: key => { if (!nodes.has(key)) nodes.set(key, { textContent: '' }); return nodes.get(key); }, renderNav() {}, announce() {}, renderAll() {}, renderQueue() {}, hasEditor: () => true, switchRepository() { throw new Error('不能切回首仓'); } });
  new Script(`${section('async function refreshCatalogInBackground()', 'function applyTheme(')}\nglobalThis.refresh = refreshCatalogInBackground;`).runInContext(context);
  await context.refresh();
  assert.equal(state.repo, canonical); assert.equal(state.selected, 182); assert.equal(state.editor.title, '未发布标题');
  assert.equal(saves[0].repositoryKey, 'stable-key');
});
// 直接运行实际控制器函数，避免只证明测试里重写的点击逻辑。
const controller = section('async function preserveBefore(', 'function scheduleDraft(') + section('let detailGeneration = 0;', 'function closeDetail(') + section('async function switchRepository(', 'function updateFilterOptions(') + section('async function hydrateRepository(', 'function renderDiscussionOnly(') + section('async function hydrateIssue(', 'function editIssue(');
function page({ dirty = false, draftFailure = false } = {}) {
  const reads = new Map(), repositories = new Map(), calls = [], bodies = [], nodes = new Map();
  const node = selector => { if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', scrollTop: 0, contains: () => false, focus() {} }); return nodes.get(selector); };
  const never = new Promise(() => {}), selection = createLatestSelection();
  const state = { repo: 'owner/one', selected: dirty ? 1 : null, saving: false, refreshing: false, editor: dirty ? { title: '改动', _base: { title: '原文' } } : null, comment: '', commentId: null, draftSaved: false, filters: {}, detailError: '' };
  const store = {
    identity: 1, online: true, data: { repositories: [] },
    loadIssue(repo, number) { calls.push(['read-summary', repo, number]); const wait = deferred(); reads.set(number, wait); return wait.promise; },
    loadRepository(repo) { calls.push(['list', repo]); const wait = deferred(); repositories.set(repo, wait); return wait.promise; },
    loadTask() { calls.push(['latest']); return never; }, loadDiscussion(_repo, _number, kind) { calls.push([kind]); return never; }, loadOptions() { calls.push(['options']); return never; },
    readSignal: () => ({ cached: false }), draft: () => null, commentDraft: () => null, preference: () => ({ query: '', state: 'all' }), repositoryKey: repo => repo,
    saveViewState: async () => {},
  };
  const context = createContext({
    state, store, selection, document: { activeElement: null }, Promise,
    flushDrafts: () => draftFailure ? Promise.reject(new Error('本机存储失败')) : Promise.resolve(), persistPreference: () => { calls.push(['preference-save']); return never; },
    captureInputs() {}, announce() {}, esc: String, action: () => '', openModal() { calls.push(['blocked-modal']); },
    resetDetail() { state.editor = null; state.selected = null; }, renderRows() {}, renderNav() {}, renderQueue() {}, renderAll() {}, syncLayout() {}, closeOverlay() {},
    renderDetail() { bodies.push(state.selected); }, updateFilterOptions() {}, renderDiscussionOnly() {}, renderTaskOnly() {}, renderBackgroundStatus() {}, status() {}, hasEditor: () => false,
    $: node, permission: () => true, current: () => ({ commentItems: [] }),
  });
  new Script(`${controller}\nglobalThis.open = openIssue; globalThis.switchRepo = switchRepository;`).runInContext(context);
  return { context, state, calls, bodies, reads, repositories, nodes };
}

test('单击Issue同步选中，偏好与会话未决请求不阻塞正文', async () => {
  const p = page(), opening = p.context.open(7);
  assert.equal(p.state.selected, 7); assert.match(p.nodes.get('#detail').innerHTML, /正在读取/);
  assert.equal(p.calls.filter(call => call[0] === 'read-summary').length, 1);
  await p.context.open(7); assert.equal(p.calls.filter(call => call[0] === 'read-summary').length, 1);
  p.reads.get(7).resolve(); await opening; await tick();
  assert.deepEqual(p.bodies, [7]); assert.ok(p.calls.some(call => call[0] === 'latest')); assert.ok(p.calls.some(call => call[0] === 'comments'));
});

test('快速单击两条Issue，后到旧响应不能跳回上一条', async () => {
  const p = page(); const first = p.context.open(7), second = p.context.open(8);
  assert.equal(p.state.selected, 8);
  p.reads.get(8).resolve(); await second; p.reads.get(7).resolve(); await first;
  assert.deepEqual(p.bodies, [8]); assert.equal(p.state.selected, 8);
});

test('冷名称键在详情读取期间被规范键替换时继续读取当前Issue', async () => {
  const p = page(); let key = 'raw-key'; p.context.store.repositoryKey = () => key;
  const opening = p.context.open(7), first = p.reads.get(7);
  key = 'stable-key'; first.reject(Object.assign(new Error('键已替换'), { code: 'stale' }));
  await opening; await tick();
  const retry = p.reads.get(7); assert.notEqual(retry, first); retry.resolve(); await tick();
  assert.equal(p.state.selected, 7); assert.deepEqual(p.bodies, [7]);
});

test('仓库单击同步切换，候选未决时列表仍退出加载态', async () => {
  const p = page(), switching = p.context.switchRepo('owner/two');
  assert.equal(p.state.repo, 'owner/two'); assert.equal(p.state.loading, true);
  p.repositories.get('owner/two').resolve(); await switching;
  assert.equal(p.state.loading, false); assert.ok(p.calls.some(call => call[0] === 'options'));
});

test('未保存输入的本机持久化失败时阻止离开并保留表单', async () => {
  const p = page({ dirty: true, draftFailure: true }); await p.context.open(7);
  assert.equal(p.state.selected, 1); assert.equal(p.state.editor.title, '改动'); assert.equal(p.reads.size, 0);
  assert.ok(p.calls.some(call => call[0] === 'blocked-modal'));
});

test('草稿保存期间点回当前Issue或仓库会取消待切换，已发读取的重复点击仍复用', async () => {
  const p = page({ dirty: true }), saved = deferred();
  p.context.flushDrafts = () => saved.promise;
  const leaving = p.context.open(7); await p.context.open(1);
  saved.resolve(); await leaving;
  assert.equal(p.state.selected, 1); assert.equal(p.reads.size, 0);
  const q = page({ dirty: true }), savedRepo = deferred();
  q.context.flushDrafts = () => savedRepo.promise;
  const switching = q.context.switchRepo('owner/two'); await q.context.switchRepo('owner/one');
  savedRepo.resolve(); await switching;
  assert.equal(q.state.repo, 'owner/one'); assert.equal(q.repositories.size, 0);
  const r = page(), pendingRead = r.context.open(7); await r.context.open(7);
  r.reads.get(7).resolve(); await pendingRead;
  assert.deepEqual(r.bodies, [7]); assert.equal(r.calls.filter(call => call[0] === 'read-summary').length, 1);
});

function layoutPage(width = 1120) {
  function separator(column) {
    const listeners = new Map(), attributes = new Map(), captures = new Set();
    return { dataset: { column }, hidden: false, listeners, attributes, addEventListener: (name, fn) => listeners.set(name, fn), setAttribute: (name, value) => attributes.set(name, value), focus() {}, setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id) };
  }
  const nodes = [separator('navigation'), separator('queue')], commits = [], variables = new Map();
  const root = { clientWidth: width, dataset: {}, style: { setProperty: (key, value) => variables.set(key, value) }, querySelectorAll: () => nodes };
  const view = { innerWidth: width, addEventListener() {} };
  const layout = createColumnLayout({ root, view, onCommit: value => commits.push(value) }); layout.sync(true);
  const fire = (index, name, values = {}) => nodes[index].listeners.get(name)({ button: 0, pointerId: 1, clientX: 164, preventDefault() {}, stopPropagation() {}, ...values });
  return { root, nodes, commits, variables, layout, fire };
}

test('两条分割线有界拖动，结束前不触发持久化回调', () => {
  const p = layoutPage();
  p.fire(0, 'pointerdown'); p.fire(0, 'pointermove', { clientX: 9000 });
  assert.equal(p.commits.length, 0); assert.equal(p.layout.snapshot().navigationWidth, 420);
  p.fire(0, 'pointerup', { clientX: 9000 }); assert.equal(p.commits.length, 1);
  p.fire(1, 'pointerdown', { clientX: 736 }); p.fire(1, 'pointermove', { clientX: 9000 });
  const widths = p.layout.snapshot(); assert.ok(1120 - widths.navigationWidth - widths.queueWidth >= 360);
  assert.equal(p.commits.length, 1); p.fire(1, 'pointerup'); assert.equal(p.commits.length, 2);
});

test('分割线键盘与恢复默认可用，取消拖动不保存', () => {
  const p = layoutPage(); p.fire(0, 'keydown', { key: 'ArrowRight' });
  assert.equal(p.layout.snapshot().navigationWidth, 180); assert.equal(p.nodes[0].attributes.get('aria-valuenow'), '180');
  p.fire(0, 'keydown', { key: 'Enter' }); assert.equal(p.layout.snapshot().navigationWidth, 164);
  const count = p.commits.length; p.fire(0, 'pointerdown'); p.fire(0, 'pointermove', { clientX: 300 }); p.fire(0, 'pointercancel');
  assert.equal(p.layout.snapshot().navigationWidth, 164); assert.equal(p.commits.length, count);
});

test('窗口收窄只约束实际列宽，保留偏好并沿用抽屉和单详情', () => {
  const p = layoutPage(); p.layout.restore({ navigationWidth: 420, queueWidth: 640 });
  p.root.clientWidth = 960; p.layout.sync(true);
  assert.equal(p.nodes[0].hidden, true); assert.equal(p.nodes[1].hidden, false); assert.equal(p.layout.snapshot().queueWidth, 600);
  assert.equal(p.layout.preferences().queueWidth, 640);
  p.root.clientWidth = 860; p.layout.sync(true); assert.equal(p.nodes[1].hidden, true);
  const actual = constrainWidths({ navigationWidth: 10000, queueWidth: 10000 }, 1120); assert.equal(actual.navigationWidth, 420); assert.ok(actual.queueWidth <= 640);
});
