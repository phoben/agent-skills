const task = await taskSpace('issue-hub-a-prototype-01a1a15f');
const page = task.page('p1');
const fs = await import('node:fs/promises');
const data = { spaceId: task.spaceId, page: page.label, purpose: 'A 连读队列完整交互原型验证', phase: 'waiting-for-local-preview' };
await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/prototype-browser-session.json', JSON.stringify(data, null, 2));
console.log({ ...data, url: await page.url() });
