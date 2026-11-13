import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const task=await taskSpace(30),page=task.page('p1');
const report={version:'0.3.4',remoteWrites:false,chatOpened:false,checks:[],screenshots:[]};
async function checkMenu(selector){
  await page.click(selector,{label:'核对精简后的项目菜单'});
  const s=await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument,m=d.querySelector('#account-menu'),t=d.activeElement,r=m?.getBoundingClientRect();return{items:[...(m?.querySelectorAll('[role="menuitem"]')||[])].map(n=>n.dataset.action),menuText:m?.textContent,badgeCount:d.querySelectorAll('.account-notice').length,statusRows:d.querySelectorAll('#account-discovery-status,.account-discovery').length,triggerTitles:[...d.querySelectorAll('[data-action="account-menu"]')].map(n=>[n.title,n.getAttribute('aria-label')]),inside:!!r&&r.left>=0&&r.top>=0&&r.right<=d.documentElement.clientWidth&&r.bottom<=d.documentElement.clientHeight,overflow:d.documentElement.scrollWidth>d.documentElement.clientWidth};});
  assert.deepEqual(s.items,['discover','reset-layout']);assert.equal(s.badgeCount,0);assert.equal(s.statusRows,0);assert.ok(!/不完整|尚未完成|项目发现/.test(s.menuText));assert.ok(!/不完整|项目发现/.test(JSON.stringify(s.triggerTitles)));assert.ok(s.inside&&!s.overflow);return s;
}
try{
  await page.cdp('Emulation.setDeviceMetricsOverride',{width:1120,height:880,deviceScaleFactor:1,mobile:false});
  report.checks.push({theme:'dark',...await checkMenu('#account-menu-trigger')});
  report.screenshots.push(await page.screenshot({path:'E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/discovery-policy-menu-dark.png'}));
  await page.keyboard.press('Escape');
  await page.click('#connection-check',{label:'核对项目读取诊断'});
  await page.waitForFunction(()=>!!document.querySelector('iframe').contentDocument.querySelector('.diagnostics-checks'),undefined,{timeout:45000});
  const diag=await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument,n=d.querySelector('.modal-body');return{heading:n.querySelector('h3')?.textContent,hasCoverageWarning:/不完整|范围不完整|深度上限|数量上限|完整子目录扫描|部分项目尚未完成核对/.test(n.textContent),hasRealReadProblem:/项目目录无法读取|Git信息无法读取|目录无法访问|目录已不存在/.test(n.textContent)};});
  assert.equal(diag.heading,'项目读取');assert.equal(diag.hasCoverageWarning,false);assert.ok(diag.hasRealReadProblem);report.checks.push({diagnostics:diag});
  await page.click('button[aria-label="关闭窗口"]',{label:'返回正常项目列表'});
  await page.goto('http://127.0.0.1:18301/?theme=light&repo=phoben%2Fagent-skills');
  await page.waitForFunction(()=>{const d=document.querySelector('iframe')?.contentDocument;return d?.querySelector('#queue-title')?.textContent==='phoben/agent-skills'&&d.querySelector('.issue-row');},undefined,{timeout:45000});
  await page.cdp('Emulation.setDeviceMetricsOverride',{width:1120,height:880,deviceScaleFactor:1,mobile:false});
  report.checks.push({theme:'light',...await checkMenu('#account-menu-trigger')});report.screenshots.push(await page.screenshot({path:'E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/discovery-policy-menu-light.png'}));
  await page.keyboard.press('Escape');
  await page.cdp('Emulation.setDeviceMetricsOverride',{width:960,height:680,deviceScaleFactor:1,mobile:false});
  await page.waitForFunction(()=>document.querySelector('iframe').contentDocument.querySelector('#status-account-menu').getClientRects().length>0,undefined,{timeout:5000});
  report.checks.push({narrow:true,...await checkMenu('#status-account-menu')});report.screenshots.push(await page.screenshot({path:'E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/discovery-policy-menu-narrow.png'}));
  await page.keyboard.press('Escape');report.passed=true;
}catch(error){report.passed=false;report.error=error.message;process.exitCode=1;}
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/discovery-policy-browser.json',JSON.stringify(report,null,2)+'\n');console.log(report);
