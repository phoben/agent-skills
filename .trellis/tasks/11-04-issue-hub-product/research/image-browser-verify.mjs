import { writeFile } from 'node:fs/promises';
const task=await taskSpace('issue-hub-image-preview-1105'),page=task.page('p1');
console.log({spaceId:task.spaceId,page:page.label});
const report={realGithub:true,remoteWrites:false,chatOpened:false,version:'0.3.2',phase:'navigate',images:[],failure:null};
try{
  await page.goto('http://127.0.0.1:18299/?theme=dark&repo=phoben%2Faoy-erp');
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('#queue-title')?.textContent==='phoben/aoy-erp',undefined,{timeout:60000});
  report.phase='select';await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelector('[data-action="open-issue"][data-number="191"]'),undefined,{timeout:60000});
  await page.click('[data-action="open-issue"][data-number="191"]',{label:'查看带截图的已有 Issue'});
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.querySelectorAll('#issue-body-view .issue-image').length===4,undefined,{timeout:60000});
  report.phase='decode';
  for(let index=0;index<4;index++){
    await page.hover(`#issue-body-view .issue-image >> nth=${index}`,{label:'只读检查截图预览'});
    await page.waitForFunction(i=>{const img=document.querySelector('iframe')?.contentDocument?.querySelectorAll('#issue-body-view .issue-image')[i]?.querySelector('img');return img?.complete&&img.naturalWidth>0&&img.naturalHeight>0;},index,{timeout:60000});
    report.images.push(await page.evaluate(i=>{const d=document.querySelector('iframe').contentDocument,node=d.querySelectorAll('#issue-body-view .issue-image')[i],img=node.querySelector('img');return{naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,dataOnly:img.src.startsWith('data:image/png;base64,'),state:node.dataset.imageState,renderedWidth:img.getBoundingClientRect().width};},index));
  }
  report.page=await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;return{selected:d.querySelector('.issue-row.selected')?.dataset.number,overflow:d.documentElement.scrollWidth>d.documentElement.clientWidth,csp:d.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content};});
  if(report.page.selected!=='191'||report.page.overflow||report.images.some(i=>!i.dataOnly||i.state!=='loaded'))throw new Error('图片或布局结果不符');
  report.screenshot=await page.screenshot({path:'E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/image-preview-browser.png'});report.passed=true;
}catch(error){report.failure=error.message;report.passed=false;report.current=await page.evaluate(()=>{const d=document.querySelector('iframe')?.contentDocument;return{queue:d?.querySelector('#queue-title')?.textContent,selected:d?.querySelector('.issue-row.selected')?.dataset.number,images:[...(d?.querySelectorAll('.issue-image')||[])].map(n=>({state:n.dataset.imageState,status:n.querySelector('.image-status')?.textContent,width:n.querySelector('img')?.naturalWidth})),errors:[...(d?.querySelectorAll('.global-message,[role="alert"]')||[])].map(n=>n.textContent)};});}
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/image-browser-verify.json',JSON.stringify(report,null,2)+'\n');console.log(report);
