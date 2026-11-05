import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';
import { LiveStore, StoreError } from '../ui/store.mjs';
import { button, esc, taskAction, taskText } from '../ui/ui.mjs';
import { taskCandidatesMarkup, taskDescription, taskDetailsMarkup, taskHistoryMarkup, workspacePickerMarkup } from '../ui/task-views.mjs';
import { readDiagnostics, diagnosticsMarkup } from '../ui/diagnostics.mjs';

const repo = { key: 'a'.repeat(20), fullName: 'team/one', workspaces: [] };
const envelope = data => ({ schemaVersion: 1, identity: 42, data });
const bootstrap = () => envelope({ account: { id: 42, login: 'member' }, repositories: [repo], drafts: {}, preferences: {} });
const current = { id: 'current', requestId: 'current', status: 'ambiguous', title: '当前任务', path: 'E:/Original', reference: '任务引用：issue-hub:actual-nonce', candidates: [{ threadId: 'verified-thread', title: '已核验候选', path: 'E:/Original' }] };
const historical = { id: 'historical', requestId: 'historical', status: 'linked', title: '此前任务', threadId: 'old-thread', path: 'E:/Old' };
const record = () => ({ current: structuredClone(current), history: [structuredClone(historical)], binding: { workspaceKey: 'one', id: 'one', path: 'E:/Original', valid: true }, workspaces: [{ key: 'one', name: '原工作区', path: 'E:/Original', valid: true }, { key: 'two', name: '另一工作区', path: 'E:/Later', valid: true }] });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };

test('修改默认绑定只bind，现有关联与历史仍保留原工作区', async () => {
  const calls = [];
  const store = new LiveStore(async (_group, action, payload) => {
    calls.push({ action, payload });
    if (action === 'bootstrap') return bootstrap();
    if (action === 'latest') return envelope(record());
    return envelope({ binding: { workspaceKey: 'two', id: 'two', path: 'E:/Later', valid: true } });
  });
  await store.load(); await store.loadTask(repo.fullName, 7); await store.bind(repo.fullName, 'two');
  assert.deepEqual(calls.map(call => call.action), ['bootstrap', 'latest', 'bind']);
  assert.equal(calls.at(-1).payload.expectedIdentity, '42');
  const result = store.task(repo.fullName, 7); assert.equal(result.binding.path, 'E:/Later'); assert.equal(result.current.path, 'E:/Original'); assert.equal(result.history[0].path, 'E:/Old');
});

test('历史返回仅接受自有已确认请求，调用后不把历史设成当前任务', async () => {
  const calls = [];
  const store = new LiveStore(async (_group, action, payload) => { calls.push({ action, payload }); return action === 'bootstrap' ? bootstrap() : envelope(record()); });
  await store.load(); await store.loadTask(repo.fullName, 7);
  await assert.rejects(store.openHistory(repo.fullName, 7, 'arbitrary-thread'), error => error.code === 'task-history');
  assert.equal(calls.filter(call => call.action === 'open-history').length, 0);
  await store.openHistory(repo.fullName, 7, 'historical');
  assert.deepEqual(calls.at(-1).payload, { repositoryKey: repo.key, number: 7, requestId: 'historical', expectedIdentity: '42' });
  assert.equal(store.task(repo.fullName, 7).current.id, 'current');
});

test('首次和明确另建允许新请求，已有会话返回必须精确复用而不回退新建', async () => {
  const opens = [];
  const store = new LiveStore(async (_group, action, payload) => {
    if (action === 'bootstrap') return bootstrap();
    opens.push(payload);
    return envelope({ ...record(), current: { ...current, status: 'linked', threadId: 'confirmed-thread' } });
  });
  await store.load();
  await store.createTask(repo.fullName, 7);
  await store.createTask(repo.fullName, 7);
  await store.createTask(repo.fullName, 7, { another: true });
  assert.deepEqual(opens.map(payload => payload.reuseOnly), [false, true, false]);
  assert.deepEqual(opens.map(payload => payload.another), [false, false, true]);
  assert.equal(opens[1].requestId, 'current');
  assert.ok(opens.every(payload => payload.expectedIdentity === '42'));
});

