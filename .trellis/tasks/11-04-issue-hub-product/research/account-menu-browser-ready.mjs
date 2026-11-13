const task=await taskSpace(27),page=task.page('p1');
await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#account-menu-trigger')?.textContent.includes('phoben'),undefined,{timeout:45000});
console.log(await page.snapshot());
