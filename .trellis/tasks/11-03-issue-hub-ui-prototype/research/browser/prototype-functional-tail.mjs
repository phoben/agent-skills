const task = await taskSpace(8);
const page = task.page('p1');
const assert = await import('node:assert/strict');
const fs = await import('node:fs/promises');
const root = 'E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research';
const previous = JSON.parse(await fs.readFile(`${root}/functional-browser-report.json`, 'utf8'));
await fs.writeFile(`${root}/functional-browser-report-initial.json`, JSON.stringify(previous, null, 2));
const results = previous.results;
let failure = null;
const waitText = (needle) => page.waitForFunction((value) => document.body.innerText.includes(value), needle, { timeout: 10000 });
try {
  // 使用实际浏览器窗口；精确画布尺寸由独立截图工具验证，不沿用临时设备覆盖。
  await page.cdp('Emulation.clearDeviceMetricsOverride');
  const offlineDraft = '离线评论草稿：刷新后仍能继续编辑。';
  await page.focus('#comment-body');
  await page.fill('#comment-body', offlineDraft);
  await page.click('[data-action="open-issue"][data-number="183"]');
  await page.click('[data-action="open-issue"][data-number="184"]');
  await page.waitForFunction((value) => document.querySelector('#comment-body')?.value === value, offlineDraft, { timeout: 10000 });
  await page.reload();
  await page.waitForSelector('[data-action="open-issue"][data-number="184"]', { state: 'visible' });
  await page.click('[data-action="open-issue"][data-number="184"]');
  await page.waitForFunction((value) => document.querySelector('#comment-body')?.value === value, offlineDraft, { timeout: 10000 });
  const discussion = await page.evaluate(() => document.querySelector('.discussion-tabs')?.innerText);
  assert.ok(discussion.includes('讨论 · 8'), '离线输入不应自动发布为新评论');
  results.push({ name: '离线草稿切换与刷新', passed: true, persisted: true, noAutomaticPublish: true });
  console.log(results.at(-1));

  await page.goto(`http://127.0.0.1:18286/?run=identity-tail-${Date.now()}&theme=light&scenario=account-change`);
  await page.waitForSelector('[data-action="open-issue"][data-number="184"]', { state: 'visible' });
  await page.click('[data-action="open-issue"][data-number="184"]');
  await page.waitForSelector('#task-primary', { state: 'visible' });
  await page.click('#statusbar [data-action="refresh"]');
  await waitText('当前账号 review-member');
  await waitText('team/support-tools');
  assert.ok(!(await page.evaluate(() => document.body.innerText)).includes('切换仓库后，评论仍保留上一次的筛选结果'));
  results.push({ name: '账号变化清理旧视图', passed: true, oldPrivateContentHidden: true, newIdentityLoaded: true });
  console.log(results.at(-1));
} catch (error) { failure = { message: error.message, url: await page.url(), completed: results.length }; console.log({ failure }); throw error; }
finally {
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
  await fs.writeFile(`${root}/functional-browser-report.json`, JSON.stringify({ checkedAt: new Date().toISOString(), prototypeOnly: true, browserSpaceId: task.spaceId, viewport, results, failure, priorToolIssue: previous.failure }, null, 2));
}
