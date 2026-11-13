const task = await taskSpace(8);
const page = task.page('p1');
const fs = await import('node:fs/promises');
await page.click('@433',{label:'核对重载后的待办'});
const snapshot=await page.snapshot();
const viewport=await page.evaluate(()=>({innerWidth:window.innerWidth,innerHeight:window.innerHeight,devicePixelRatio:window.devicePixelRatio}));
const screenshot=await page.screenshot({path:'E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/ux-independent/persisted-issue.png'});
await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/ux-independent/round-13.log',JSON.stringify({viewport,screenshot,snapshot},null,2),'utf8');
console.log({viewport,screenshot});console.log(snapshot);
