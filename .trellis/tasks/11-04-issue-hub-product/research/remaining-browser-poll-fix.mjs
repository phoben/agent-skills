const task=await taskSpace(8),page=task.page('p1');
await page.goto('http://127.0.0.1:18296/?theme=dark&repo=phoben%2Fagent-skills');
await page.waitForFunction(()=>{const d=document.querySelector('iframe')?.contentDocument;return d?.querySelector('#queue-title')?.textContent==='phoben/agent-skills'&&!d.querySelector('.initial-load');},undefined,{timeout:120000});
await page.click('[data-action="filter-state"][data-state="all"]',{label:'查看包含验收记录的全部 Issue'});
await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('[data-action="open-issue"][data-number="5"]'),undefined,{timeout:120000});
await page.click('[data-action="open-issue"][data-number="5"]',{label:'只读查看本次验收 Issue'});
await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#detail-title'),undefined,{timeout:120000});
console.log(await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;return {hidden:d.hidden,repository:d.querySelector('#queue-title').textContent,selected:d.querySelector('.issue-row.selected')?.dataset.number,title:d.querySelector('#detail-title').textContent};}));
