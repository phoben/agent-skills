import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';
import { LiveStore } from '../ui/store.mjs';
import { button, esc, safeUrl } from '../ui/ui.mjs';

const repo = { key: 'a'.repeat(20), fullName: 'team/one', permissions: { manage: true } };
const envelope = data => ({ schemaVersion: 1, identity: 42, data });
const operation = { id: 'confirmed-receipt', status: 'confirmed', number: 7 };
const original = { number: 7, title: '原标题', body: '原正文', state: 'open', revision: 'old-revision', labels: [], permissions: { manage: true } };
const source = await readFile(new URL('../ui/app.mjs', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

test('Issue、评论与状态的confirmed空投影保留成功回执和未发布输入', async () => {
  for (const kind of ['issue', 'comment', 'state']) {
    const store = new LiveStore(async (_group, action) => envelope(action === 'bootstrap' ? { account: { id: 42, login: 'member' }, repositories: [repo], drafts: {}, preferences: {} } : { issue: null, operation, replayed: true, projectionFresh: false, readbackWarning: { code: 'NETWORK_FAILED', message: '读取未完成' } }));
    await store.load(); store.installIssue(repo.fullName, original);
    const draftKey = store.draftKey(repo.fullName, 7, kind === 'comment' ? 'comment' : 'issue');
    store.data.drafts[draftKey] = { text: '保留输入' };
    const request = kind === 'issue' ? store.saveIssue(repo.fullName, { ...original, title: '已提交标题' }) : kind === 'comment' ? store.saveComment(repo.fullName, 7, '已提交评论') : store.changeState(repo.fullName, 7);
    await assert.rejects(request, error => {
      assert.equal(error.operation.status, 'confirmed'); assert.equal(error.operation.id, operation.id); assert.equal(error.projectionFresh, false);
      assert.match(error.message, /提交已确认/); assert.match(error.message, /仅重新读取/); return true;
    });
    assert.equal(store.data.drafts[draftKey].text, '保留输入'); assert.equal(store.issue(repo.fullName, 7).revision, 'old-revision');
  }
});

test('confirmed回执只提供读取恢复，不展示未知或未创建重试入口', () => {
  const nodes = [];
  const context = createContext({
    state: { repo: repo.fullName, writeOutcome: { operation, kind: 'comment' } }, $$: () => [], $: () => ({ after(node) { nodes.push(node); } }),
    document: { createElement: () => ({ innerHTML: '', setAttribute() {} }) }, safeUrl, esc, button,
    action: (name, text) => button(name, text),
  });
  new Script(`${section('function renderWriteOutcome()', 'function commentMarkup(')}\nrenderWriteOutcome();`).runInContext(context);
  const html = nodes[0].innerHTML;
  assert.match(html, /提交已确认/); assert.match(html, /data-action="outcome-readback"/);
  assert.doesNotMatch(html, /data-action="outcome-release"|提交结果尚未确认|已核对未创建/);
});

test('实际读取恢复连续返回空投影时保留回执、输入和只读入口，取得投影后才清理', async () => {
  for (const kind of ['issue', 'comment', 'state']) {
    const calls = [], errors = [], state = { repo: repo.fullName, selected: 7, saving: false, editor: { title: '仍保留的标题', body: '仍保留的正文' }, comment: '仍保留的评论', writeOutcome: { operation: { ...operation }, kind } };
    let fresh = false, resets = 0;
    const context = createContext({
      state, store: { identity: 42, async resolveOperation(_repo, receipt, resolution) { calls.push({ id: receipt.id, resolution }); return { operation: { ...operation }, issue: fresh ? { ...original, revision: 'fresh' } : null, projectionFresh: fresh }; } },
      $: () => ({ textContent: '', hidden: true }), showFormError: message => { errors.push(message); state.formError = message; },
      renderWriteOutcome() { assert.equal(state.writeOutcome.operation.status, 'confirmed'); }, announce: message => errors.push(message),
      resetDetail() { resets++; state.editor = null; state.comment = ''; state.writeOutcome = null; }, renderNav() {}, renderQueue() {}, renderDetail() {},
    });
    new Script(`${section('async function handleAction(', "document.addEventListener('click'")}\nglobalThis.act = handleAction;`).runInContext(context);
    const target = { isConnected: true, disabled: false };
    await context.act('outcome-readback', target, {}); await context.act('outcome-readback', target, {});
    assert.equal(resets, 0); assert.equal(state.writeOutcome.operation.id, operation.id); assert.equal(state.writeOutcome.operation.status, 'confirmed');
    assert.equal(state.editor.title, '仍保留的标题'); assert.equal(state.comment, '仍保留的评论');
    assert.ok(errors.every(message => !/手动提交|允许重试|重新提交/.test(message)));
    assert.deepEqual(calls, [{ id: operation.id, resolution: 'readback' }, { id: operation.id, resolution: 'readback' }]);
    fresh = true; await context.act('outcome-readback', target, {});
    assert.equal(resets, 1); assert.equal(state.writeOutcome, null); assert.equal(state.selected, 7); assert.match(state.notice, /没有再次发布/);
    assert.ok(calls.every(call => call.resolution === 'readback'));
  }
});
