const task = await taskSpace(8);
const page = task.page('p1');
const fs = await import('node:fs/promises');
await page.reload();
await page.waitForSelector('input[type="search"]',{state:'visible'});
const snapshot=await page.snapshot();
await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/ux-independent/round-12.log',JSON.stringify({url:await page.url(),snapshot},null,2),'utf8');
console.log(snapshot);
