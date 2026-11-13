import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const task=await taskSpace(27),page=task.page('p1');
const report={version:'0.3.3',remoteWrites:false,chatOpened:false,checks:[]};
const state=()=>page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument,m=d.querySelector('#account-menu');return{open:!!m,focus:d.activeElement?.id||d.activeElement?.dataset.action,viewport:[d.documentElement.clientWidth,d.documentElement.clientHeight]};});
try{
await page.goto('http://127.0.0.1:18300/?theme=dark&repo=phoben%2Fagent-skills&revision=final');
await page.waitForFunction(()=>{const d=document.querySelector('iframe')?.contentDocument;return d?.querySelector('#queue-title')?.textContent==='phoben/agent-skills'&&d.querySelector('.issue-row');},undefined,{timeout:45000});
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1120,height:880,deviceScaleFactor:1,mobile:false});
await page.waitForFunction(()=>document.querySelector('iframe').contentDocument.documentElement.clientWidth===1120,undefined,{timeout:5000});
await page.click('#account-menu-trigger',{label:'检查新版用户上拉菜单'});
assert.ok((await state()).open);
await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;d.querySelector('#issue-list').dispatchEvent(new d.defaultView.Event('scroll'));});assert.ok((await state()).open);report.checks.push({backgroundListScrollKeepsMenu:true});
await page.keyboard.press('End');assert.equal((await state()).focus,'reset-layout');await page.keyboard.press('Home');assert.equal((await state()).focus,'discover');await page.keyboard.press('Escape');assert.equal((await state()).focus,'account-menu-trigger');assert.ok(!(await state()).open);report.checks.push({keyboardAndEscape:true});
await page.click('#account-menu-trigger',{label:'检查账号菜单开关'});await page.click('#account-menu-trigger',{label:'重复点击关闭菜单'});assert.ok(!(await state()).open);report.checks.push({toggle:true});
await page.click('#account-menu-trigger',{label:'检查菜单外点击关闭'});await page.click('#issue-search',{label:'选择搜索关闭菜单'});assert.ok(!(await state()).open);report.checks.push({outsideClose:true});
await page.click('#connection-check',{label:'从底部检查连接'});await page.waitForFunction(()=>document.querySelector('iframe').contentDocument.querySelector('#modal-title')?.textContent==='连接检查',undefined,{timeout:10000});await page.click('button[aria-label="关闭窗口"]',{label:'关闭诊断并返回入口'});assert.equal((await state()).focus,'connection-check');report.checks.push({diagnosticsAndFocus:true});
await page.click('#account-menu-trigger',{label:'打开布局菜单'});await page.click('#account-menu [data-action="reset-layout"]',{label:'恢复默认栏目宽度'});assert.ok(!(await state()).open);report.checks.push({resetLayoutAction:true});
report.passed=true;
}catch(error){report.passed=false;report.failure=error.message;report.current=await state();process.exitCode=1;}
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/account-menu-browser-final.json',JSON.stringify(report,null,2)+'\n');console.log(report);
