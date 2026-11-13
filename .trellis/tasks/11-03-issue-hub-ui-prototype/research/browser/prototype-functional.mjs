const task = await taskSpace(8);
const page = task.page('p1');
const assert = await import('node:assert/strict');
const fs = await import('node:fs/promises');
const reportPath = 'E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/functional-browser-report.json';
const base = 'http://127.0.0.1:18286/';
const stamp = Date.now();
const results = [];
const record = (name, detail = {}) => { const row = { name, passed: true, ...detail }; results.push(row); console.log(row); };
const text = () => page.evaluate(() => document.body.innerText);
const waitText = (value) => page.waitForFunction((needle) => document.body.innerText.includes(needle), value, { timeout: 10000 });
const waitDetailTitle = (value) => page.waitForFunction((needle) => document.querySelector('#detail-title')?.textContent === needle, value, { timeout: 10000 });
async function openPage(run, scenario = '') {
  const url = new URL(base); url.searchParams.set('run', run); url.searchParams.set('theme', 'light');
  if (scenario) url.searchParams.set('scenario', scenario);
  await page.goto(url.href);
  await page.waitForSelector('[data-action="open-issue"][data-number="184"]', { state: 'visible' });
}
async function openIssue(number = 184) {
  await page.click(`[data-action="open-issue"][data-number="${number}"]`);
  await page.waitForSelector('#task-primary', { state: 'visible' });
}
async function editIssue() {
  await page.click('#issue-more');
  await page.click('loc=role:menuitem[name="编辑标题、正文与属性"]');
  await page.waitForSelector('#issue-title', { state: 'visible' });
}
async function revealComment(marker) {
  for (let count = 0; count < 8; count++) {
    if ((await text()).includes(marker)) return;
    const before = await page.evaluate(() => Number(document.querySelector('#detail')?.innerText.match(/已加载\s*(\d+)/)?.[1] || 0));
    const available = await page.evaluate(() => Boolean(document.querySelector('[data-action="more-comments"]')));
    assert.ok(available, '评论未出现，且没有继续加载入口');
    await page.click('[data-action="more-comments"]');
    await page.waitForFunction((previous) => Number(document.querySelector('#detail')?.innerText.match(/已加载\s*(\d+)/)?.[1] || 0) > previous, before, { timeout: 10000 });
  }
  assert.ok((await text()).includes(marker), '分页后仍找不到已保存评论');
}