test('返回已确认会话直接请求精确复用，即使整批目录仍待核对', async () => {
  const linked = { ...record(), current: { ...current, status: 'linked', threadId: 'confirmed-thread' } };
  const calls = [];
  const store = new LiveStore(async (_group, action, payload) => {
    calls.push({ action, payload });
    if (action === 'bootstrap') return bootstrap();
    if (action === 'latest' || action === 'open') return envelope(linked);
    throw new Error('返回不应请求整批项目');
  });
  await store.load(); await store.loadTask(repo.fullName, 7);
  store.refreshNeeded = true;
  await store.createTask(repo.fullName, 7);
  assert.deepEqual(calls.map(call => call.action), ['bootstrap', 'latest', 'open']);
  assert.equal(calls.at(-1).payload.reuseOnly, true);
  assert.equal(calls.at(-1).payload.requestId, linked.current.requestId);
});

test('同一请求的后台和手动检查共享调用，仓库失权后丢弃迟到关联', async () => {
  const response = deferred(), calls = [];
  const pending = { ...record(), current: { ...current, status: 'pending' } };
  const store = new LiveStore(async (_group, action) => {
    if (action === 'bootstrap') return bootstrap();
    if (action === 'latest') return envelope(pending);
    calls.push(action); return response.promise;
  });
  await store.load(); await store.loadTask(repo.fullName, 7);
  const background = store.checkTask(repo.fullName, 7), manual = store.checkTask(repo.fullName, 7);
  await Promise.resolve();
  assert.deepEqual(calls, ['check']);
  store.invalidateRepository(repo.fullName);
  response.resolve(envelope({ ...pending, current: { ...pending.current, status: 'linked', threadId: 'confirmed-thread' } }));
  await Promise.all([background, manual]);
  assert.equal(store.task(repo.fullName, 7).current, null);
});

test('检查期间发出的旧恢复读取不能覆盖已确认关联', async () => {
  const checking = deferred(), latest = deferred();
  const pending = { ...record(), current: { ...current, status: 'pending' } };
  let first = true;
  const store = new LiveStore(async (_group, action) => {
    if (action === 'bootstrap') return bootstrap();
    if (action === 'check') return checking.promise;
    if (first) { first = false; return envelope(pending); }
    return latest.promise;
  });
  await store.load(); await store.loadTask(repo.fullName, 7);
  const check = store.checkTask(repo.fullName, 7), restore = store.loadTask(repo.fullName, 7);
  checking.resolve(envelope({ ...pending, current: { ...pending.current, status: 'linked', threadId: 'confirmed-thread' } }));
  await check;
  latest.resolve(envelope(pending)); await restore;
  assert.equal(store.task(repo.fullName, 7).current.status, 'linked');
});

test('歧义确认只发送当前请求的服务候选，旧请求与伪造候选被拒绝', async () => {
  const calls = [];
  const store = new LiveStore(async (_group, action, payload) => {
    calls.push({ action, payload }); return action === 'bootstrap' ? bootstrap() : envelope(action === 'resolve' ? { ...record(), current: { ...current, status: 'linked', threadId: payload.threadId, associationSource: 'user-confirmed' } } : record());
  });
  await store.load(); await store.loadTask(repo.fullName, 7);
  await assert.rejects(store.resolveTask(repo.fullName, 7, 'verified-thread', 'old-request'), error => error.code === 'task-candidate');
  await assert.rejects(store.resolveTask(repo.fullName, 7, 'guessed-thread', 'current'), error => error.code === 'task-candidate');
  assert.equal(calls.filter(call => call.action === 'resolve').length, 0);
  await store.resolveTask(repo.fullName, 7, 'verified-thread', 'current');
  assert.deepEqual(calls.at(-1).payload, { requestId: 'current', threadId: 'verified-thread', confirmed: true, expectedIdentity: '42' });
  assert.equal(store.task(repo.fullName, 7).current.associationSource, 'user-confirmed');
});

