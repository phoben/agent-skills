import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PrototypeStore } from './store.mjs';

// 用独立内存存储核对数据契约，不代替浏览器、GitHub 或宿主联调。
const fixture = JSON.parse(await readFile(new URL('./fixture.json', import.meta.url), 'utf8'));
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}
const storage = new MemoryStorage();
const make = (scenario, run = scenario) => new PrototypeStore(fixture, { scenario, run, storage });
const repo = fixture.repository.fullName;

const basic = make('normal');
const original = basic.issue(repo, 184);
const changed = await basic.saveIssue(repo, { ...original, title: '保存后可重新读取', labels: ['enhancement'], assignee: '陈雨', milestone: '桌面协作 v0.3' });
assert.equal(make('normal').issue(repo, 184).title, '保存后可重新读取');
assert.deepEqual(changed.labels, ['enhancement']);
await basic.saveComment(repo, 184, '本机评论读回检查');
assert.equal(make('normal').issue(repo, 184).commentItems.at(-1).text, '本机评论读回检查');
await basic.saveComment(repo, 184, '修改本人的评论', 'c-1');
assert.equal(basic.issue(repo, 184).commentItems[0].text, '修改本人的评论');
await assert.rejects(basic.saveComment(repo, 184, '不能修改他人', 'c-2'), { code: 'permission' });
const created = await basic.saveIssue(repo, { title: '新建检查', body: '正文', labels: [], assignee: '未分配', milestone: '' });
assert.equal(created.number, 185);
assert.equal((await basic.changeState(repo, 185)).state, 'closed');
assert.equal((await basic.changeState(repo, 185)).state, 'open');

const failed = make('save-error');
const retained = { ...failed.issue(repo, 184), body: '保存失败期间的输入' };
failed.saveDraft(repo, 184, 'issue', retained);
await assert.rejects(failed.saveIssue(repo, retained), { code: 'save' });
assert.equal(failed.draft(repo, 184, 'issue').body, retained.body);
await failed.saveIssue(repo, retained);
assert.equal(make('save-error').issue(repo, 184).body, retained.body);
assert.equal(failed.draft(repo, 184, 'issue'), null);

const conflict = make('conflict');
const local = { ...conflict.issue(repo, 184), body: '本机编辑不应丢失' };
conflict.saveDraft(repo, 184, 'issue', local);
await assert.rejects(conflict.saveIssue(repo, local), { code: 'conflict' });
assert.equal(conflict.draft(repo, 184, 'issue').body, local.body);
assert.match(conflict.issue(repo, 184).body, /远端补充/);
await conflict.saveIssue(repo, local, { force: true });
assert.equal(make('conflict').issue(repo, 184).body, local.body);

const offline = make('offline');
offline.saveDraft(repo, 184, 'comment:c-1', { text: '离线草稿', commentId: 'c-1' });
await assert.rejects(offline.saveComment(repo, 184, '不能离线发布'), { code: 'offline' });
assert.equal(make('offline').commentDraft(repo, 184).text, '离线草稿');
offline.online = true;
await offline.saveComment(repo, 184, '恢复后手动发布');
assert.equal(offline.issue(repo, 184).commentItems.at(-1).text, '恢复后手动发布');

const draftError = make('draft-error');
assert.throws(() => draftError.saveDraft(repo, 184, 'comment', { text: '保留输入' }), { code: 'draft' });
draftError.saveDraft(repo, 184, 'comment', { text: '保留输入' });
assert.equal(make('draft-error').draft(repo, 184, 'comment').text, '保留输入');
const readonly = make('read-only');
await assert.rejects(readonly.saveIssue(repo, readonly.issue(repo, 184)), { code: 'permission' });

const left = make('normal', 'concurrent-issue');
const right = make('normal', 'concurrent-issue');
const leftEdit = { ...left.issue(repo, 184), title: '另一页面已保存的新标题' };
const rightEdit = { ...right.issue(repo, 184), body: '旧页面输入不得静默覆盖' };
await left.saveIssue(repo, leftEdit);
await assert.rejects(right.saveIssue(repo, rightEdit), { code: 'conflict' });
right.saveDraft(repo, 184, 'issue', rightEdit);
assert.equal(make('normal', 'concurrent-issue').issue(repo, 184).title, leftEdit.title);
assert.equal(make('normal', 'concurrent-issue').draft(repo, 184, 'issue').body, rightEdit.body);

const commentLeft = make('normal', 'concurrent-comment');
const commentRight = make('normal', 'concurrent-comment');
const oldComment = commentRight.issue(repo, 184).commentItems[0].text;
await commentLeft.saveComment(repo, 184, '另一页面更新的评论', 'c-1');
await assert.rejects(commentRight.saveComment(repo, 184, '本页未合并评论', 'c-1', oldComment), { code: 'conflict' });
assert.equal(make('normal', 'concurrent-comment').issue(repo, 184).commentItems[0].text, '另一页面更新的评论');

const issuePage = make('normal', 'new-comment-preserved');
const commentPage = make('normal', 'new-comment-preserved');
const issueEdit = { ...issuePage.issue(repo, 184), title: '只修改标题' };
await commentPage.saveComment(repo, 184, '编辑期间新增的评论不能消失');
await issuePage.saveIssue(repo, issueEdit);
assert.equal(make('normal', 'new-comment-preserved').issue(repo, 184).commentItems.at(-1).text, '编辑期间新增的评论不能消失');

const blankEdit = make('normal', 'blank-comment-draft');
blankEdit.saveDraft(repo, 184, 'comment:c-1', { text: '', commentId: 'c-1', baseText: oldComment });
assert.equal(make('normal', 'blank-comment-draft').commentDraft(repo, 184).text, '');

const identity = make('account-change');
identity.saveDraft(repo, 184, 'comment', { text: '旧账号草稿' });
const late = identity.saveIssue(repo, { ...identity.issue(repo, 184), title: '旧账号在途请求' });
const rejected = assert.rejects(late, { code: 'stale' });
await identity.refresh({ manual: true }); await rejected;
assert.equal(identity.account.login, 'review-member');
assert.equal(identity.list(repo).length, 0);
assert.equal(identity.draft(repo, 184, 'comment'), null);
assert.match(storage.getItem(`${identity.namespace}:account:team-member`), /旧账号草稿/);
assert.equal(identity.list('team/support-tools')[0].number, 7);

const taskStore = make('ambiguous');
const old = taskStore.task(repo, 184).current;
taskStore.bind(repo, 'review');
const task = taskStore.createTask(repo, 184);
assert.equal(task.status, 'draft');
assert.equal(taskStore.task(repo, 184).history[0].reference, old.reference);
assert.equal(taskStore.advanceTask(repo, 184, 'sent').status, 'requested');
assert.equal(taskStore.advanceTask(repo, 184, 'check').status, 'pending');
assert.equal(taskStore.advanceTask(repo, 184, 'check').status, 'ambiguous');
assert.equal(taskStore.advanceTask(repo, 184, 'resolve').status, 'linked');
assert.equal(make('ambiguous').binding(repo).id, 'review');
assert.ok(!('threadId' in taskStore.task(repo, 184).current));
assert.equal(make('invalid-workspace').binding(repo).valid, false);
assert.equal(basic.list('team/docs-site').length, 0);
assert.equal(basic.list('team/platform-api')[0].number, 42);
console.log('通过：保存读回、评论权限、新增/关闭/重开、失败重试、并发基线与新评论保护、冲突保留、离线/空评论草稿、草稿失败、账号与在途请求隔离、任务状态与旧关联保留。');
