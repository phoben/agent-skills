import {readFile} from 'node:fs/promises';
const task=await taskSpace(8),page=task.page('p1');
const receipt=JSON.parse(await readFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/experience-trace-id.json','utf8'));
if(receipt.identifier){await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:receipt.identifier});console.log({temporaryRecorderRemoved:true});}
