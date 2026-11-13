const task = await taskSpace(8);
const page = task.page('p1');
await page.click('[data-action="open-issue"][data-number="3"]', { label: '读取真实 Issue 详情' });
await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('#detail-title'), undefined, { timeout: 120000 });
console.log(await page.snapshot());
try { console.log({ screenshot: await page.screenshot({path:'E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/evidence/real-readonly.png'}) }); }
catch (error) { console.log({ screenshotUnavailable: error.message }); }
