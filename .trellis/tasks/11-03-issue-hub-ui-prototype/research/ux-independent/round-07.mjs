const task = await taskSpace(8);
const page = task.page('p1');
const fs = await import('node:fs/promises');
await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('保存中')));
const snapshot=await page.snapshot();
await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/ux-independent/round-07.log',snapshot,'utf8');
console.log(snapshot);
