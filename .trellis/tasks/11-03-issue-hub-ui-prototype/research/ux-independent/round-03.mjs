const task = await taskSpace(8);
const page = task.page('p2');
const fs = await import('node:fs/promises');
const receipt = await page.click('loc=role:button[name="新建 Issue"]',{label:'新建一条待办'});
const snapshot=await page.snapshot({scope:'full_page'});
const viewport=await page.evaluate(()=>({innerWidth:window.innerWidth,innerHeight:window.innerHeight,devicePixelRatio:window.devicePixelRatio}));
await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/ux-independent/round-03.log',JSON.stringify({receipt,viewport,snapshot},null,2),'utf8');
console.log(receipt);console.log(viewport);console.log(snapshot);
