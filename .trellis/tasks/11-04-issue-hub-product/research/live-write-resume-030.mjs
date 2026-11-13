import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Client} from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StdioClientTransport} from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import {createGithubClient} from '../../../../packages/issue-hub/src/github/client.mjs';
import {LiveStore} from '../../../../packages/issue-hub/ui/store.mjs';

// 只复用已获授权且由上轮创建的Issue，不新增Issue或里程碑。
const state=JSON.parse(await readFile(new URL('./live-write-state-030.json',import.meta.url),'utf8'));
assert.equal(state.repository,'phoben/agent-skills');assert.equal(state.issue.number,5);
const github=createGithubClient(),marker=`验收标识：issue-hub:${state.runId}`;
const report={repository:state.repository,issue:state.issue,reusedExisting:true,steps:[],cleanup:{},failure:null};
let client,store;
async function own(){const user=await github.identity();assert.equal(user.id,state.accountId);const {data}=await github.request('GET',`/repos/${state.repository}/issues/${state.issue.number}`);assert.equal(data.user.id,state.accountId);assert.ok(data.body.includes(marker));return data;}
async function call(group,action,payload={}){const result=await client.callTool({name:{query:'issue-hub-query',mutate:'issue-hub-mutate'}[group],arguments:{action,payload}},undefined,{timeout:120000});if(result.isError)throw Object.assign(new Error(result.structuredContent?.error?.message||'请求失败'),result.structuredContent?.error||{});return result.structuredContent;}
async function step(name,work){await work();report.steps.push({name,passed:true});console.log(JSON.stringify({step:name,passed:true,issue:5}));}
try{
  await own();const transport=new StdioClientTransport({command:process.execPath,args:[resolve('plugins/issue-hub/dist/issue-hub.cjs')],cwd:tmpdir(),stderr:'pipe',env:{...process.env,ISSUE_HUB_DATA_DIR:state.dataDirectory}});transport.stderr?.on('data',()=>{});client=new Client({name:'issue-hub-owned-live-resume',version:'1'});await client.connect(transport,{timeout:120000});report.serverVersion=client.getServerVersion()?.version;
  store=new LiveStore(call);await store.load();await store.refreshCatalog();await store.loadRepository(state.repository);await store.loadIssue(state.repository,5);
  await step('已确认评论重放保留回执但使用最新Issue投影',async()=>{const original=`Issue Hub验收评论：验证真实新增与读回。\n${marker}`,edited=`Issue Hub验收评论：已编辑，验证旧基线重试不重复发布。\n${marker}`;const operation=state.operations.filter(x=>x.action==='save-comment').at(-1);assert.ok(operation?.operationId);const before=await github.request('GET',`/repos/${state.repository}/issues/5/comments?per_page=100`);const response=await call('mutate','save-comment',{repositoryKey:store.repositoryKey(state.repository),number:5,text:edited,commentId:state.commentId,expectedText:original,operationId:operation.operationId,expectedIdentity:String(store.identity)});assert.equal(response.data.replayed,true);assert.equal(response.data.projectionFresh,true);const raw=await own();assert.equal(response.data.issue.state,raw.state);assert.equal(response.data.issue.revision,raw.updated_at);assert.equal(response.data.issue.milestone,'');store.installIssue(state.repository,response.data.issue);const after=await github.request('GET',`/repos/${state.repository}/issues/5/comments?per_page=100`);assert.equal(after.data.length,before.data.length);});
  await step('从已关闭状态重新打开',async()=>{assert.equal(store.issue(state.repository,5).state,'closed');await store.changeState(state.repository,5);assert.equal((await own()).state,'open');});
  await step('远端评论更新时间变化不误报关闭冲突',async()=>{const old=store.issue(state.repository,5);const comment=await github.request('POST',`/repos/${state.repository}/issues/5/comments`,{body:`Issue Hub验收：模拟远端讨论变化，确认状态操作不覆盖正文。\n${marker}`});report.remoteCommentId=comment.data.id;const raw=await own();assert.equal(raw.state,'open');assert.equal(raw.body,old.body);await store.changeState(state.repository,5);const closed=await own();assert.equal(closed.state,'closed');assert.equal(closed.body,old.body);});
  await step('再次重开与清除临时属性',async()=>{await store.changeState(state.repository,5);assert.equal((await own()).state,'open');await store.loadIssue(state.repository,5);const base=store.issue(state.repository,5);await store.saveIssue(state.repository,{...base,labels:[],assignee:'',milestone:'',_base:base});const raw=await own();assert.equal(raw.labels.length,0);assert.equal(raw.assignees.length,0);assert.equal(raw.milestone,null);});
}catch(error){report.failure={code:error.code||'ASSERTION_FAILED',message:error.message};}
finally{
  if(store&&client){try{const raw=await own();await store.loadIssue(state.repository,5);let base=store.issue(state.repository,5);if(raw.labels.length||raw.assignees.length||raw.milestone){await store.saveIssue(state.repository,{...base,labels:[],assignee:'',milestone:'',_base:base},{force:true});}base=store.issue(state.repository,5);if((await own()).state!=='closed')await call('mutate','change-state',{repositoryKey:store.repositoryKey(state.repository),number:5,state:'closed',revision:base.revision,operationId:randomUUID(),expectedIdentity:String(store.identity)});const final=await own();assert.equal(final.state,'closed');assert.equal(final.labels.length,0);assert.equal(final.assignees.length,0);assert.equal(final.milestone,null);report.cleanup={issueClosed:true,attributesCleared:true,milestoneAlreadyDeleted:true};}catch(error){report.cleanup.error=error.code||'CLEANUP_FAILED';}}
  await client?.close();await writeFile(new URL('./live-write-resume-030.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);if(report.failure||report.cleanup.error)process.exitCode=1;
}
