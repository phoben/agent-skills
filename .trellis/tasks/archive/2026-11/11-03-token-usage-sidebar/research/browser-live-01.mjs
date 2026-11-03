const task=await taskSpace('YG Toolkit live Tokens acceptance 20261103');
const page=task.page('p1');
await page.goto('http://127.0.0.1:48765/');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
console.log({spaceId:task.spaceId,page:page.label});
await page.waitForFunction(()=>document.querySelectorAll('.matrix-row').length>0||document.querySelector('#connection-notice')?.hidden===false,undefined,{timeout:45000});
console.log(await page.evaluate(()=>({projects:document.querySelectorAll('.matrix-row').length,account:document.querySelector('[data-stat="account"]').textContent,local:document.querySelector('[data-stat="local"]').textContent,notice:document.querySelector('#connection-notice').textContent,coverage:document.querySelector('#coverage').textContent,rowsAligned:[...document.querySelectorAll('.matrix-row')].map(r=>r.getBoundingClientRect().height)})));
console.log((await page.snapshot()).slice(0,10000));
