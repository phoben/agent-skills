import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const task = await taskSpace('issue-hub-task-return-1105');
const page = task.page('p1');
try {
  await page.goto('http://127.0.0.1:18303/?theme=dark&repo=phoben%2Faoy-erp&issue=191');
  await page.waitForFunction(() => {
    const doc = document.querySelector('iframe')?.contentDocument;
    return doc?.querySelector('#task-primary')?.textContent.includes('创建任务');
  }, undefined, { timeout: 60000 });
  await page.click('#task-primary', { label: '打开测试会话草稿' });
  await page.waitForFunction(async () => {
    const result = await fetch('/fixture-task').then(response => response.json());
    return result.opened === 1 && result.checks > 0;
  }, undefined, { timeout: 60000 });
  assert.equal(await page.evaluate(() => document.querySelector('iframe').contentDocument.querySelector('#task-primary').textContent.includes('返回会话')), false);
  const started = performance.now();
  await page.evaluate(async () => {
    await fetch('/fixture-task', { method: 'POST' });
    const frame = document.querySelector('iframe').contentWindow;
    frame.dispatchEvent(new frame.Event('focus'));
  });
  await page.waitForFunction(() => {
    const doc = document.querySelector('iframe').contentDocument;
    return doc.querySelector('#task-primary')?.textContent.includes('返回会话');
  }, undefined, { timeout: 12000 });
  const linkedMilliseconds = Math.round(performance.now() - started);
  const action = await page.evaluate(() => document.querySelector('iframe').contentDocument.querySelector('[data-action="return-task"]') ? '[data-action="return-task"]' : '#task-primary');
  await page.click(action, { label: '返回已确认测试会话' });
  await page.waitForFunction(async () => (await fetch('/fixture-task').then(response => response.json())).returned === 1, undefined, { timeout: 8000 });
  assert.equal(await page.evaluate(selector => {
    const button = document.querySelector('iframe').contentDocument.querySelector(selector);
    return button.disabled && button.textContent.includes('正在打开会话');
  }, action), true);
  await page.evaluate(() => fetch('/fixture-return', { method: 'POST' }).then(response => response.ok));
  await page.waitForFunction(() => {
    const button = document.querySelector('iframe').contentDocument.querySelector('#task-primary');
    return button && !button.disabled && button.textContent.includes('返回会话');
  }, undefined, { timeout: 8000 });
  const fixture = await page.evaluate(() => fetch('/fixture-task').then(response => response.json()));
  assert.ok(fixture.sameRequest);
  assert.equal(fixture.opened, 1);
  const result = { spaceId: task.spaceId, linkedMilliseconds, ...fixture, realIssueRead: true, navigation: 'stubbed', passed: true };
  await writeFile(new URL('./task-return-browser.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(result);
} finally {
  await task.finish({ keep: [] });
}
