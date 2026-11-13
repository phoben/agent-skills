import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { bodyMarkup } from '../../../../packages/issue-hub/ui/ui.mjs';
import { createGithubClient } from '../../../../packages/issue-hub/src/github/client.mjs';

// 只读指定Issue；只输出图片数量、匿名HEAD状态/类型/最终域，不保存正文或签名URL。
const report={repository:'phoben/aoy-erp',number:191,remoteWrites:false,chatOpened:false,images:[],failure:null};
try{
  const gh=createGithubClient(),repo=await gh.request('GET','/repos/phoben/aoy-erp');report.privateRepository=repo.data.private;
  const r=await gh.request('GET','/repos/phoben/aoy-erp/issues/191'),body=r.data.body;
  const sources=[...body.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);report.htmlImages=sources.length;
  const rendered=bodyMarkup(body);report.renderer={emitsImages:/<img\b/i.test(rendered),escapesImageTags:/&lt;img\b/i.test(rendered)};
  for(const value of sources.slice(0,4)){
    const url=new URL(value);if(url.protocol!=='https:'||url.hostname!=='github.com'||!url.pathname.startsWith('/user-attachments/assets/')||url.username||url.password)throw new Error('图片地址不在本探针范围');
    try{
      const raw=await promisify(execFile)('curl.exe',['--silent','--head','--location','--max-redirs','5','--max-time','15','--output','NUL','--write-out','%{http_code}\n%{content_type}\n%{url_effective}',url.href],{windowsHide:true,shell:false,encoding:'utf8',timeout:18000,maxBuffer:65536});
      const [status,type,finalUrl]=raw.stdout.trim().split(/\r?\n/);report.images.push({anonymous:true,status:Number(status),contentType:type,finalHost:new URL(finalUrl).hostname});
    }catch(error){report.images.push({anonymous:true,errorCode:error.code||'HEAD_FAILED'});}
  }
}catch(error){report.failure={code:error.code||'PROBE_FAILED',message:error.message};}
await writeFile(new URL('./image-preview-probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
