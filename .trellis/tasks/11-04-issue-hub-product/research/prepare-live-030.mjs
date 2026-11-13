import {writeFile} from 'node:fs/promises';
import {createGithubClient} from '../../../../packages/issue-hub/src/github/client.mjs';
const github=createGithubClient();
const account=await github.identity();
const [repo,labels,milestones,assignees]=await Promise.all([
  github.request('GET','/repos/phoben/agent-skills'),github.request('GET','/repos/phoben/agent-skills/labels?per_page=100'),github.request('GET','/repos/phoben/agent-skills/milestones?state=all&per_page=100'),github.request('GET','/repos/phoben/agent-skills/assignees?per_page=100'),
]);
const result={repository:repo.data.full_name,account:account.login,canManage:Boolean(repo.data.permissions?.push),labels:labels.data.map(item=>item.name),milestones:milestones.data.map(item=>({number:item.number,title:item.title,state:item.state})),selfAssignable:assignees.data.some(item=>item.login===account.login),remoteWrites:false};
await writeFile(new URL('./live-fixtures-030.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
