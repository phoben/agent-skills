const task=await taskSpace(8),page=task.page('p1');
await page.goto('http://127.0.0.1:18293/?theme=dark&repo=phoben%2Faoy-erp&issue=182');
await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#detail-title'),undefined,{timeout:120000});
console.log(await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;return {theme:d.documentElement.dataset.theme,background:d.defaultView.getComputedStyle(d.body).backgroundColor,selected:d.querySelector('.issue-row.selected')?.dataset.number};}));
await task.handOff();
