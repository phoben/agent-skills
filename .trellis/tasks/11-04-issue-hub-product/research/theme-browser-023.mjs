import {writeFile} from 'node:fs/promises';
const task=await takeOverTaskSpace(8),page=task.page('p1');
const report={realBrowser:true,remoteWrites:false,states:[],failure:null};
async function inspect(name){return page.evaluate(label=>{const d=document.querySelector('iframe').contentDocument,w=d.defaultView,c=n=>n?w.getComputedStyle(n):null;return {name:label,theme:d.documentElement.dataset.theme,background:c(d.body).backgroundColor,text:c(d.body).color,navigation:c(d.querySelector('#navigation')).backgroundColor,buttonBackground:c(d.querySelector('.button.primary'))?.backgroundColor,buttonText:c(d.querySelector('.button.primary'))?.color,selected:c(d.querySelector('.issue-row.selected'))?.backgroundColor,hostBackground:d.documentElement.style.getPropertyValue('--color-background-primary'),selectedIssue:d.querySelector('.issue-row.selected')?.dataset.number,overflow:d.documentElement.scrollWidth>d.documentElement.clientWidth};},name);}
async function change(context){await page.evaluate(value=>window.__issueHubPreviewTheme(value),context);await page.waitForFunction(theme=>document.querySelector('iframe')?.contentDocument?.documentElement.dataset.theme===theme,context.theme,{timeout:10000});}
try{
  await page.goto('http://127.0.0.1:18293/?theme=dark&repo=phoben%2Faoy-erp&issue=182');
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#detail-title'),undefined,{timeout:120000});
  report.states.push(await inspect('dark-fallback'));
  await change({theme:'light',styles:{variables:{}}});report.states.push(await inspect('light-fallback'));
  await change({theme:'dark',styles:{variables:{'--color-background-primary':'#242424','--color-background-secondary':'#151515','--color-background-tertiary':'#303030','--color-text-primary':'#f2f2f2','--color-text-secondary':'#bdbdbd','--color-border-primary':'#555555'}}});
  await page.waitForFunction(()=>{const d=document.querySelector('iframe').contentDocument;return d.defaultView.getComputedStyle(d.body).backgroundColor==='rgb(36, 36, 36)';},undefined,{timeout:10000});report.states.push(await inspect('host-tokens-dark'));
  await change({theme:'light',styles:{variables:{}}});report.states.push(await inspect('light-clears-old-tokens'));
  await change({theme:'dark'});report.states.push(await inspect('dark-clears-light'));
  const backgrounds=report.states.map(x=>x.background),cleared=report.states[3];
  if(backgrounds[0]!=='rgb(33, 33, 33)'||backgrounds[1]!=='rgb(255, 255, 255)'||cleared.hostBackground||backgrounds[4]!=='rgb(33, 33, 33)')throw new Error('宿主主题或回退颜色不正确');
  if(report.states.some(x=>x.selectedIssue!=='182'||x.overflow))throw new Error('切换主题改变了选择或造成横向溢出');
}catch(error){report.failure=error.message;}
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/theme-browser-023.json',JSON.stringify(report,null,2)+'\n');console.log(report);
