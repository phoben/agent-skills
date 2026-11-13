const task=await taskSpace(8),page=task.page('p1');
await page.fill('#comment-body','Issue Hub 前台轮询草稿验证，仅本机不发布');
await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#comment-draft-status')?.textContent.includes('本机草稿已保存'),undefined,{timeout:90000});
console.log(await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;d.defaultView.__pollComment=d.querySelector('#comment-body');return {hidden:d.hidden,selected:d.querySelector('.issue-row.selected')?.dataset.number,localDraftSaved:true};}));
