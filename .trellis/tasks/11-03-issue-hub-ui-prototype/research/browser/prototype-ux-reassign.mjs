const task = await taskSpace(8);
const page = task.page('p1');
console.log({ before: await page.info() });
await page.goto('http://127.0.0.1:18286/?run=ux-independent-visible-v1&theme=light');
await page.waitForSelector('#issue-search', { state: 'visible' });
console.log({ after: await page.info(), viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })) });
