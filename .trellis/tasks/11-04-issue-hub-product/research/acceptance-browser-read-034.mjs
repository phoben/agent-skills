import { writeFile } from 'node:fs/promises';
const task = await taskSpace(21), page = task.page('p1');
const report = { version: '0.3.4', realGithub: true, remoteWrites: false, chatOpened: false, failure: null };
try {
  await page.goto('http://127.0.0.1:18297/?theme=dark&repo=phoben%2Fagent-skills');
  await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('#queue-title')?.textContent === 'phoben/agent-skills', undefined, { timeout: 60000 });
  await page.click('[data-action="filter-state"][data-state="all"]', { label: '查看全部已有 Issue' });
  await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('[data-action="open-issue"][data-number="3"]'), undefined, { timeout: 60000 });
  await page.click('[data-action="open-issue"][data-number="3"]', { label: '只读抽查现有 Issue 来源' });
  await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('.related-links')?.textContent.includes('关联 PR：暂无'), undefined, { timeout: 60000 });
  report.view = await page.evaluate(() => {
    const d = document.querySelector('iframe').contentDocument, region = d.querySelector('.related-links');
    return { selected: d.querySelector('.issue-row.selected')?.dataset.number, sourceText: region.textContent, dangerousLinks: [...region.querySelectorAll('a')].filter(a => !/^https?:\/\//.test(a.href)).length, overflow: d.documentElement.scrollWidth > d.documentElement.clientWidth, viewport: { width: innerWidth, height: innerHeight } };
  });
  if (report.view.selected !== '3' || !report.view.sourceText.includes('附件：暂无') || report.view.dangerousLinks) throw new Error('来源状态展示不符');
  try { report.screenshot = await page.screenshot({ path: 'E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/acceptance-sources-034.png' }); } catch (error) { report.screenshotUnavailable = error.message; }
  report.passed = true;
} catch (error) { report.failure = error.message; report.passed = false; }
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/acceptance-browser-034.json', JSON.stringify(report, null, 2) + '\n'); console.log(report);
