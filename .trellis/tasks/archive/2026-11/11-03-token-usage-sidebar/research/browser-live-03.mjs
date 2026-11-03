const task=await taskSpace(27),page=task.page('p1');
await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:"window.__usageErrors=[];window.addEventListener('error',e=>window.__usageErrors.push({message:e.message,line:e.lineno}));window.addEventListener('unhandledrejection',e=>window.__usageErrors.push({message:String(e.reason?.message||e.reason)}));"});
await page.reload();
console.log(await page.evaluate(()=>({errors:window.__usageErrors,scriptCount:document.scripts.length,scriptLengths:[...document.scripts].map(s=>s.textContent.length)})));
