const task=await taskSpace(30),page=task.page('p1');
await page.goto('http://127.0.0.1:18301/?theme=dark&repo=phoben%2Fagent-skills');
await page.waitForFunction(()=>{const d=document.querySelector('iframe')?.contentDocument;return d?.querySelector('#queue-title')?.textContent==='phoben/agent-skills'&&d.querySelector('.issue-row');},undefined,{timeout:45000});
console.log(await page.snapshot());
