import {writeFile} from 'node:fs/promises';
const task=await taskSpace(8),page=task.page('p1'),report={remoteWrites:false,chatOpened:false,failure:null};
try{
  const saved=await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;return {title:d.querySelector('#modal-title')?.textContent,body:d.querySelector('.modal-body')?.textContent,announcer:d.querySelector('#announcer')?.textContent};});
  if(saved.title!=='会话关联状态'||!saved.body.includes('暂无任务请求')||!saved.announcer.includes('工作区已保存'))throw new Error('未取得已保存绑定的明确反馈');
  report.bindingSavedWithoutChat=true;
  await page.click('#overlay-root [data-action="change-workspace"]',{label:'修改已经有效的工作区绑定'});await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('input[name="workspace"]:checked'),undefined,{timeout:90000});
  report.workspaceOptions=await page.evaluate(()=>document.querySelector('iframe').contentDocument.querySelectorAll('input[name="workspace"]').length);report.existingBindingEditable=true;
  await page.click('#overlay-root .modal-header [data-action="close-overlay"]',{label:'取消本次绑定修改'});
  report.selected=await page.evaluate(()=>document.querySelector('iframe').contentDocument.querySelector('.issue-row.selected')?.dataset.number);if(report.selected!=='5')throw new Error('绑定操作改变了Issue');
}catch(error){report.failure=error.message;}
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/browser-workspace-corrected-030.json',JSON.stringify(report,null,2)+'\n');console.log(report);
