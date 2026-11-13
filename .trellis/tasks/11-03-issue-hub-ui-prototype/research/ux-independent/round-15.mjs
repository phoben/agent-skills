const task = await taskSpace(8);
const page = task.page('p1');
const fs = await import('node:fs/promises');
const receipt=await page.click('loc=role:button[name="刷新 Issue"]',{label:'刷新并核对保存结果'});
await page.waitForFunction(()=>!Array.from(document.querySelectorAll('[aria-label="刷新 Issue"]')).some(b=>b.disabled));
const snapshot=await page.snapshot();
await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/ux-independent/round-15.log',JSON.stringify({receipt,snapshot},null,2),'utf8');
console.log(receipt);console.log(snapshot);
