import assert from 'node:assert/strict';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {Client} from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StdioClientTransport} from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
const report={version:'0.3.4',realInstalledService:true,remoteWrites:false,chatOpened:false};let client;
try{
 const transport=new StdioClientTransport({command:process.execPath,args:[join(process.env.CODEX_HOME||join(homedir(),'.codex'),'plugins/cache/yg/yg-toolkit/0.3.4/dist/issue-hub.cjs')],stderr:'pipe',env:{...process.env}});transport.stderr?.on('data',()=>{});
 client=new Client({name:'discovery_policy_installed',version:'1'});await client.connect(transport,{timeout:120000});assert.equal(client.getServerVersion().version,'0.3.4');
 const r=await client.callTool({name:'issue-repositories',arguments:{}},undefined,{timeout:120000});assert.ok(!r.isError);const value=r.structuredContent;
 report.repositoryCount=value.data.repositories.length;report.internalWarnings=value.data.catalog.warnings;report.offline=value.offline;assert.equal(report.repositoryCount,12);assert.ok(!report.internalWarnings.includes('DIRECTORY_DEPTH_LIMIT'));report.passed=true;
}catch(error){report.passed=false;report.error={code:error.code||'VERIFY_FAILED',message:error.message};process.exitCode=1;}
finally{await client?.close();await writeFile(new URL('./discovery-policy-installed-live.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);}
