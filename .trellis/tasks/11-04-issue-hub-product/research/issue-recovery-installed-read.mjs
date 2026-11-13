import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { Client } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

// 从实际新缓存只读用户指定Issue，不发评论、不操作聊天、不打印正文。
const report={version:'0.3.1',repository:'phoben/aoy-erp',number:185,remoteWrites:false,chatOpened:false,failure:null};let client;
try{
  const filename=join(process.env.CODEX_HOME||join(homedir(),'.codex'),'plugins/cache/yg/yg-toolkit/0.3.1/dist/issue-hub.cjs');
  const transport=new StdioClientTransport({command:process.execPath,args:[filename],stderr:'pipe',env:{...process.env}});transport.stderr?.on('data',()=>{});
  client=new Client({name:'issue_recovery_installed_read',version:'1'});await client.connect(transport,{timeout:120000});assert.equal(client.getServerVersion().version,'0.3.1');
  const call=async(action,payload={})=>{const r=await client.callTool({name:'issue-hub-query',arguments:{action,payload}},undefined,{timeout:120000});if(r.isError)throw Object.assign(new Error(r.structuredContent.error.message),r.structuredContent.error);return r.structuredContent;};
  await call('bootstrap');const r=await call('read-summary',{repositoryKey:'09cb7093f29bd89a2b4c',number:185});
  assert.equal(r.offline,false);assert.equal(r.cached,false);assert.equal(r.data.issue.number,185);assert.ok(r.data.issue.body);
  report.bodyPresent=true;report.offline=r.offline;report.cached=r.cached;report.passed=true;
}catch(error){report.failure={code:error.code||'READ_FAILED',message:error.message};report.passed=false;process.exitCode=1;}
finally{await client?.close();await writeFile(new URL('./issue-recovery-installed-read.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
