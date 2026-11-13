import {readFile,writeFile} from 'node:fs/promises';
const state=JSON.parse(await readFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/poll-remote-wave2-030.json','utf8'));
const task=await taskSpace(8),page=task.page('p1'),report={remoteWrites:false,chatOpened:false,failure:null};
try{
  await page.fill('#comment-body','');await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#comment-draft-status')?.textContent.includes('本机草稿已保存'),undefined,{timeout:90000});report.testDraftCleared=true;
  await page.click('#statusbar [data-action="refresh"]',{label:'恢复验收标题的最新显示'});await page.waitForFunction(title=>document.querySelector('iframe')?.contentDocument?.querySelector('#detail-title')?.textContent===title,state.previousTitle,{timeout:90000});
  await page.click('#navigation [data-action="diagnostics"]',{label:'查看实际环境连接检查'});await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelectorAll('.diagnostics-checks li').length===9,undefined,{timeout:90000});
  report.diagnostics=await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;return [...d.querySelectorAll('.diagnostics-checks li')].map(n=>({label:n.querySelector('strong').textContent,status:n.dataset.checkStatus}));});
  if(report.diagnostics.some(check=>check.status!=='ok'))throw new Error('实际环境连接检查仍有未通过项');
  await page.click('#overlay-root [data-action="close-overlay"]',{label:'关闭连接检查'});
  await page.click('#task-more',{label:'查看新增工作区操作'});await page.click('[data-action="change-workspace"]',{label:'修改后续任务工作区'});await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('input[name="workspace"]'),undefined,{timeout:90000});
  report.workspaceOptions=await page.evaluate(()=>document.querySelector('iframe').contentDocument.querySelectorAll('input[name="workspace"]').length);
  await page.click('#overlay-root [data-action="confirm-workspace"]',{label:'仅保存后续工作区绑定'});await page.waitForFunction(()=>!document.querySelector('iframe')?.contentDocument?.querySelector('.modal'),undefined,{timeout:90000});
  report.bindingSavedWithoutChat=true;report.selected=await page.evaluate(()=>document.querySelector('iframe').contentDocument.querySelector('.issue-row.selected')?.dataset.number);
  if(report.selected!=='5')throw new Error('检查或绑定改变了当前Issue');
}catch(error){report.failure=error.message;}
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/browser-final-local-030.json',JSON.stringify(report,null,2)+'\n');console.log(report);
