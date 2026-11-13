const task=await takeOverTaskSpace(8),page=task.page('p1');
await page.goto('http://127.0.0.1:18290/?theme=dark&repo=phoben%2Faoy-erp&issue=182');
await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#detail-title'),undefined,{timeout:120000});
console.log(await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;return {repository:d.querySelector('#queue-title')?.textContent,title:d.querySelector('#detail-title')?.textContent,navigationWidth:d.querySelector('#navigation')?.getBoundingClientRect().width,queueWidth:d.querySelector('#queue')?.getBoundingClientRect().width,separators:[...d.querySelectorAll('[data-column]')].map(n=>({column:n.dataset.column,role:n.getAttribute('role'),label:n.getAttribute('aria-label'),box:n.getBoundingClientRect().toJSON()}))};}));
console.log(await page.snapshot());