test('迟到的候选确认结果不能覆盖用户随后创建的新任务', async () => {
  const resolving = deferred();
  const store = new LiveStore(async (_group, action) => action === 'bootstrap' ? bootstrap() : action === 'resolve' ? resolving.promise : envelope(action === 'open' ? { ...record(), current: { id: 'new', requestId: 'new', status: 'requested' } } : record()));
  await store.load(); await store.loadTask(repo.fullName, 7);
  const first = store.resolveTask(repo.fullName, 7, 'verified-thread', 'current');
  await store.createTask(repo.fullName, 7, { another: true });
  resolving.resolve(envelope({ ...record(), current: { ...current, status: 'linked', threadId: 'verified-thread' } })); await first;
  assert.equal(store.task(repo.fullName, 7).current.id, 'new');
});

test('任务弹层使用真实首行引用、原路径和后续绑定，不默认代选候选', () => {
  const input = record(); input.binding.path = 'E:/Later';
  const html = taskDetailsMarkup(input);
  assert.match(html, /任务引用：issue-hub:actual-nonce/); assert.match(html, /当前会话原工作区/); assert.match(html, /E:\/Original/); assert.match(html, /后续新任务工作区/); assert.match(html, /E:\/Later/);
  assert.doesNotMatch(html, /name="task-candidate"[^>]*checked/); assert.match(html, /data-request-id="current"/);
  const history = taskHistoryMarkup({ history: [historical, { ...historical, requestId: 'pending', status: 'pending', threadId: null }] });
  assert.equal((history.match(/data-action="task-history-open"/g) || []).length, 1);
  assert.match(history, /不会更改当前优先任务/);
});

