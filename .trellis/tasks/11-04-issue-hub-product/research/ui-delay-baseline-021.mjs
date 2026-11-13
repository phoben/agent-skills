// 使用改动前的实际控制器函数与可控未决请求，定位选中反馈的串行阻塞。
import { readFile, writeFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';
const source = await readFile(new URL('../../../../packages/issue-hub/ui/app.mjs', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const functions = section('async function preserveBefore(', 'function scheduleDraft(') + '\nlet detailGeneration = 0;\n' + section('async function openIssue(', 'function closeDetail(');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };
const preference = deferred(), detail = deferred(), task = deferred(), calls = [];
const state = { repo: 'owner/repo', selected: null, saving: false, filters: {}, comment: '', editor: null };
let bodyRenders = 0;
const node = { innerHTML: '', scrollTop: 0 };
const context = createContext({
  state, store: { identity: 1, loadIssue: () => { calls.push('read'); return detail.promise; }, loadTask: () => { calls.push('latest'); return task.promise; }, draft: () => null, commentDraft: () => null },
  flushDrafts: async () => {}, persistPreference: () => { calls.push('preference-save'); return preference.promise; }, announce() {},
  resetDetail() { state.editor = null; state.selected = null; }, renderRows() {}, syncLayout() {},
  renderDetail() { bodyRenders++; }, $: () => node, permission: () => true, current: () => ({ commentItems: [] }),
});
new Script(`${functions}\nglobalThis.open = openIssue;`).runInContext(context);
const pending = context.open(7);
await new Promise(resolve => setImmediate(resolve));
const beforePreference = { selected: state.selected, bodyRenders, calls: [...calls] };
preference.resolve(); await new Promise(resolve => setImmediate(resolve));
const beforeRead = { selected: state.selected, bodyRenders, calls: [...calls] };
detail.resolve(); await new Promise(resolve => setImmediate(resolve));
const beforeTask = { selected: state.selected, bodyRenders, calls: [...calls] };
task.resolve(); await pending;
const result = { checkedAt: new Date().toISOString(), source: '改动前实际 openIssue/preserveBefore', syntheticPendingRequests: true, beforePreference, beforeRead, beforeTask, final: { selected: state.selected, bodyRenders }, conclusions: { unrelatedPreferenceBlocksSelection: beforePreference.selected === null, taskBlocksReadableBody: beforeTask.bodyRenders === 0 } };
await writeFile(new URL('./ui-delay-baseline-021.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
