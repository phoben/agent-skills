const task = await taskSpace(7);
const page = task.page('p2');
await page.goto('https://linear.app/docs/display-options');
await page.waitForSelector('loc=role:heading[name="Display options"]');
console.log({ page: page.label, url: await page.url() });
console.log((await page.snapshot()).slice(0, 13000));
const fs = await import('node:fs/promises');
await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/linear-display-options.json', JSON.stringify({ url: await page.url(), title: await page.title(), bodyExcerpt: await page.evaluate(() => document.body.innerText.slice(-20000)), visualChecked: false }, null, 2));
