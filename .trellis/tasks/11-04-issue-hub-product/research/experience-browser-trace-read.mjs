import {writeFile} from 'node:fs/promises';
const task=await taskSpace(8),page=task.page('p1');
const report=await page.evaluate(()=>{const d=document.querySelector('iframe')?.contentDocument;return {repository:d?.querySelector('#queue-title')?.textContent,selected:d?.querySelector('.issue-row.selected')?.dataset.number,notice:d?.querySelector('.global-message')?.textContent,announcer:d?.querySelector('#announcer')?.textContent,calls:window.__experienceCalls};});
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/experience-fetch-trace.json',JSON.stringify(report,null,2)+'\n');
console.log(report);
