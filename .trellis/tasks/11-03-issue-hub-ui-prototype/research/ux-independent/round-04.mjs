const task = await taskSpace(8);
const page = task.page('p1');
const fs = await import('node:fs/promises');
const snapshot=await page.snapshot();
const viewport=await page.evaluate(()=>({innerWidth:window.innerWidth,innerHeight:window.innerHeight,devicePixelRatio:window.devicePixelRatio}));
await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/ux-independent/round-04.log',JSON.stringify({url:await page.url(),viewport,snapshot},null,2),'utf8');
console.log(viewport);console.log(snapshot);