const source = await readFile(new URL('../ui/app.mjs', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const handler = section('async function handleAction(', "document.addEventListener('click'");
const operation = section('function currentTaskOperation()', 'function stopTaskAssociation()');

function associationPage(check) {
  const state = { repo: repo.fullName, selected: 7 }, document = { hidden: false }, timers = new Map();
  const result = { ...current, status: 'requested', candidates: [] };
  const primary = { innerHTML: '', disabled: false, setAttribute() {} };
  const dialogButton = { dataset: { requestId: current.requestId, action: 'task-check' }, textContent: '检查关联' };
  const nodes = new Map([
    ['#task-primary', primary], ['.action-row', { classList: { toggle() {} }, insertAdjacentHTML() {} }],
    ['#task-association-primary', dialogButton], ['.task-status', { dataset: { requestId: current.requestId } }],
    ['.task-description', {}], ['#modal-title', {}], ['.task-candidate-list', {}],
  ]);
  let timerId = 0, calls = 0;
  const store = {
    identity: 42, task: () => ({ current: structuredClone(result) }),
    async checkTask() { Object.assign(result, await check(++calls)); },
  };
  const context = createContext({
    state, document, store, current: () => ({}), overlay: {},
    $: selector => nodes.get(selector), $$: () => [], esc, icon: () => '', taskText, taskAction, taskDestination: () => '',
    taskDescription, taskCandidatesMarkup,
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  new Script(`
    let detailGeneration = 1, taskBusy = null, taskPreparing = false, workspaceSaving = false;
    ${section('const associationRetryDelays', 'async function openTask(')}
    ${section('function renderTaskOnly()', 'async function hydrateIssue(')}
    globalThis.wake = () => scheduleTaskAssociation(true);
    globalThis.draw = renderTaskOnly;
    globalThis.nextDetail = () => { detailGeneration++; stopTaskAssociation(); };
  `).runInContext(context);
  return {
    state, document, result, primary, dialogButton, timers, context, get calls() { return calls; },
    async tick() {
      const [next] = timers.entries();
      if (next) { timers.delete(next[0]); await next[1](); }
    },
  };
}

test('暂忙时保留自动关联，页面重新可见后确认会话并就地更新两个返回入口', async () => {
  let sent = false;
  const p = associationPage(async () => sent ? { status: 'linked', threadId: 'confirmed-thread' } : { status: 'pending' });
  p.state.saving = true;
  p.context.wake(); await p.tick();
  assert.equal(p.calls, 0); assert.equal(p.timers.size, 1);
  p.state.saving = false; await p.tick();
  assert.equal(p.calls, 1); assert.doesNotMatch(p.primary.innerHTML, /返回会话/);
  p.document.hidden = true; p.context.wake(); await p.tick();
  assert.equal(p.calls, 1); assert.equal(p.timers.size, 0);
  sent = true; p.document.hidden = false;
  p.context.wake(); p.context.wake(); await p.tick();
  assert.equal(p.calls, 2);
  assert.equal(p.primary.innerHTML, '返回会话'); assert.equal(p.primary.disabled, false);
  assert.equal(p.dialogButton.textContent, '返回会话'); assert.equal(p.dialogButton.dataset.action, 'return-task');
  assert.equal(p.timers.size, 0);
});

test('宿主连接关闭后迟到的任务反馈不重新启用主按钮', () => {
  const p = associationPage(async () => ({}));
  p.context.store.closed = true;
  p.primary.disabled = true;
  p.context.draw();
  assert.equal(p.primary.disabled, true);
});

test('自动核对有次数上限，切换详情后迟到结果不绘制旧关联', async () => {
  const waiting = associationPage(async () => ({ status: 'pending' }));
  waiting.context.wake();
  for (let attempt = 0; attempt < 10; attempt++) await waiting.tick();
  assert.equal(waiting.calls, 6); assert.equal(waiting.timers.size, 0);

  const response = deferred(), p = associationPage(() => response.promise);
  p.context.wake(); const checking = p.tick();
  p.context.nextDetail(); p.state.selected = 8;
  response.resolve({ status: 'linked', threadId: 'old-thread' }); await checking;
  assert.equal(p.primary.innerHTML, ''); assert.equal(p.dialogButton.dataset.action, 'task-check');
  assert.equal(p.timers.size, 0);
});

test('手动检查结束清理主按钮忙态，关联确认后可直接返回', async () => {
  const result = { ...current, status: 'pending' }, feedback = [];
  const state = { repo: repo.fullName, selected: 7 };
  const store = { identity: 42, task: () => ({ current: result }), async checkTask() { result.status = 'linked'; result.threadId = 'confirmed-thread'; } };
  const context = createContext({ state, store, feedback, paintTaskAssociation() {} });
  new Script(`let detailGeneration = 1, overlayGeneration = 0, taskBusy = null;
    ${operation}
    function renderTaskOnly() { feedback.push(currentTaskOperation()?.label || store.task().current.status); }
    ${handler}
    globalThis.act = handleAction;`).runInContext(context);
  const target = { dataset: { requestId: current.requestId }, isConnected: true };
  await context.act('task-check', target, {});
  assert.deepEqual(feedback, ['正在检查关联…', 'linked']);
  assert.equal(target.disabled, false);
});

test('返回已确认会话给出打开反馈，保存期间换掉关联后停止原点击', async () => {
  const result = { ...current, status: 'linked', threadId: 'confirmed-thread' }, calls = [];
  const state = { repo: repo.fullName, selected: 7, draftSaved: true };
  const store = { identity: 42, task: () => ({ current: structuredClone(result) }), async createTask() { calls.push('open'); } };
  const save = deferred();
  const context = createContext({
    state, store, calls, StoreError, current: () => ({}), closeOverlay() {}, showTask() {}, scheduleTaskAssociation() {},
    async flushDrafts() { calls.push('flush'); await save.promise; },
  });
  new Script(`let detailGeneration = 1, overlayGeneration = 0, taskBusy = null;
    ${operation}
    function renderTaskOnly() { calls.push(currentTaskOperation()?.label || '空闲'); }
    ${section('async function openTask(', 'async function createTask(')}
    globalThis.run = openTask;`).runInContext(context);
  await context.run(false, undefined, current.requestId);
  assert.deepEqual(calls, ['正在打开会话…', 'open', '空闲']);

  state.draftSaved = false;
  const attributes = {};
  const target = { textContent: '返回会话', isConnected: true, disabled: false, setAttribute(name, value) { attributes[name] = value; } };
  const opening = context.run(false, undefined, current.requestId, target);
  assert.equal(target.textContent, '正在打开会话…'); assert.equal(target.disabled, true); assert.equal(attributes['aria-busy'], 'true');
  result.requestId = 'replacement';
  save.resolve();
  await assert.rejects(opening, /当前会话关联已变化/);
  assert.equal(target.textContent, '返回会话'); assert.equal(target.disabled, false); assert.equal(attributes['aria-busy'], 'false');
  assert.deepEqual(calls.slice(3), ['正在打开会话…', 'flush', '空闲']);
});

test('实际创建任务在首次核对期间立即反馈并阻止连续误点，完成后自动继续', async () => {
  const wait = deferred(), primary = { innerHTML: '创建任务', disabled: false, setAttribute() {} };
  let prepared = 0, loaded = 0, opened = 0;
  const store = { identity: 42, prepareTask: async () => { prepared++; await wait.promise; }, loadTask: async () => { loaded++; }, workspaces: () => [{ id: 'one', valid: true }], binding: () => null, activeNumber: null };
  const context = createContext({ store, state: { repo: repo.fullName, selected: 7 }, current: () => ({}), preserveBefore: async fn => fn(), renderTaskOnly() { primary.disabled = context.busy(); primary.innerHTML = primary.disabled ? '正在核对工作区…' : '创建任务'; }, showWorkspacePicker() { throw new Error('不应要求单路径再次选择'); } });
  new Script(`let detailGeneration = 1, taskBusy = false, taskPreparing = false, taskViewGeneration = 0, overlayGeneration = 0;
    ${operation}
    async function openTask(){ opened++; }
    ${section('async function createTask(', 'function showWorkspacePicker(')}
    globalThis.run = createTask; globalThis.busy = () => Boolean(currentTaskOperation() || currentTaskPreparation());`).runInContext(context);
  // 只执行实际控制器，打开替身不会启动任何原生聊天。
  context.opened = 0;
  const first = context.run(false), duplicate = context.run(false);
  assert.equal(primary.disabled, true); assert.match(primary.innerHTML, /正在核对工作区/);
  assert.equal(prepared, 1); assert.equal(loaded, 0);
  wait.resolve(); await Promise.all([first, duplicate]);
  opened = context.opened;
  assert.equal(loaded, 1); assert.equal(opened, 1); assert.equal(primary.disabled, false);
});

test('切换详情后新任务准备不受旧等待影响，旧准备完成也不读取或打开任务', async () => {
  const old = deferred(), calls = [];
  const state = { repo: repo.fullName, selected: 7 };
  const store = {
    identity: 42, prepareTask() { calls.push(['prepare', state.selected]); return state.selected === 7 ? old.promise : Promise.resolve(); },
    async loadTask(_repo, number) { calls.push(['latest', number]); },
    workspaces: () => [{ id: 'one', valid: true }], binding: () => null,
  };
  const context = createContext({ state, store, calls, current: () => ({}), preserveBefore: callback => callback(), renderTaskOnly() {} });
  new Script(`let detailGeneration = 1, taskBusy = null, taskPreparing = null, taskViewGeneration = 0, overlayGeneration = 0;
    ${operation}
    function openTask() { calls.push(['open', state.selected]); }
    ${section('async function createTask(', 'function showWorkspacePicker(')}
    globalThis.run = createTask; globalThis.changeDetail = () => detailGeneration++;`).runInContext(context);
  const before = context.run(false);
  state.selected = 8; context.changeDetail();
  await context.run(false);
  old.resolve(); await before;
  assert.deepEqual(structuredClone(calls), [['prepare', 7], ['prepare', 8], ['latest', 8], ['open', 8]]);
});

for (const change of ['issue', 'repository', 'identity']) {
  test(`实际创建入口保留草稿期间切换${change}后不把点击应用到新对象`, async () => {
    const saving = deferred(), calls = [];
    const state = { repo: repo.fullName, selected: 7 };
    const store = { identity: 42, prepareTask: async () => calls.push('prepare'), loadTask: async () => calls.push('latest'), workspaces: () => [{ id: 'one', valid: true }], binding: () => null };
    const context = createContext({ state, store, current: () => ({}), preserveBefore: async callback => { await saving.promise; return callback(); }, renderTaskOnly() {}, showWorkspacePicker() {}, opened: 0 });
    new Script(`let detailGeneration = 1, taskBusy = false, taskPreparing = false, taskViewGeneration = 0, overlayGeneration = 0;
      ${operation}
      async function openTask(){ opened++; }
      ${section('async function createTask(', 'function showWorkspacePicker(')}
      globalThis.run = createTask;`).runInContext(context);
    const pending = context.run(false);
    if (change === 'issue') state.selected = 8;
    else if (change === 'repository') state.repo = 'team/other';
    else store.identity = 99;
    saving.resolve(); await pending;
    assert.equal(calls.length, 0); assert.equal(context.opened, 0);
  });
}

test('实际任务按钮绘制展示核对文字和忙碌语义，结束后恢复创建入口', () => {
  const attributes = {}, primary = { innerHTML: '', disabled: false, setAttribute: (key, value) => { attributes[key] = value; } }, row = { classList: { toggle() {} }, insertAdjacentHTML() {} };
  const context = createContext({ state: { repo: repo.fullName, selected: 7 }, store: { task: () => ({ current: null }) }, $: selector => selector === '#task-primary' ? primary : selector === '.action-row' ? row : null, icon: () => '', esc, taskAction: () => '创建任务', taskDestination: () => '' });
  new Script(`let detailGeneration = 1, taskBusy = false, taskPreparing = { generation: 1 }; ${operation} ${section('function renderTaskOnly()', 'async function hydrateIssue(')}
    globalThis.render = renderTaskOnly; globalThis.end = () => { taskPreparing = false; renderTaskOnly(); };`).runInContext(context);
  context.render(); assert.equal(primary.disabled, true); assert.equal(attributes['aria-busy'], 'true'); assert.match(primary.innerHTML, /正在核对工作区/);
  context.end(); assert.equal(primary.disabled, false); assert.equal(attributes['aria-busy'], 'false'); assert.equal(primary.innerHTML, '创建任务');
});

for (const change of ['issue', 'repository', 'identity']) {
  test(`实际打开任务在草稿保存期间切换${change}后不创建旧请求`, async () => {
    const saving = deferred(), calls = [];
    const state = { repo: repo.fullName, selected: 7 };
    const store = { identity: 42, task: () => ({ current: null }), createTask: async (...args) => calls.push(args) };
    const context = createContext({ state, store, current: () => ({}), flushDrafts: () => saving.promise, renderTaskOnly() {}, closeOverlay() {}, showTask() {}, scheduleTaskAssociation() {} });
    new Script(`let taskBusy = false, overlayGeneration = 0, detailGeneration = 1;
      ${operation}
      ${section('async function openTask(', 'async function createTask(')}
      globalThis.run = openTask;`).runInContext(context);
    const pending = context.run(false);
    if (change === 'issue') state.selected = 8;
    else if (change === 'repository') state.repo = 'team/other';
    else store.identity = 99;
    saving.resolve(); await pending;
    assert.equal(calls.length, 0);
  });
}

test('实际控制器有效绑定也可修改，取消不bind，确认绑定不open', async () => {
  const calls = [], state = { repo: repo.fullName, selected: 7 }, choices = record().workspaces;
  const context = createContext({
    state, store: { identity: 42, async loadTask() { calls.push('latest'); }, workspaces: () => choices.map(item => ({ ...item, id: item.key })), binding: () => record().binding, async bind(_repo, chosen) { calls.push(['bind', chosen]); } },
    preserveBefore: callback => callback(), workspacePickerMarkup, action: (name, text, style) => button(name, text, { className: style }),
    calls, $: () => ({ value: 'two' }), overlay: {}, announce() {}, renderTaskOnly() {}, showTask() { calls.push('show-current'); }, openTask() { calls.push('open'); },
  });
  const setup = `let taskIntent = null, taskBusy = false, workspaceSaving = false, taskViewGeneration = 0, overlayGeneration = 0, modal = null;
    function closeOverlay(){ overlayGeneration++; const closing = modal; modal = null; closing?.options?.onClose?.(); }
    function openModal(title, body, footer, options){ closeOverlay(); modal = {title,body,footer,options}; calls.push({title,body,footer}); }
    globalThis.intent = () => taskIntent;`;
  new Script(`${setup}\n${section('function showWorkspacePicker(', 'async function showTaskHistory(')}\n${handler}\nglobalThis.change = changeWorkspace; globalThis.act = handleAction;`).runInContext(context);
  await context.change(); assert.equal(context.intent().mode, 'bind'); assert.match(calls.at(-1).footer, /保存工作区/);
  await context.act('close-overlay', {}, {}); assert.equal(context.intent(), null);
  await context.act('confirm-workspace', { dataset: {}, isConnected: true }, {}); assert.equal(calls.some(call => Array.isArray(call) && call[0] === 'bind'), false);
  await context.change(); await context.act('confirm-workspace', { dataset: {}, isConnected: true }, {});
  assert.deepEqual(calls.filter(call => Array.isArray(call)), [['bind', 'two']]); assert.equal(calls.includes('open'), false);
});

const diagnostics = () => ({ schemaVersion: 1, data: { status: 'warning', checks: [{ id: 'github', label: 'GitHub 登录', status: 'warning', message: '尚未登录', action: '请执行 gh auth login' }], discovery: { status: 'partial', warnings: ['子仓库发现达到本次范围上限'] }, sampledAt: '2026-11-04' } });
test('未登录仍可直接检查连接，额外错误和凭据字段不进入页面', async () => {
  let args;
  const data = await readDiagnostics(async input => { args = input; return { structuredContent: { ...diagnostics(), token: 'SECRET_TOKEN', stderr: 'RAW_STDERR' } }; });
  assert.deepEqual(args, { name: 'issue-hub-diagnostics', arguments: {} });
  assert.equal(Object.hasOwn(data, 'identity'), false);
  const html = diagnosticsMarkup(data); assert.match(html, /gh auth login/); assert.doesNotMatch(html, /子仓库发现达到本次范围上限|SECRET_TOKEN|RAW_STDERR/);
  await assert.rejects(readDiagnostics(async () => { throw new Error('token SECRET_TOKEN raw stderr'); }), error => !error.message.includes('SECRET_TOKEN') && !error.message.includes('stderr'));
  const escaped = diagnosticsMarkup(await readDiagnostics(async () => ({ structuredContent: { ...diagnostics(), data: { ...diagnostics().data, checks: [{ label: '<img src=x onerror=alert(1)>', status: 'error', message: '<script>bad()</script>' }] } } })));
  assert.doesNotMatch(escaped, /<img|<script>/); assert.match(escaped, /&lt;script&gt;/);
});

test('项目读取使用固定范围语义，保留未加载与真实不可用状态', async () => {
  for (const [status, label] of [['not-scanned', '尚未读取项目'], ['complete', '已检查既定项目范围'], ['partial', '已检查既定项目范围'], ['unavailable', '暂不可用，保留已有缓存'], ['loading', '正在读取项目'], ['checking', '正在检查项目'], ['unknown-status-code', '尚未取得项目读取结果']]) {
    const data = await readDiagnostics(async () => ({ structuredContent: { ...diagnostics(), data: { ...diagnostics().data, discovery: { status, checking: true, warnings: [] } } } }));
    const html = diagnosticsMarkup(data);
    assert.ok(html.includes(label)); assert.match(html, /正在后台检查项目，当前显示已有结果/); assert.ok(!html.includes(status)); assert.doesNotMatch(html, /不完整|项目发现范围|完整发现/);
  }
});

test('连接检查过滤旧扫描边界和缓存进度说明，仍展示具体目录或Git故障', async () => {
  const warnings = ['DIRECTORY_DEPTH_LIMIT', 'DIRECTORY_LIMIT', 'CATALOG_DEEP_SCAN_PENDING', 'DEEP_SCAN_PENDING', 'CATALOG_CACHE_CHECKING', 'LINK_SKIPPED', '子目录扫描达到深度上限', '子目录扫描达到数量上限', '完整子目录扫描尚未完成', '当前显示项目缓存，正在核对', '部分目录无法访问', '部分仓库的Git信息无法读取'];
  const result = { ...diagnostics(), data: { ...diagnostics().data, discovery: { status: 'partial', warnings } } };
  const data = await readDiagnostics(async () => ({ structuredContent: result }));
  assert.deepEqual(data.discovery.warnings, ['部分目录无法访问', '部分仓库的Git信息无法读取']);
  const html = diagnosticsMarkup(data); assert.match(html, /部分目录无法访问|部分仓库的Git信息无法读取/); assert.doesNotMatch(html, /DIRECTORY_|DEEP_SCAN|CATALOG_CACHE|深度上限|数量上限|完整子目录/);
});

test('关闭或重开连接弹层后，旧诊断响应不能覆盖当前内容', async () => {
  const waits = [], bodies = [];
  const context = createContext({
    app: { callServerTool() { const wait = deferred(); waits.push(wait); return wait.promise; } }, readDiagnostics, diagnosticsMarkup, captureInputs() {}, esc,
    action: (name, text) => button(name, text), overlay: {}, $: () => bodies.at(-1), bodies,
  });
  new Script(`let overlayGeneration = 0;
    function openModal(_title, body){ overlayGeneration++; bodies.push({innerHTML:body}); }
    function closeOverlay(){ overlayGeneration++; }
    ${section('async function showDiagnostics()', 'function showDrawer(')}
    globalThis.show = showDiagnostics; globalThis.close = closeOverlay;`).runInContext(context);
  const first = context.show(), second = context.show();
  waits[1].resolve({ structuredContent: diagnostics() }); await second; const latest = bodies.at(-1).innerHTML;
  waits[0].resolve({ structuredContent: { ...diagnostics(), data: { ...diagnostics().data, checks: [{ label: 'OLD_RESPONSE', status: 'ok' }] } } }); await first;
  assert.equal(bodies.at(-1).innerHTML, latest); assert.doesNotMatch(latest, /OLD_RESPONSE/);
});

test('加载失败且无GitHub身份时实际错误入口仍提供连接检查', () => {
  const nodes = new Map(), node = selector => { if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '' }); return nodes.get(selector); };
  const context = createContext({ state: { loading: false, loadError: '需要登录 GitHub', repo: '' }, store: { identity: null }, $: node, esc, action: (name, text) => button(name, text) });
  new Script(`${section('function renderRows()', 'function syncLayout(')}\nrenderRows();`).runInContext(context);
  assert.match(nodes.get('#issue-list').innerHTML, /data-action="diagnostics"/);
});
