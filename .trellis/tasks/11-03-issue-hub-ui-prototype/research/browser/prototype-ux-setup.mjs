const task = await taskSpace(8);
const page = await task.newPage();
const url = `http://127.0.0.1:18286/?run=ux-independent-${Date.now()}&theme=light`;
await page.goto(url);
await page.waitForSelector('#issue-search', { state: 'visible' });
const fs = await import('node:fs/promises');
const record = { spaceId: task.spaceId, page: page.label, url: await page.url(), viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })) };
await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/ux-browser-session.json', JSON.stringify(record, null, 2));
console.log(record);
