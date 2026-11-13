import {readFile,writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {resolveCodexCommand} from '../../../../packages/issue-hub/src/host/bridge.mjs';

// 只使用新建的临时Codex配置目录，不注册到当前用户配置，不冒充第二台机器。
const [archiveArg,reportArg]=process.argv.slice(2);assert.ok(archiveArg&&reportArg);
const directory=await mkdtemp(join(tmpdir(),'issue-hub-review-check-')),bundle=join(directory,'bundle'),profile=join(directory,'profile');
const run=promisify(execFile),report={isolatedProfile:true,actualUserProfileModified:false,secondMachineVerified:false};
const env={...process.env,CODEX_HOME:profile,ISSUE_HUB_DATA_DIR:join(directory,'data')};
try{
  await mkdir(bundle);await mkdir(profile);
  await run('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:ISSUE_HUB_ARCHIVE,$env:ISSUE_HUB_EXTRACT)'],{windowsHide:true,shell:false,env:{...env,ISSUE_HUB_ARCHIVE:resolve(archiveArg),ISSUE_HUB_EXTRACT:bundle},timeout:30000});
  const manifest=JSON.parse(await readFile(join(bundle,'package-manifest.json'),'utf8'));report.version=manifest.version;
  await run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(bundle,'install.ps1'),'-CheckOnly'],{windowsHide:true,shell:false,cwd:bundle,env,timeout:120000,maxBuffer:1048576});report.checkOnlyPassed=true;
  await run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(bundle,'install.ps1')],{windowsHide:true,shell:false,cwd:bundle,env,timeout:120000,maxBuffer:1048576});
  const target=await resolveCodexCommand();const result=await run(target.command,[...target.args,'plugin','list','--marketplace','issue-hub-review','--json'],{windowsHide:true,shell:false,env,timeout:60000,maxBuffer:1048576});
  const inventory=JSON.parse(result.stdout),entry=inventory.installed.find(item=>item.pluginId==='issue-hub@issue-hub-review');assert.equal(entry.version,manifest.version);report.installed=true;report.pluginId=entry.pluginId;
  report.failure=null;
}catch(error){report.failure={code:error.code||'BUNDLE_CHECK_FAILED',message:'Windows验收包的隔离配置检查未完成。'};console.log({diagnosticCode:error.code,stdout:String(error.stdout||'').slice(-1300),stderr:String(error.stderr||'').slice(-500)});process.exitCode=1;}
finally{const actual=resolve(directory);if(actual.startsWith(`${resolve(tmpdir())}${sep}issue-hub-review-check-`)){try{await rm(actual,{recursive:true,force:true});report.cleaned=true;}catch{report.cleanupPending=true;}}await writeFile(resolve(reportArg),JSON.stringify(report,null,2)+'\n');console.log(report);}
