import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {writeFile} from 'node:fs/promises';
import {resolveCodexCommand} from '../../../../packages/issue-hub/src/host/bridge.mjs';
const target=await resolveCodexCommand(),child=spawn(target.command,[...target.args,'app-server','--stdio'],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
child.stderr.on('data',()=>{});const pending=new Map();let serial=0;const lines=createInterface({input:child.stdout});
lines.on('line',line=>{let value;try{value=JSON.parse(line);}catch{return;}const call=pending.get(value.id);if(!call)return;pending.delete(value.id);clearTimeout(call.timer);call.resolve(value);});
const request=(method,params)=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(new Error('读取超时'));},20000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,method,params})+'\n');});
const report={readOnly:true};
try{await request('initialize',{clientInfo:{name:'issue_hub_identity_probe',version:'1'},capabilities:{experimentalApi:true}});child.stdin.write(JSON.stringify({method:'initialized'})+'\n');for(const method of ['account/read','account/rateLimits/read']){const value=await request(method,{});report[method]=value.error?{errorCode:value.error.code,errorMessage:String(value.error.message).replace(/sk-[A-Za-z0-9_-]+/g,'<REDACTED>').slice(0,300)}:{keys:Object.keys(value.result||{}),accountType:value.result?.account?.type,accountKeys:Object.keys(value.result?.account||{}),accountIdPresent:typeof value.result?.accountId==='string',requiresOpenaiAuth:value.result?.requiresOpenaiAuth};}}finally{lines.close();child.stdin.end();for(const value of pending.values())clearTimeout(value.timer);pending.clear();await writeFile(new URL('./account-probe-030.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);}
