const task=await taskSpace(27),page=task.page('p1');
await page.reload();
await page.waitForFunction(()=>document.querySelectorAll('.matrix-row').length>0||document.querySelector('#connection-notice')?.hidden===false,undefined,{timeout:45000});
console.log(await page.evaluate(()=>({errors:window.__usageErrors,projectCount:document.querySelectorAll('.matrix-row').length,account:document.querySelector('[data-stat="account"]').textContent,local:document.querySelector('[data-stat="local"]').textContent,notice:document.querySelector('#connection-notice').textContent,coverage:document.querySelector('#coverage').textContent,firstProject:document.querySelector('.matrix-row')?.dataset.project})));
console.log((await page.snapshot()).slice(0,10000));
