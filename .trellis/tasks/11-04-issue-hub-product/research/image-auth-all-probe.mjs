import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGithubClient } from '../../../../packages/issue-hub/src/github/client.mjs';
const run=promisify(execFile),report={readOnly:true,privateContentPrinted:false,images:[],failure:null};
try{
 const gh=createGithubClient(),issue=await gh.request('GET','/repos/phoben/aoy-erp/issues/191');
 const sources=[...issue.data.body.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
 for(const source of sources.slice(0,4)){
  const url=new URL(source);if(url.protocol!=='https:'||url.host!=='github.com'||!/^\/user-attachments\/assets\/[a-f0-9-]{36}$/i.test(url.pathname)||url.search||url.hash||url.username||url.password)throw new Error('附件不在固定范围');
  const r=await run('gh',['api','--hostname','github.com','--method','GET','--include','-H','Accept: application/octet-stream',url.href],{encoding:'buffer',windowsHide:true,shell:false,timeout:20000,maxBuffer:5*1024*1024});
  const end=r.stdout.indexOf(Buffer.from('\r\n\r\n')),header=r.stdout.subarray(0,end).toString('utf8'),body=r.stdout.subarray(end+4);
  report.images.push({status:Number(/^HTTP\/[\d.]+\s+(\d+)/.exec(header)?.[1]),mime:/\r\ncontent-type:\s*([^\r\n]+)/i.exec(header)?.[1]||null,bytes:body.length,png:body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),hash:createHash('sha256').update(body).digest('hex')});
 }
 report.passed=report.images.length===4&&report.images.every(i=>i.status===200&&i.png);
}catch(error){report.failure={code:error.code||'PROBE_FAILED'};report.passed=false;}
await writeFile(new URL('./image-auth-all-probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
