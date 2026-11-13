import { writeFile } from 'node:fs/promises';
const task=await taskSpace(26),page=task.page('p1');
const report={version:'0.3.2',realGithub:true,remoteWrites:false,images:[]};
for(let index=0;index<4;index++){
  await page.hover(`#issue-body-view .issue-image >> nth=${index}`,{label:'查看原位置截图预览'});
  await page.waitForFunction(i=>{const img=document.querySelector('iframe')?.contentDocument?.querySelectorAll('#issue-body-view .issue-image')[i]?.querySelector('img');return img?.complete&&img.naturalWidth>0&&img.naturalHeight>0;},index,{timeout:45000});
  report.images.push(await page.evaluate(i=>{const d=document.querySelector('iframe').contentDocument,n=d.querySelectorAll('#issue-body-view .issue-image')[i],img=n.querySelector('img');return{state:n.dataset.imageState,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,dataOnly:img.src.startsWith('data:image/png;base64,'),renderedWidth:img.getBoundingClientRect().width,renderedHeight:img.getBoundingClientRect().height};},index));
}
report.layout=await page.evaluate(()=>{const d=document.querySelector('iframe').contentDocument;return{selected:d.querySelector('.issue-row.selected')?.dataset.number,overflow:d.documentElement.scrollWidth>d.documentElement.clientWidth,csp:d.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content};});
report.passed=report.images.every(i=>i.state==='loaded'&&i.dataOnly)&&!report.layout.overflow;
report.screenshot=await page.screenshot({path:'E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/image-preview-browser.png'});
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/image-browser-final.json',JSON.stringify(report,null,2)+'\n');
console.log(report);
