const task = await taskSpace(8);
const page = task.page('p1');
const fs = await import('node:fs/promises');
const receipt=await page.click('loc=role:button[name="新建 Issue"]',{label:'新建项目待办'});
const snapshot=await page.snapshot();
await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/ux-independent/round-05.log',JSON.stringify({receipt,snapshot},null,2),'utf8');
console.log(receipt);console.log(snapshot);
