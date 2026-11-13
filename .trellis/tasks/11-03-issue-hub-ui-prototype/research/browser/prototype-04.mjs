const task = await taskSpace(8);
const page = task.page('p1');
await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `window.__issueHubBootErrors=[];window.addEventListener('error',e=>window.__issueHubBootErrors.push({message:e.message,file:e.filename,line:e.lineno}));window.addEventListener('unhandledrejection',e=>window.__issueHubBootErrors.push({message:String(e.reason?.stack||e.reason)}));` });
await page.reload();
console.log((await page.snapshot()).slice(0, 5000));
console.log(await page.evaluate(() => ({ errors: window.__issueHubBootErrors, resources: performance.getEntriesByType('resource').map(entry => ({ path: new URL(entry.name).pathname, status: entry.responseStatus })) })));
