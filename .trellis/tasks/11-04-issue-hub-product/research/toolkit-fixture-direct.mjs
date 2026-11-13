import { readdir, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
const research='E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research';
const dirs=(await Promise.all((await readdir(research,{withFileTypes:true})).filter(e=>e.isDirectory()&&e.name.startsWith('toolkit-migration-fixture-')).map(async e=>({path:join(research,e.name),time:(await stat(join(research,e.name))).mtimeMs})))).sort((a,b)=>b.time-a.time);
const base=dirs[0].path, filename=join(base,'profile/plugins/cache/yg/yg-toolkit/0.3.0/dist/probe.cjs');
const client=new Client({name:'direct_fixture_probe',version:'1'});
const transport=new StdioClientTransport({command:process.execPath,args:[filename],stderr:'pipe'});let stderr='';transport.stderr?.on('data',x=>stderr+=String(x));
try{await client.connect(transport,{timeout:10000});console.log({directServer:client.getServerVersion(),tools:await client.listTools(),cachedMcp:JSON.parse(await readFile(join(base,'profile/plugins/cache/yg/yg-toolkit/0.3.0/mcp.json'),'utf8'))});}catch(error){console.log({error:error.message,stderr:stderr.slice(-2000).replaceAll(base,'<fixture>')});}finally{await client.close();}
