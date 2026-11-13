const task = await taskSpace(8);
const page = task.page('p1');
const fs = await import('node:fs/promises');
await page.click('@404',{label:'重新打开新建待办'});
const snapshot=await page.snapshot();
await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/ux-independent/round-11.log',snapshot,'utf8');
console.log(snapshot);
