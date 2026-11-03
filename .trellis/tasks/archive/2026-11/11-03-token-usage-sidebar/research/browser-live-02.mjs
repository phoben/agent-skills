const task=await taskSpace(27),page=task.page('p1');
console.log(await page.evaluate(()=>({title:document.title,preview:!!window.__TOKEN_PREVIEW_TOKEN__,account:document.querySelector('[data-stat="account"]')?.textContent,local:document.querySelector('[data-stat="local"]')?.textContent,panel:document.querySelector('#panel-state')?.textContent,notice:document.querySelector('#connection-notice')?.textContent,coverage:document.querySelector('#coverage')?.textContent})));
console.log((await page.snapshot()).slice(0,9000));
