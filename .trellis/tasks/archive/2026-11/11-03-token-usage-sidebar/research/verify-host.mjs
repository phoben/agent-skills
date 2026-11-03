import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {join} from 'node:path';
import {findCodexCommand} from '../../../../packages/token-usage/src/codex-bridge.mjs';
const command=await findCodexCommand();
const child=spawn(command.command,[...command.args,'app-server','--stdio'],{windowsHide:true,stdio:['pipe','pipe','ignore']});
const requests=new Map();let next=0;
const lines=createInterface({input:child.stdout});
lines.on('line',line=>{let data;try{data=JSON.parse(line);}catch{return;}const waiter=requests.get(data.id);if(waiter){clearTimeout(waiter.timer);requests.delete(data.id);data.error?waiter.reject(new Error(`宿主请求失败 ${data.error.code}: ${String(data.error.message).slice(0,200)}`)):waiter.resolve(data.result);}});
function call(method,params){return new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{requests.delete(id);reject(new Error('宿主请求超时'));},25000);requests.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,method,...(params?{params}:{})})+'\n');});}
try{
 await call('initialize',{clientInfo:{name:'yg_usage_host_verification',version:'1.0.0'},capabilities:{experimentalApi:true}});child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
 const plugin=await call('plugin/read',{marketplacePath:join(process.cwd(),'.agents/plugins/marketplace.json'),pluginName:'yg-toolkit'});
 const display=plugin.plugin?.summary?.interface;
 console.log('插件宿主元数据',JSON.stringify({name:plugin.plugin?.summary?.name,mcpServers:plugin.plugin?.mcpServers,skillCount:plugin.plugin?.skills?.length,composerIcon:!!display?.composerIcon,logoDark:!!display?.logoDark}));
 const status=await call('mcpServerStatus/list',{serverName:plugin.plugin?.mcpServers?.[0]||'yg-token-usage',detail:'full',limit:10});
 const found=status.data?.[0];
 console.log('指定MCP发现',JSON.stringify({name:found?.name,pluginId:found?.pluginId,serverInfo:found?.serverInfo,toolsError:found?.toolsError,tools:Object.keys(found?.tools||{}),global:found?.tools?.token_usage_open?._meta?.['openai/ui'],resources:found?.resources?.map(item=>({uri:item.uri,mimeType:item.mimeType}))}));
 const resource=await call('mcpServer/resource/read',{server:found?.name||'yg-token-usage',uri:'ui://yg-toolkit/token-usage.html'});
 const content=resource.contents?.[0];
 console.log('宿主页面读取',JSON.stringify({keys:Object.keys(resource),mimeType:content?.mimeType,characters:content?.text?.length}));
}finally{child.stdin.end();const timer=setTimeout(()=>child.kill(),2000);timer.unref();child.once('exit',()=>clearTimeout(timer));}
