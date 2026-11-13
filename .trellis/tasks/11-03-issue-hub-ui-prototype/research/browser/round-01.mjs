const task = await taskSpace('issue-hub-ui-01a1a15f');
const page = task.page('p1');
await page.goto('https://github.com/microsoft/vscode/issues');
const fs = await import('node:fs/promises');
const directory = 'E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research';
await fs.writeFile(`${directory}/browser-session.json`, JSON.stringify({ spaceId: task.spaceId, pages: { github: page.label }, purpose: 'Issue Hub 原型参考与后续页面验证' }, null, 2));
console.log(JSON.stringify({ spaceId: task.spaceId, page: page.label, url: await page.url() }));
console.log((await page.snapshot()).slice(0, 19000));
