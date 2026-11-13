const task = await taskSpace(8);
const page = task.page('p1');
const fs = await import('node:fs/promises');
await page.click('loc=role:button[name="返回列表"]',{label:'返回待办队列'});
await page.fill('loc=role:searchbox','独立走查');
const snapshot=await page.snapshot();
await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/ux-independent/round-08.log',snapshot,'utf8');
console.log(snapshot);
