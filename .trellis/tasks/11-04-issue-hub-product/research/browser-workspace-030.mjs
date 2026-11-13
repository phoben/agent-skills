import {writeFile} from 'node:fs/promises';
const task=await taskSpace(8),page=task.page('p1'),report={remoteWrites:false,chatOpened:false,failure:null};
try{
  await page.click('#overlay-root .modal-header [data-action="close-overlay"]',{label:'关闭已完成的连接检查'});
  await page.click('#task-more',{label:'查看后续工作区操作'});await page.click('[data-action="change-workspace"]',{label:'修改后续任务工作区'});
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('input[name="workspace"]'),undefined,{timeout:90000});
  report.workspaceOptions=await page.evaluate(()=>document.querySelector('iframe').contentDocument.querySelectorAll('input[name="workspace"]').length);
  await page.click('#overlay-root [data-action="confirm-workspace"]',{label:'仅保存后续任务绑定'});await page.waitForFunction(()=>!document.querySelector('iframe')?.contentDocument?.querySelector('.modal'),undefined,{timeout:90000});
  report.bindingSavedWithoutChat=true;
  await page.click('#task-more',{label:'再次打开已有绑定'});await page.click('[data-action="change-workspace"]',{label:'核对有效绑定仍可修改'});
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('input[name="workspace"]:checked'),undefined,{timeout:90000});report.existingBindingEditable=true;
  await page.click('#overlay-root .modal-header [data-action="close-overlay"]',{label:'取消工作区修改'});
  report.selected=await page.evaluate(()=>document.querySelector('iframe').contentDocument.querySelector('.issue-row.selected')?.dataset.number);if(report.selected!=='5')throw new Error('绑定操作改变了当前Issue');
}catch(error){report.failure=error.message;}
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/browser-workspace-030.json',JSON.stringify(report,null,2)+'\n');console.log(report);
