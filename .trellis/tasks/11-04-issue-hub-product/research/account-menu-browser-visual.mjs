import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const task=await taskSpace(27),page=task.page('p1');
const report={version:'0.3.3',remoteWrites:false,checks:[],screenshots:[]};
const read=()=>page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument,m=d.querySelector('#account-menu'),t=d.querySelector('#account-menu-trigger')?.getClientRects().length?d.querySelector('#account-menu-trigger'):d.querySelector('#status-account-menu'),r=m?.getBoundingClientRect(),a=t?.getBoundingClientRect();return{open:!!m,viewport:[d.documentElement.clientWidth,d.documentElement.clientHeight],upward:!!r&&r.bottom<=a.top,inside:!r||r.left>=0&&r.top>=0&&r.right<=d.documentElement.clientWidth&&r.bottom<=d.documentElement.clientHeight,overflow:d.documentElement.scrollWidth>d.documentElement.clientWidth,focus:d.activeElement?.id||d.activeElement?.dataset.action};});
try{
for(const theme of ['light','dark']){
  if(!String(await page.url()).includes(`theme=${theme}`))await page.goto(`http://127.0.0.1:18300/?theme=${theme}&repo=phoben%2Fagent-skills`);
  await page.waitForFunction(()=>{const d=document.querySelector('iframe')?.contentDocument;return d?.querySelector('#queue-title')?.textContent==='phoben/agent-skills'&&d.querySelector('.issue-row');},undefined,{timeout:45000});
  await page.cdp('Emulation.setDeviceMetricsOverride',{width:1120,height:880,deviceScaleFactor:1,mobile:false});
  await page.waitForFunction(()=>document.querySelector('iframe').contentDocument.documentElement.clientWidth===1120,undefined,{timeout:5000});
  await page.click('#account-menu-trigger',{label:'查看账号菜单与连接状态'});
  await page.waitForFunction(()=>!!document.querySelector('iframe').contentDocument.querySelector('#account-menu'),undefined,{timeout:5000});
  let s=await read();assert.ok(s.open&&s.upward&&s.inside&&!s.overflow);report.checks.push({theme,...s});
  report.screenshots.push(await page.screenshot({path:`E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/account-menu-final-${theme}.png`}));
  await page.keyboard.press('Escape');assert.equal((await read()).focus,'account-menu-trigger');
}
await page.cdp('Emulation.setDeviceMetricsOverride',{width:960,height:680,deviceScaleFactor:1,mobile:false});
await page.waitForFunction(()=>{const d=document.querySelector('iframe').contentDocument;return d.documentElement.clientWidth===960&&d.querySelector('#status-account-menu')?.getClientRects().length>0;},undefined,{timeout:5000});
await page.click('#status-account-menu',{label:'窄窗查看账号上拉菜单'});let s=await read();assert.ok(s.open&&s.upward&&s.inside&&!s.overflow);report.checks.push({theme:'dark',narrow:true,...s});
report.screenshots.push(await page.screenshot({path:'E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/account-menu-final-narrow.png'}));
await page.keyboard.press('Escape');assert.equal((await read()).focus,'status-account-menu');report.passed=true;
}catch(error){report.passed=false;report.failure=error.message;report.current=await read();process.exitCode=1;}
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/account-menu-browser-visual.json',JSON.stringify(report,null,2)+'\n');console.log(report);
