import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// 仅请求用户指定附件；原始响应/授权/签名URL均不写入文件或日志。
const asset='3f2f2b5b-d670-4f00-92cd-79bc06f2a2c7';
const run=promisify(execFile),report={readOnly:true,secretPrinted:false,attempts:[]};
function summarize(buffer){
  let offset=0,status=null,type=null;
  for(let count=0;count<6;count++){
    if(buffer.subarray(offset,offset+5).toString()!=='HTTP/')break;
    const end=buffer.indexOf(Buffer.from('\r\n\r\n'),offset);if(end<0)break;
    const header=buffer.subarray(offset,end).toString('utf8');status=Number(/^HTTP\/[\d.]+\s+(\d+)/.exec(header)?.[1]);
    type=/\r\ncontent-type:\s*([^\r\n]+)/i.exec(header)?.[1]||null;offset=end+4;
  }
  const body=buffer.subarray(offset);
  return{status,contentType:type,bytes:body.length,png:body.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg:body[0]===255&&body[1]===216,hash:body.length?createHash('sha256').update(body).digest('hex'):null};
}
for(const [name,endpoint,accept]of[
 ['github-original',`https://github.com/user-attachments/assets/${asset}`,'application/octet-stream'],
 ['api-user-attachments',`/user-attachments/assets/${asset}`,'application/octet-stream'],
 ['api-original-raw',`https://github.com/user-attachments/assets/${asset}`,'image/*'],
]){
 const started=Date.now();
 try{const r=await run('gh',['api','--hostname','github.com','--method','GET','--include','-H',`Accept: ${accept}`,endpoint],{encoding:'buffer',windowsHide:true,shell:false,timeout:20000,maxBuffer:8*1024*1024});report.attempts.push({name,ok:true,elapsedMs:Date.now()-started,...summarize(r.stdout)});}
 catch(error){report.attempts.push({name,ok:false,elapsedMs:Date.now()-started,exitCode:error.code,...summarize(Buffer.isBuffer(error.stdout)?error.stdout:Buffer.from(error.stdout||''))});}
}
await writeFile(new URL('./image-auth-probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
