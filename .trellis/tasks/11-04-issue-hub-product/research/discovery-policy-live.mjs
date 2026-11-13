import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]),label=process.argv[3];
if(!['before','after'].includes(label))throw new Error('核对阶段无效');
const {createHostBridge}=await import(pathToFileURL(resolve(root,'packages/issue-hub/src/host/bridge.mjs')).href);
const {createCatalog}=await import(pathToFileURL(resolve(root,'packages/issue-hub/src/catalog.mjs')).href);
const bridge=createHostBridge(),started=performance.now(),report={realHost:true,githubWrites:false,chatOpened:false,label};
try{
  const catalog=createCatalog({bridge}),result=await catalog.refresh();
  Object.assign(report,{projects:result.projects,roots:result.roots,repositories:result.repositories.length,workspaces:result.repositories.reduce((n,r)=>n+r.workspaces.length,0),repoNames:result.repositories.map(r=>r.fullName).sort(),internalStatus:result.status,warnings:result.warnings,durationMs:Math.round(performance.now()-started),passed:result.repositories.length>0});
}catch(error){report.passed=false;report.error={code:error.code||'DISCOVERY_FAILED',message:'本机只读核对未完成'};process.exitCode=1;}
finally{await bridge.close();await writeFile(`E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/discovery-policy-live-${label}.json`,JSON.stringify(report,null,2)+'\n');const {repoNames,...summary}=report;console.log(summary);}
