import {writeFile} from 'node:fs/promises';
const task=await taskSpace(8),page=task.page('p1');
const receipt=await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__experienceCalls=[];const original=window.fetch.bind(window);window.fetch=async(input,init)=>{let entry;try{const body=JSON.parse(init?.body||'{}');if(body.name){entry={name:body.name,action:body.arguments?.action||'open',start:performance.now(),done:false};window.__experienceCalls.push(entry);}}catch{}const response=await original(input,init);if(entry){try{const value=await response.clone().json();entry.error=value.isError?value.structuredContent?.error?.code||'ERROR':null;entry.identity=value.structuredContent?.identity;entry.end=performance.now();entry.done=true;}catch{entry.error='JSON';entry.done=true;}}return response;};})();`});
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/experience-trace-id.json',JSON.stringify(receipt)+'\n');
await page.reload();
await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#detail-title'),undefined,{timeout:120000});
console.log(await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;return {repository:d.querySelector('#queue-title')?.textContent,selected:d.querySelector('.issue-row.selected')?.dataset.number,calls:window.__experienceCalls};}));
