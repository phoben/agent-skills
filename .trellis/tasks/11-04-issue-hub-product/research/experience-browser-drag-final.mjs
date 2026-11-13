import {writeFile} from 'node:fs/promises';
const task=await taskSpace(8),page=task.page('p1');
const report={realBrowser:true,remoteWrites:false,chatOpened:false,rounds:[],failure:null};
const widths=()=>page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;return {navigation:d.querySelector('#navigation').getBoundingClientRect().width,queue:d.querySelector('#queue').getBoundingClientRect().width,number:d.querySelector('.issue-row.selected')?.dataset.number,overflow:d.documentElement.scrollWidth>d.documentElement.clientWidth};});
async function trace(){await page.evaluate(()=>{window.__layoutSaves=[];const original=window.fetch.bind(window);window.fetch=async(input,init)=>{let entry;try{const body=JSON.parse(init?.body||'{}');if(body.name==='issue-hub-mutate'&&body.arguments?.action==='view-state-save'){entry={value:body.arguments.payload.value,done:false};window.__layoutSaves.push(entry);}}catch{}const response=await original(input,init);if(entry){const data=await response.clone().json();entry.error=data.isError?data.structuredContent?.error?.code:null;entry.done=true;}return response;};});}
async function drag(column,target){const b=await page.evaluate(c=>{const d=document.querySelector('iframe').contentDocument,n=d.querySelector(`[data-column="${c}"]`),r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,value:Number(n.getAttribute('aria-valuenow')),hidden:n.hidden||!r.width};},column);if(b.hidden)throw new Error(`${column}分割线不可见，不能继续拖动`);await page.mouse.move(b.x,b.y,{label:'定位列宽分割线'});await page.mouse.down();await page.mouse.move(b.x+target-b.value,b.y,{label:'调整面板宽度'});await page.mouse.up();}
try{
  for(let round=1;round<=3;round++){
    await trace();const navigation=240+round*20,queue=360+round*40;
    await drag('navigation',navigation);await drag('queue',queue);
    await page.waitForFunction(expected=>window.__layoutSaves.some(r=>r.done&&Math.abs(r.value.navigationWidth-expected.navigation)<2&&Math.abs(r.value.queueWidth-expected.queue)<2),{navigation,queue},{timeout:90000});
    const save=await page.evaluate(()=>window.__layoutSaves.at(-1));if(save.error)throw new Error(`列宽持久化失败:${save.error}`);
    const before=await widths();if(Math.abs(before.navigation-navigation)>2||Math.abs(before.queue-queue)>2||before.number!=='182'||before.overflow)throw new Error('拖动宽度或选择状态异常');
    await page.reload();
    await page.waitForFunction(expected=>{const d=document.querySelector('iframe')?.contentDocument;return d?.querySelector('#detail-title')&&Math.abs(d.querySelector('#navigation').getBoundingClientRect().width-expected.navigation)<2&&Math.abs(d.querySelector('#queue').getBoundingClientRect().width-expected.queue)<2;},{navigation,queue},{timeout:120000});
    report.rounds.push({round,...await widths(),reloadRestored:true});
  }
  await drag('navigation',800);let actual=await widths();if(Math.abs(actual.navigation-420)>2)throw new Error('左栏未限制最大宽度');
  await drag('navigation',120);actual=await widths();if(Math.abs(actual.navigation-164)>2)throw new Error('左栏未限制最小宽度');
  await page.focus('[data-column="queue"]');await page.press('[data-column="queue"]','End');actual=await widths();if(Math.abs(actual.queue-640)>2)throw new Error('Issue栏键盘最大值异常');
  await page.press('[data-column="queue"]','Home');actual=await widths();if(Math.abs(actual.queue-280)>2)throw new Error('Issue栏键盘最小值异常');
  await page.press('[data-column="queue"]','Enter');actual=await widths();if(Math.abs(actual.queue-316)>2)throw new Error('Issue栏恢复默认异常');
  report.boundsAndKeyboard=true;
  await drag('navigation',300);await drag('queue',480);
}catch(error){report.failure=error.message;}
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/experience-browser-drag-final.json',JSON.stringify(report,null,2)+'\n');
console.log(report);
