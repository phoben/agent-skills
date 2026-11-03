const task=await taskSpace(27),page=task.page('p1');
const target=await page.evaluate(()=>{const button=document.querySelector('.matrix-row [data-day]');return {project:button.dataset.project,day:button.dataset.day};});
await page.click(`[data-project="${target.project}"][data-day="${target.day}"]`,{label:'核对历史单日会话时间'});
await page.waitForFunction(()=>!!document.querySelector('.session-table tbody tr'),undefined,{timeout:30000});
console.log('单日时间核对',await page.evaluate(()=>({scope:document.querySelector('#dialog-scope').textContent,activity:[...document.querySelectorAll('.session-table tbody tr td:first-child small')].map(item=>item.textContent),summary:document.querySelector('.dialog-summary').textContent})));
await page.press('.dialog-close','Escape');
await task.finish({keep:['p1']});
