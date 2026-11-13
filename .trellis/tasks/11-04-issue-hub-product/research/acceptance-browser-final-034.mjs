import { writeFile } from 'node:fs/promises';
const task = await taskSpace(21), page = task.page('p1');
const report = { version: '0.3.4', realGithub: true, remoteWrites: false, chatOpened: false, failure: null };
try {
  report.dark = await page.evaluate(() => {
    const d = document.querySelector('iframe').contentDocument, region = d.querySelector('.related-links');
    return { selected: d.querySelector('.issue-row.selected')?.dataset.number, sourceText: region?.textContent, background: d.defaultView.getComputedStyle(d.body).backgroundColor, overflow: d.documentElement.scrollWidth > d.documentElement.clientWidth };
  });
  if (report.dark.selected !== '3' || !report.dark.sourceText.includes('附件：暂无') || !report.dark.sourceText.includes('关联 PR：暂无')) throw new Error('已有Issue来源空态不符');
  await page.click('[data-action="discussion-tab"][data-tab="activities"]', { label: '查看已读取活动记录' });
  report.activity = await page.evaluate(() => {
    const d = document.querySelector('iframe').contentDocument;
    return { active: d.querySelector('[data-tab="activities"]')?.getAttribute('aria-pressed'), sourceText: d.querySelector('.related-links')?.textContent, commentEditorPresent: Boolean(d.querySelector('#comment-body')) };
  });
  try { report.screenshot = await page.screenshot({ path: 'E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/acceptance-sources-034.png' }); } catch (error) { report.screenshotUnavailable = error.message; }
  await page.evaluate(() => window.__issueHubPreviewTheme({ theme: 'light' }));
  await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.documentElement?.dataset.theme === 'light', undefined, { timeout: 10000 });
  report.light = await page.evaluate(() => {
    const d = document.querySelector('iframe').contentDocument;
    return { sourceText: d.querySelector('.related-links')?.textContent, background: d.defaultView.getComputedStyle(d.body).backgroundColor, overflow: d.documentElement.scrollWidth > d.documentElement.clientWidth };
  });
  if (report.light.sourceText !== report.dark.sourceText || report.activity.active !== 'true') throw new Error('主题或活动切换丢失来源状态');
  report.passed = true;
} catch (error) { report.failure = error.message; report.passed = false; }
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/acceptance-browser-034-final.json', JSON.stringify(report, null, 2) + '\n'); console.log(report);
