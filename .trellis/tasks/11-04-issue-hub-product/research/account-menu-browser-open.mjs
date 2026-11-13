const task=await taskSpace(27),page=task.page('p1');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1120,height:880,deviceScaleFactor:1,mobile:false});
await page.goto('http://127.0.0.1:18300/?theme=dark&repo=phoben%2Fagent-skills');
await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#account-menu-trigger'),undefined,{timeout:45000});
console.log(await page.snapshot());
