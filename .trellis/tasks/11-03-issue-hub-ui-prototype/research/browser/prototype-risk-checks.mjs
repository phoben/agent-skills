const task = await taskSpace(8);
const page = task.page('p1');
const assert = await import('node:assert/strict');
const fs = await import('node:fs/promises');
const results = [];
const stamp = Date.now();
const waitText = (needle) => page.waitForFunction((value) => document.body.innerText.includes(value), needle, { timeout: 10000 });
const bodyText = () => page.evaluate(() => document.body.innerText);
async function open(scenario, name) {
  await page.goto(`http://127.0.0.1:18286/?theme=light&run=${name}-${stamp}&scenario=${scenario}`);
  await page.waitForSelector('[data-action="open-issue"][data-number="184"]', { state: 'visible' });
  await page.click('[data-action="open-issue"][data-number="184"]');
  await page.waitForSelector('#task-primary', { state: 'visible' });
}
const record = (name, detail = {}) => { const row = { name, passed: true, ...detail }; results.push(row); console.log(row); };
let failure = null;
try {
  await open('conflict', 'conflict');
  await page.click('#issue-more'); await page.click('loc=role:menuitem[name="编辑标题、正文与属性"]');
  const localBody = '冲突核对：当前本机输入必须保留，只有明确选择后才覆盖。';
  await page.fill('#issue-body', localBody); await page.click('#save-issue');
  await page.waitForSelector('[aria-label="远端冲突比较"]', { state: 'visible' });
  assert.equal(await page.evaluate(() => document.querySelector('#issue-body').value), localBody);
  await page.click('[data-action="force-save"]');
  await page.waitForFunction(() => !document.querySelector('#issue-title'), undefined, { timeout: 10000 });
  await waitText(localBody); await page.reload();
  await page.waitForSelector('[data-action="open-issue"][data-number="184"]', { state: 'visible' });
  await page.click('[data-action="open-issue"][data-number="184"]'); await waitText(localBody);
  record('冲突保留输入与明确选择后保存', { readBackAfterReload: true });

  await open('read-only', 'readonly'); await waitText('当前账号只有读取权限');
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('[data-action="new-issue"]') || document.querySelector('#comment-body'))), false);
  await page.click('#issue-more');
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('[role="menuitem"][data-action="edit-issue"]') || document.querySelector('[role="menuitem"][data-action="change-state"]'))), false);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'issue-more');
  record('只读权限与菜单焦点返回', { writeControlsAbsent: true });

  await open('draft-error', 'draft');
  const draft = '草稿写入失败时不能离开当前 Issue。';
  await page.focus('#comment-body'); await page.fill('#comment-body', draft);
  await page.click('[data-action="open-issue"][data-number="183"]');
  await waitText('草稿尚未保存');
  assert.equal(await page.evaluate(() => document.querySelector('#detail-title')?.textContent), '切换仓库后，评论仍保留上一次的筛选结果');
  assert.equal(await page.evaluate(() => document.querySelector('#comment-body')?.value), draft);
  await page.click('[data-action="retry-leave"]');
  await page.waitForFunction(() => document.querySelector('#detail-title')?.textContent === '多个工作区时，已选路径没有被记住', undefined, { timeout: 10000 });
  await page.click('[data-action="open-issue"][data-number="184"]');
  await page.waitForFunction((value) => document.querySelector('#comment-body')?.value === value, draft, { timeout: 10000 });
  record('本机草稿失败阻止离开，重试后恢复', { noInputLoss: true });

  await open('invalid-workspace', 'workspace');
  await page.click('#task-more'); await page.click('[data-action="another-task"]');
  await page.waitForSelector('input[name="workspace"]', { state: 'visible' });
  const dialogTargets = await page.evaluate(() => [...document.querySelector('[role="dialog"]').querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length).length);
  for (let index = 0; index < dialogTargets + 2; index++) {
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))), '工作区弹层焦点不能跑到背景');
  }
  await page.click('loc=role:button[name="取消"]');
  await page.click('#task-primary'); await waitText('任务引用 IH-184-1');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'task-primary');
  record('取消失效工作区选择保留旧关联', { originalTaskReachable: true });

  await page.click('#task-more'); await page.click('[data-action="another-task"]');
  await page.waitForSelector('input[name="workspace"]', { state: 'visible' });
  await page.click('#overlay-root input[name="workspace"]:not(:disabled) >> nth=0');
  await page.click('[data-action="confirm-workspace"]');
  await page.waitForSelector('[data-action="task-sent"]', { state: 'visible' });
  await waitText('未发送草稿');
  record('另建任务进入未发送草稿', { noRealChatOpened: true });

  await open('offline', 'offline');
  const offlineDraft = '离线评论与键盘换行核对。';
  await page.focus('#comment-body'); await page.fill('#comment-body', offlineDraft);
  await page.press('#comment-body', 'Enter');
  const expectedDraft = await page.evaluate(() => document.querySelector('#comment-body').value);
  assert.ok(expectedDraft.includes('\n'), '多行编辑器 Enter 应换行');
  assert.ok((await bodyText()).includes('讨论 · 8'), 'Enter 不应发布新评论');
  await page.click('[data-action="open-issue"][data-number="183"]');
  await page.click('[data-action="open-issue"][data-number="184"]');
  await page.waitForFunction((value) => document.querySelector('#comment-body')?.value === value, expectedDraft, { timeout: 10000 });
  await page.reload();
  await page.waitForSelector('[data-action="open-issue"][data-number="184"]', { state: 'visible' });
  await page.click('[data-action="open-issue"][data-number="184"]');
  await page.waitForFunction((value) => document.querySelector('#comment-body')?.value === value, expectedDraft, { timeout: 10000 });
  assert.ok((await bodyText()).includes('讨论 · 8'));
  record('离线草稿与 Enter 不发布', { readBackAfterReload: true });

  await open('account-change', 'identity');
  await page.click('#statusbar [data-action="refresh"]');
  await waitText('当前账号 review-member'); await waitText('team/support-tools');
  assert.ok(!(await bodyText()).includes('切换仓库后，评论仍保留上一次的筛选结果'));
  record('账号变化清理私有视图', { newIdentityLoaded: true });
} catch (error) { failure = { message: error.message, url: await page.url(), completed: results.length }; console.log({ failure }); throw error; }
finally { await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/risk-browser-report.json', JSON.stringify({ checkedAt: new Date().toISOString(), prototypeOnly: true, browserSpaceId: task.spaceId, results, failure }, null, 2)); }
