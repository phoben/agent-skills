const task = await taskSpace(7);
const page = task.page('p1');
const fs = await import('node:fs/promises');
const base = 'E:/Develop/agent-skills/.trellis/tasks/11-03-github-issue-plugin/ui/evidence/references';
await page.cdp('Emulation.clearDeviceMetricsOverride');
let captured = false;
try {
  console.log({ listScreenshot: await page.screenshot({ path: `${base}/github-list.png`, clip: { x: 170, y: 150, width: 700, height: 480 }, raw: true }) });
  captured = true;
} catch (error) { console.log({ screenshotError: error.message, stage: 'github-list' }); }
await page.click('loc=href:/microsoft/vscode/issues/345823');
await page.waitForURL('https://github.com/microsoft/vscode/issues/345823');
console.log({ detailUrl: await page.url() });
console.log((await page.snapshot()).slice(0, 10000));
if (captured) console.log({ detailScreenshot: await page.screenshot({ path: `${base}/github-detail.png`, raw: true }) });
const linear = await task.newPage();
await linear.goto('https://linear.app/docs/issues');
await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/browser-session.json', JSON.stringify({ spaceId: task.spaceId, pages: { github: page.label, linear: linear.label }, purpose: 'Issue Hub 原型参考与后续页面验证' }, null, 2));
console.log({ linearPage: linear.label, linearUrl: await linear.url() });
console.log((await linear.snapshot()).slice(0, 12000));