let failure = null;
try {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1120, height: 880, deviceScaleFactor: 1, mobile: false });
  for (let iteration = 1; iteration <= 3; iteration++) {
    const run = `core-${stamp}-${iteration}`;
    const title = `流程复核 ${iteration}：仓库切换后的评论范围`;
    const comment = `浏览器发布核对 ${iteration}：刷新后仍应保留这条讨论。`;
    await openPage(run); await openIssue(); await editIssue();
    await page.fill('#issue-title', title);
    await page.fill('#issue-body', `流程 ${iteration} 的本机保存内容。\n\n验证保存、刷新和失败恢复，不请求真实 GitHub。`);
    await page.selectOption('#issue-assignee', '陈雨');
    await page.selectOption('#issue-milestone', '桌面协作 v0.3');
    await page.click('input[name="labels"][value="enhancement"]');
    await page.click('#save-issue'); await waitDetailTitle(title);
    await page.reload();
    await page.waitForSelector('[data-action="open-issue"][data-number="184"]', { state: 'visible' });
    await openIssue(); await waitDetailTitle(title);
    assert.ok((await text()).includes('桌面协作 v0.3'));
    assert.ok((await text()).includes(`流程 ${iteration} 的本机保存内容。`));
    assert.equal(await page.evaluate(() => document.querySelector('[aria-label="编辑负责人"]')?.textContent.trim()), '陈雨');
    assert.ok(await page.evaluate(() => document.querySelector('[aria-label="编辑标签"]')?.textContent.includes('enhancement')));
    await page.fill('#comment-body', comment); await page.click('#save-comment');
    await waitText(comment);
    await page.reload();
    await page.waitForSelector('[data-action="open-issue"][data-number="184"]', { state: 'visible' });
    await openIssue(); await revealComment(comment);
    const edited = `本人评论编辑核对 ${iteration}。`;
    await page.click('[data-action="edit-comment"][data-comment-id="c-1"]');
    await page.fill('#comment-body', edited); await page.click('#save-comment'); await waitText(edited);
    await page.reload();
    await page.waitForSelector('[data-action="open-issue"][data-number="184"]', { state: 'visible' });
    await openIssue(); await waitText(edited);
    await page.click('#issue-more'); await page.click('loc=role:menuitem[name="关闭 Issue"]');
    await page.waitForFunction(() => document.querySelector('#detail')?.innerText.includes('已关闭'), undefined, { timeout: 10000 });
    await page.click('#issue-more'); await page.click('loc=role:menuitem[name="重新打开 Issue"]');
    await page.waitForFunction((expected) => document.querySelector('#detail')?.innerText.includes(expected) && !document.querySelector('#detail')?.innerText.includes('已关闭'), title, { timeout: 10000 });
    await page.click('[data-action="new-issue"]'); await page.waitForSelector('#issue-title', { state: 'visible' });
    const newTitle = `新建读回核对 ${iteration}`;
    await page.fill('#issue-title', newTitle); await page.fill('#issue-body', '由真实界面创建并在刷新后读取。');
    await page.click('#save-issue'); await waitDetailTitle(newTitle);
    await page.reload(); await waitText(newTitle);
    record(`核心保存读回 ${iteration}/3`, { issueEdited: true, commentCreated: true, ownCommentEdited: true, issueClosedAndReopened: true, issueCreated: true });
  }

  for (let iteration = 1; iteration <= 3; iteration++) {
    const run = `failure-${stamp}-${iteration}`;
    const title = `失败恢复 ${iteration}：保留输入`;
    await openPage(run, 'save-error'); await openIssue(); await editIssue();
    await page.fill('#issue-title', title); await page.click('#save-issue');
    await page.waitForFunction(() => Boolean(document.querySelector('#form-error')?.textContent.trim()), undefined, { timeout: 10000 });
    assert.equal(await page.evaluate(() => document.querySelector('#issue-title').value), title);
    await page.click('#save-issue'); await waitDetailTitle(title);
    await page.reload(); await waitText(title);
    record(`失败保留与重试 ${iteration}/3`, { inputPreserved: true, retrySaved: true, reloadReadable: true });
  }

  await openPage(`offline-${stamp}`, 'offline'); await openIssue();
  const offlineDraft = '离线评论草稿：刷新后仍能继续编辑。';
  await page.fill('#comment-body', offlineDraft);
  await page.click('[data-action="open-issue"][data-number="183"]');
  await openIssue();
  await page.waitForFunction((expected) => document.querySelector('#comment-body')?.value === expected, offlineDraft, { timeout: 10000 });
  await page.reload();
  await page.waitForSelector('[data-action="open-issue"][data-number="184"]', { state: 'visible' });
  await openIssue();
  assert.equal(await page.evaluate(() => document.querySelector('#comment-body')?.value), offlineDraft);
  record('离线草稿切换与刷新', { persisted: true, noAutomaticPublish: true });

  await openPage(`identity-${stamp}`, 'account-change'); await openIssue();
  const oldTitle = '切换仓库后，评论仍保留上一次的筛选结果';
  await page.click('#statusbar [data-action="refresh"]');
  await waitText('当前账号 review-member');
  await waitText('team/support-tools');
  assert.ok(!(await text()).includes(oldTitle), '换账号后仍显示旧私有内容');
  record('账号变化清理旧视图', { oldPrivateContentHidden: true });
} catch (error) {
  failure = { message: error.message, url: await page.url(), completed: results.length };
  console.log({ failure });
  throw error;
} finally {
  await fs.writeFile(reportPath, JSON.stringify({ checkedAt: new Date().toISOString(), prototypeOnly: true, browserSpaceId: task.spaceId, results, failure }, null, 2));
}
