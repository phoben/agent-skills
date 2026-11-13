const task=await taskSpace(8),page=task.page('p1');
// 重建文档清除本轮临时观察器，再将真实只读页面交还用户。
await page.goto('http://127.0.0.1:18292/?theme=dark&repo=phoben%2Faoy-erp&issue=182');
await page.waitForFunction(()=>{const d=document.querySelector('iframe')?.contentDocument;return d?.querySelector('#detail-title')&&d.querySelector('.issue-row.selected')?.dataset.number==='182';},undefined,{timeout:120000});
console.log(await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;return {repository:d.querySelector('#queue-title').textContent,selected:d.querySelector('.issue-row.selected').dataset.number,navigation:d.querySelector('#navigation').getBoundingClientRect().width,queue:d.querySelector('#queue').getBoundingClientRect().width,temporaryRecorderPresent:typeof window.__experienceCalls!=='undefined'};}));
await task.handOff();
