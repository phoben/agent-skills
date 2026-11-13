import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Client} from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StdioClientTransport} from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import {createGithubClient} from '../../../../packages/issue-hub/src/github/client.mjs';
import {LiveStore} from '../../../../packages/issue-hub/ui/store.mjs';

// 用户已授权phoben/agent-skills；只写本脚本新建的验收Issue与自有临时里程碑。
if(!process.argv.includes('--execute'))throw new Error('显式传入--execute运行已授权的真实验收');
const stateFile=new URL('./live-write-state-030.json',import.meta.url),reportFile=new URL('./live-write-report-030.json',import.meta.url);
try{await readFile(stateFile);throw new Error('验收状态已存在，请核对已有结果，不要重复新建。');}catch(error){if(error.code!=='ENOENT')throw error;}
const github=createGithubClient(),run=promisify(execFile),account=await github.identity();
const state={repository:'phoben/agent-skills',accountId:account.id,runId:randomUUID(),dataDirectory:await mkdtemp(join(tmpdir(),'issue-hub-live-write-')),issue:null,milestone:null,phase:'prepared',operations:[]};
const marker=`验收标识：issue-hub:${state.runId}`;
const report={repository:state.repository,runId:state.runId,realGithub:true,via:'LiveStore→MCP stdio→gh API',steps:[],cleanup:{},failure:null};
let client,store;
const persist=()=>writeFile(stateFile,JSON.stringify(state,null,2)+'\n');
async function step(name,callback){state.phase=name;await persist();await callback();report.steps.push({name,passed:true});await persist();console.log(JSON.stringify({step:name,passed:true,issue:state.issue?.number}));}
async function ownIssue(){const current=await github.identity();assert.equal(current.id,state.accountId);const response=await github.request('GET',`/repos/${state.repository}/issues/${state.issue.number}`);assert.equal(response.data.user.id,state.accountId);assert.ok(response.data.body.includes(marker));return response.data;}
async function envelope(group,action,payload={}){
  const response=await client.callTool({name:{query:'issue-hub-query',mutate:'issue-hub-mutate',task:'issue-hub-task'}[group],arguments:{action,payload}},undefined,{timeout:120000});
  if(response.isError)throw Object.assign(new Error(response.structuredContent?.error?.message||'MCP验收请求失败'),response.structuredContent?.error||{});
  if(group==='mutate'){state.operations.push({action,operationId:payload.operationId,status:response.structuredContent.data.operation?.status,replayed:response.structuredContent.data.replayed===true});await persist();}
  return response.structuredContent;
}
await persist();
try{
  const repository=await github.request('GET',`/repos/${state.repository}`);assert.equal(repository.data.full_name,state.repository);assert.ok(repository.data.permissions.push);
  const milestoneTitle=`Issue Hub 临时验收 ${state.runId.slice(0,8)}`;
  await step('准备临时里程碑',async()=>{state.milestoneRequested=milestoneTitle;await persist();const created=await github.request('POST',`/repos/${state.repository}/milestones`,{title:milestoneTitle,description:`仅供Issue Hub自动验收，完成后清理。${marker}`});assert.equal(created.data.creator.id,state.accountId);state.milestone={number:created.data.number,title:created.data.title};});
  const transport=new StdioClientTransport({command:process.execPath,args:[resolve('plugins/issue-hub/dist/issue-hub.cjs')],cwd:tmpdir(),stderr:'pipe',env:{...process.env,ISSUE_HUB_DATA_DIR:state.dataDirectory}});transport.stderr?.on('data',()=>{});
  client=new Client({name:'issue-hub-authorized-live-check',version:'1'});await client.connect(transport,{timeout:120000});report.serverVersion=client.getServerVersion()?.version;
  store=new LiveStore(envelope);await store.load();await store.refreshCatalog();
  const repo=store.data.repositories.find(item=>item.fullName===state.repository);assert.ok(repo);await store.loadRepository(state.repository);await store.loadOptions(state.repository);
  const createValues={title:`[Issue Hub 验收] 管理闭环 ${state.runId.slice(0,8)}`,body:`这是用户授权的Issue Hub真实功能验收记录。\n\n${marker}\n\n验证新增、编辑、属性、评论与状态同步，结束后关闭。`,labels:[],assignee:'',milestone:'',operationId:randomUUID()};state.createOperationId=createValues.operationId;
  await step('从前端Store新增Issue并独立读回',async()=>{const created=await store.saveIssue(state.repository,createValues);state.issue={number:created.number,url:created.url};await persist();const raw=await ownIssue();assert.equal(raw.title,createValues.title);assert.equal(raw.body,createValues.body);});
  await step('同一新增操作重试不重复创建',async()=>{const repeated=await store.saveIssue(state.repository,createValues);assert.equal(repeated.number,state.issue.number);assert.equal(state.operations.at(-1).replayed,true);});
  let editValues;
  await step('编辑标题正文与标签负责人里程碑',async()=>{const base=store.issue(state.repository,state.issue.number);editValues={...base,title:`[Issue Hub 验收] 编辑与属性已读回 ${state.runId.slice(0,8)}`,body:`这是Issue Hub已编辑的验收正文。\n\n${marker}\n\n本记录由已授权的自动验收创建，结束后关闭。`,labels:['bug','documentation'],assignee:account.login,milestone:state.milestone.title,_base:base,operationId:randomUUID()};state.editValues=editValues;await persist();await store.saveIssue(state.repository,editValues);const raw=await ownIssue();assert.equal(raw.title,editValues.title);assert.equal(raw.body,editValues.body);assert.deepEqual(raw.labels.map(x=>x.name).sort(),['bug','documentation']);assert.ok(raw.assignees.some(x=>x.id===state.accountId));assert.equal(raw.milestone.number,state.milestone.number);});
  await step('已确认编辑按旧基线重放恢复原回执',async()=>{await store.saveIssue(state.repository,editValues);assert.equal(state.operations.at(-1).replayed,true);});
  const originalComment=`Issue Hub验收评论：验证真实新增与读回。\n${marker}`;
  await step('新增本人评论并独立读回',async()=>{const issue=await store.saveComment(state.repository,state.issue.number,originalComment);const comment=issue.commentItems.find(x=>x.login===account.login&&x.text===originalComment);assert.ok(comment);state.commentId=comment.id;const raw=await github.request('GET',`/repos/${state.repository}/issues/comments/${comment.id}`);assert.equal(raw.data.body,originalComment);});
  const editedComment=`Issue Hub验收评论：已编辑，验证旧基线重试不重复发布。\n${marker}`;
  await step('编辑本人评论并验证同操作重放',async()=>{await store.saveComment(state.repository,state.issue.number,editedComment,state.commentId,originalComment);await store.saveComment(state.repository,state.issue.number,editedComment,state.commentId,originalComment);assert.equal(state.operations.at(-1).replayed,true);const raw=await github.request('GET',`/repos/${state.repository}/issues/comments/${state.commentId}`);assert.equal(raw.data.body,editedComment);});
  await step('关闭与重新打开',async()=>{await store.changeState(state.repository,state.issue.number);assert.equal((await ownIssue()).state,'closed');await store.changeState(state.repository,state.issue.number);assert.equal((await ownIssue()).state,'open');});
  await step('清除临时属性并独立核对',async()=>{const base=store.issue(state.repository,state.issue.number);await store.saveIssue(state.repository,{...base,labels:[],assignee:'',milestone:'',_base:base});const raw=await ownIssue();assert.equal(raw.labels.length,0);assert.equal(raw.assignees.length,0);assert.equal(raw.milestone,null);});
}catch(error){report.failure={phase:state.phase,code:error.code||'ASSERTION_FAILED',message:error.message};}
finally{
  if(state.issue&&store&&client){try{await ownIssue();const latest=await store.loadIssue(state.repository,state.issue.number,{summary:true});const value=store.issue(state.repository,state.issue.number);await envelope('mutate','change-state',{repositoryKey:store.repositoryKey(state.repository),number:state.issue.number,state:'closed',revision:value.revision,operationId:randomUUID(),expectedIdentity:String(store.identity)});assert.equal((await ownIssue()).state,'closed');report.cleanup.issueClosed=true;}catch(error){report.cleanup.issueCloseError=error.code||'CLEANUP_FAILED';}}
  if(state.milestone){try{const current=await github.identity();assert.equal(current.id,state.accountId);const value=await github.request('GET',`/repos/${state.repository}/milestones/${state.milestone.number}`);assert.equal(value.data.title,state.milestone.title);assert.equal(value.data.creator.id,state.accountId);await run('gh',['api','--hostname','github.com','--method','DELETE',`/repos/${state.repository}/milestones/${state.milestone.number}`],{shell:false,windowsHide:true,timeout:20000,maxBuffer:65536});report.cleanup.milestoneDeleted=true;}catch(error){report.cleanup.milestoneDeleteError=error.code||'CLEANUP_FAILED';}}
  await client?.close();report.issue=state.issue;state.phase=report.failure?'failed':'completed';await persist();await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(report.failure)process.exitCode=1;
}
