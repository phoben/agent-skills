import { writeFile } from 'node:fs/promises';
const task = await taskSpace(8);
const page = task.page('p1');
const report = { source:'real-mcp-browser-local-sqlite', remoteWrites:false, chatOpened:false, results:[], failure:null };
try {
  for (let round=1;round<=3;round++) {
    const text = `Issue Hub 本机草稿验证，第 ${round} 轮\n此内容仅保存本机，不发布到 GitHub。`;
    await page.fill('#comment-body',text);
    await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('#comment-draft-status')?.textContent.includes('本机草稿已保存'),undefined,{timeout:90000});
    await page.click('#close-detail',{label:'保留草稿返回列表'});
    await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('#detail')?.hidden,undefined,{timeout:90000});
    await page.click('[data-action="open-issue"][data-number="3"]',{label:'重新读取草稿所在 Issue'});
    await page.waitForFunction(expected => document.querySelector('iframe')?.contentDocument?.querySelector('#comment-body')?.value===expected,text,{timeout:120000});
    await page.reload();
    await page.waitForFunction(expected => document.querySelector('iframe')?.contentDocument?.querySelector('#comment-body')?.value===expected,text,{timeout:120000});
    report.results.push({round,savedLocally:true,navigationReadback:true,reloadReadback:true});
  }
  await page.fill('#comment-body','');
  await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('#comment-draft-status')?.textContent.includes('本机草稿已保存'),undefined,{timeout:90000});
  report.testDraftCleared=true;
} catch(error) { report.failure=error.message; }
await writeFile('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/browser-live-drafts.json',JSON.stringify(report,null,2)+'\n');
console.log(report);
