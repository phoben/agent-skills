import {writeFile} from 'node:fs/promises';
const task=await taskSpace(8),page=task.page('p1');
const report={realBrowser:true,remoteWrites:false,chatOpened:false,failure:null};
async function drag(column,target){const b=await page.evaluate(c=>{const n=document.querySelector('iframe').contentDocument.querySelector(`[data-column="${c}"]`),r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,value:Number(n.getAttribute('aria-valuenow'))};},column);await page.mouse.move(b.x,b.y,{label:'定位列宽分割线'});await page.mouse.down();await page.mouse.move(b.x+target-b.value,b.y,{label:'调整宽度保留输入'});await page.mouse.up();}
async function scrollDetail(delta){const b=await page.evaluate(()=>{const r=document.querySelector('iframe').contentDocument.querySelector('#detail').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});await page.mouse.move(b.x,b.y,{label:'定位详情滚动区域'});await page.mouse.wheel(0,delta,{label:'滚动到讨论或标题'});}
try{
  await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument,w=d.defaultView;w.__clickTimings=[];d.addEventListener('click',event=>{const target=event.target.closest('[data-action="repository"],[data-action="open-issue"]');if(target)w.__clickTimings.push({kind:target.dataset.action,target:target.dataset.repo||target.dataset.number,start:w.performance.now(),done:false});},true);new MutationObserver(()=>{for(const record of w.__clickTimings){if(record.done)continue;const matched=record.kind==='repository'?d.querySelector('#queue-title')?.textContent===record.target:d.querySelector('.issue-row.selected')?.dataset.number===record.target;if(matched){record.ms=w.performance.now()-record.start;record.done=true;}}}).observe(d.querySelector('#workspace'),{subtree:true,childList:true,attributes:true});});
  await page.click('[data-action="repository"][data-repo="phoben/agent-skills"]',{label:'单击切换项目计时'});
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('[data-action="open-issue"][data-number="3"]'),undefined,{timeout:90000});
  await page.click('[data-action="open-issue"][data-number="3"]',{label:'单击选中 Issue 计时'});
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#detail-title'),undefined,{timeout:90000});
  await page.click('[data-action="repository"][data-repo="phoben/aoy-erp"]',{label:'返回仓库保留偏好'});
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('[data-action="open-issue"][data-number="182"]'),undefined,{timeout:90000});
  await page.click('[data-action="open-issue"][data-number="182"]',{label:'单击当前处理 Issue'});
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#comment-body'),undefined,{timeout:90000});
  report.clickToSelectionMs=await page.evaluate(()=>document.querySelector('iframe').contentDocument.defaultView.__clickTimings.filter(x=>x.done).map(({kind,ms})=>({kind,ms})));
  const text='Issue Hub 列宽验证草稿（仅本机，不发布）';
  await scrollDetail(5000);await page.fill('#comment-body',text);
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#comment-draft-status')?.textContent.includes('本机草稿已保存'),undefined,{timeout:90000});
  await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;d.defaultView.__keptCommentNode=d.querySelector('#comment-body');});
  await drag('navigation',320);await drag('queue',500);
  const retained=await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument,n=d.querySelector('#comment-body');return{sameNode:n===d.defaultView.__keptCommentNode,text:n.value,selected:d.querySelector('.issue-row.selected')?.dataset.number};});
  if(!retained.sameNode||retained.text!==text||retained.selected!=='182')throw new Error('调整列宽重建了输入或改变了当前Issue');
  report.editorNodePreserved=true;report.draftTextPreserved=true;
  await scrollDetail(5000);await page.fill('#comment-body','');
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#comment-draft-status')?.textContent.includes('本机草稿已保存'),undefined,{timeout:90000});
  report.testDraftCleared=true;await drag('navigation',300);await drag('queue',480);await scrollDetail(-5000);
}catch(error){report.failure=error.message;}
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/experience-browser-input.json',JSON.stringify(report,null,2)+'\n');console.log(report);
