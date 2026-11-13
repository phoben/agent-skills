import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
const run=promisify(execFile);
for(const path of ['api/http_client.go','go.mod']){
 try{
  const result=await run('gh',['api',`repos/cli/cli/contents/${path}?ref=v2.85.0`],{windowsHide:true,shell:false,encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024});
  const text=Buffer.from(JSON.parse(result.stdout).content,'base64').toString('utf8');
  await writeFile(new URL(`./gh-2.85-${path.replaceAll('/','-')}.txt`,import.meta.url),text);
  const lines=text.split('\n');console.log({path,matched:lines.map((line,index)=>({line:index+1,text:line})).filter(x=>/AuthToken|Redirect|go-gh\/v2|Host|Authorization/.test(x.text))});
 }catch(error){console.log({path,code:error.code||'SOURCE_UNAVAILABLE'});}
}
