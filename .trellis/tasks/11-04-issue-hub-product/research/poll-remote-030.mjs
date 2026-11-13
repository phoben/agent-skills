import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createGithubClient} from '../../../../packages/issue-hub/src/github/client.mjs';
const recordFlag=process.argv.indexOf('--record'),recordName=recordFlag>=0?process.argv[recordFlag+1]:'poll-remote-030.json';assert.match(recordName,/^[a-z0-9-]+\.json$/);
const file=new URL(`./${recordName}`,import.meta.url),state=JSON.parse(await readFile(new URL('./live-write-state-030.json',import.meta.url),'utf8')),github=createGithubClient();
assert.equal(state.repository,'phoben/agent-skills');assert.equal(state.issue.number,5);
const user=await github.identity();assert.equal(user.id,state.accountId);const {data}=await github.request('GET','/repos/phoben/agent-skills/issues/5');assert.equal(data.user.id,state.accountId);assert.ok(data.body.includes(`验收标识：issue-hub:${state.runId}`));
if(process.argv.includes('--restore')){const record=JSON.parse(await readFile(file,'utf8'));assert.equal(data.title,record.title);await github.request('PATCH','/repos/phoben/agent-skills/issues/5',{title:record.previousTitle});record.restored=true;record.restoredAt=Date.now();await writeFile(file,JSON.stringify(record,null,2)+'\n');console.log({issue:5,restored:true});}
else{try{await readFile(file);throw new Error('远端轮询记录已存在，不重复修改。');}catch(error){if(error.code!=='ENOENT')throw error;}const record={issue:5,previousTitle:data.title,title:`${data.title} · 远端同步验收`,requestedAt:Date.now()};await writeFile(file,JSON.stringify(record,null,2)+'\n');await github.request('PATCH','/repos/phoben/agent-skills/issues/5',{title:record.title});record.changedAt=Date.now();await writeFile(file,JSON.stringify(record,null,2)+'\n');console.log({issue:5,changedAt:record.changedAt});}
