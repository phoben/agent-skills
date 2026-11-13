const task=await taskSpace(8),page=task.page('p1');
const bounds=await page.evaluate(()=>{const r=document.querySelector('iframe').contentDocument.querySelector('#detail').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
await page.mouse.move(bounds.x,bounds.y,{label:'定位真实 Issue 详情'});
await page.mouse.wheel(0,-4000,{label:'展示 Issue 详情顶部'});
await page.waitForFunction(()=>{const node=document.querySelector('iframe')?.contentDocument?.querySelector('#detail-title');return node&&node.getBoundingClientRect().top>=0&&node.getBoundingClientRect().top<500;},undefined,{timeout:10000});
console.log({spaceId:task.spaceId,page:page.label,url:await page.url(),readonlyGithub:true});
await task.handOff();
