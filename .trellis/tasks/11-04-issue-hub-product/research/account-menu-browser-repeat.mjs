import {copyFile} from 'node:fs/promises';
for(const round of [2,3]){
  await import(`./account-menu-browser-final.mjs?round=${round}`);
  await copyFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/account-menu-browser-final.json',`E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/account-menu-browser-round${round}.json`);
}
const task=await taskSpace(27);await task.finish({keep:[]});console.log({spaceId:27,finished:true});
