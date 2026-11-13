import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Client } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

// 两次独立MCP进程复用同一临时数据目录，分别测首次/再次进入；禁止远端写入与聊天。
const [bundleArg, outputArg] = process.argv.slice(2);
if (!bundleArg || !outputArg) throw new Error('需要分发入口与报告路径');
const directory=await mkdtemp(join(tmpdir(),'issue-hub-timing-'));
const result={checkedAt:new Date().toISOString(),realNetwork:true,remoteWrites:false,chatOpened:false,runs:[]};
const milliseconds=started=>Math.round((performance.now()-started)*10)/10;
try {
  for(const label of ['cold','warm']) {
    const record={label},origin=performance.now();
    const transport=new StdioClientTransport({command:process.execPath,args:[resolve(bundleArg)],cwd:tmpdir(),env:{...process.env,ISSUE_HUB_DATA_DIR:directory},stderr:'pipe'});
    transport.stderr?.on('data',()=>{});
    const client=new Client({name:'issue-hub-entry-timing',version:'1'});
    try {
      await client.connect(transport,{timeout:120000}); record.connectMs=milliseconds(origin); record.version=client.getServerVersion()?.version;
      const {tools}=await client.listTools();
      const actions=tools.find(tool=>tool.name==='issue-hub-query')?.inputSchema?.properties?.action?.enum || [];
      const mutations=tools.find(tool=>tool.name==='issue-hub-mutate')?.inputSchema?.properties?.action?.enum || [];
      const query=async(action,payload={})=>{
        const response=await client.callTool({name:'issue-hub-query',arguments:{action,payload}},undefined,{timeout:120000});
        if(response.isError)throw Object.assign(new Error('读取失败'),{code:response.structuredContent?.error?.code||'READ_FAILED'});
        return response.structuredContent;
      };
      let started=performance.now(),bootstrap=await query('bootstrap');record.bootstrapMs=milliseconds(started);record.bootstrapFromStartMs=milliseconds(origin);
      record.repositoryCount=bootstrap.data.repositories?.length||0;record.checking=Boolean(bootstrap.checking||bootstrap.data.checking);record.cached=bootstrap.cached===true;
      // 缓存首页字段由正式服务定义；保留仅计数，不把空loading当实际可用列表。
      record.cachedListCount=bootstrap.data.initial?.issues?.length??bootstrap.data.cachedList?.issues?.length??null;
      if(!record.repositoryCount) {
        started=performance.now();bootstrap=await query('refresh');record.directoryRefreshMs=milliseconds(started);
      }
      const repository=bootstrap.data.repositories.find(repo=>repo.fullName.toLowerCase()==='phoben/agent-skills' && repo.access!=='unavailable') || bootstrap.data.repositories.find(repo=>repo.access!=='unavailable');
      if(!repository)throw Object.assign(new Error('没有可读取仓库'),{code:'NO_REPOSITORY'});
      const fast=actions.includes('read-summary');
      started=performance.now();const list=await query('list',{repositoryKey:repository.key,state:'all',...(fast?{cacheFirst:true}:{})});record.listMs=milliseconds(started);record.firstListFromStartMs=milliseconds(origin);record.issues=list.data.issues.length;record.listCached=list.cached===true;
      if(list.data.issues[0]) {
        const action=actions.includes('read-summary')?'read-summary':'read';
        started=performance.now();const detail=await query(action,{repositoryKey:repository.key,number:list.data.issues[0].number,...(fast?{cacheFirst:true}:{})});
        record.detailAction=action;record.detailMs=milliseconds(started);record.firstBodyFromStartMs=milliseconds(origin);record.bodyBytes=Buffer.byteLength(detail.data.issue.body||'');
      }
      if(mutations.includes('view-state-save')) {
        const saved=await client.callTool({name:'issue-hub-mutate',arguments:{action:'view-state-save',payload:{expectedIdentity:String(list.identity),value:{repositoryKey:repository.key}}}},undefined,{timeout:120000});
        record.localViewStateSaved=!saved.isError;
      }
      if(bootstrap.data.refreshNeeded && record.repositoryCount) { started=performance.now();await query('refresh');record.afterDisplayRefreshMs=milliseconds(started); }
    }catch(error){record.error=error.code||'BENCHMARK_FAILED';}
    finally{await client.close();result.runs.push(record);console.log(JSON.stringify(record));}
  }
}finally{
  await writeFile(resolve(outputArg),JSON.stringify(result,null,2)+'\n');
  if(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}issue-hub-timing-`))await rm(directory,{recursive:true,force:true});
}
