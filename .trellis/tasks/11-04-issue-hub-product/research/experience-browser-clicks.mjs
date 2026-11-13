import {writeFile} from 'node:fs/promises';
const task=await taskSpace(8),page=task.page('p1');
const report={realBrowser:true,remoteWrites:false,chatOpened:false,results:[],failure:null};
async function state(){return page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;return {repo:d.querySelector('#queue-title')?.textContent,selected:d.querySelector('.issue-row.selected')?.dataset.number,title:d.querySelector('#detail-title')?.textContent};});}
async function single(selector,expected){const started=Date.now();try{await page.click(selector,{label:'单击切换当前对象'});}catch(error){const current=await state();if(!expected(current))throw error;report.receiptNote='控件已切换，但驱动回执遇到元素替换；未重复点击。';}const current=await state();if(!expected(current))throw new Error('一次点击后选择未立即变化');return {feedbackMs:Date.now()-started,...current};}
try{
  const repo=await single('[data-action="repository"][data-repo="phoben/agent-skills"]',s=>s.repo==='phoben/agent-skills');report.results.push({name:'单击项目立即切换',...repo});
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('[data-action="open-issue"][data-number="3"]'),undefined,{timeout:120000});
  const issue=await single('[data-action="open-issue"][data-number="3"]',s=>s.selected==='3');report.results.push({name:'单击Issue立即选中',...issue});
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#detail-title'),undefined,{timeout:120000});
  await single('[data-action="repository"][data-repo="phoben/aoy-erp"]',s=>s.repo==='phoben/aoy-erp');
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('[data-action="open-issue"][data-number="182"]'),undefined,{timeout:120000});
  const other=await page.evaluate(()=>[...document.querySelector('iframe').contentDocument.querySelectorAll('[data-action="open-issue"]')].map(n=>n.dataset.number).find(n=>n!=='182'));
  for(let round=1;round<=3;round++){if(other)await single(`[data-action="open-issue"][data-number="${other}"]`,s=>s.selected===other);await single('[data-action="open-issue"][data-number="182"]',s=>s.selected==='182');await page.waitForFunction(()=>{const d=document.querySelector('iframe')?.contentDocument;return d?.querySelector('.issue-row.selected')?.dataset.number==='182'&&d.querySelector('#detail-title');},undefined,{timeout:120000});report.results.push({name:'单击连续处理',round,...await state()});}
  await page.goto('http://127.0.0.1:18292/?theme=dark');
  await page.waitForFunction(()=>{const d=document.querySelector('iframe')?.contentDocument;return d?.querySelector('#queue-title')?.textContent==='phoben/aoy-erp'&&!d.querySelector('.initial-load');},undefined,{timeout:120000});
  report.results.push({name:'无URL强制项目仍恢复上次仓库',...await state()});
  await single('[data-action="open-issue"][data-number="182"]',s=>s.selected==='182');
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#detail-title'),undefined,{timeout:120000});
}catch(error){report.failure=error.message;}
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/experience-browser-clicks.json',JSON.stringify(report,null,2)+'\n');console.log(report);
