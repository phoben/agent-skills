import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {createRuntimeDiagnostics} from '../src/diagnostics.mjs';
import {temporary} from './helpers.mjs';
import {ProofError} from '../src/errors.mjs';

function dependencies(){
  const calls=[];
  return {calls,platform:'win32',nodeVersion:'24.19.0',run:async(command,args,options)=>{calls.push({command,args,options});return {stdout:command==='git'?'git version 2.56.0.windows.3':command==='gh'?'gh version 2.85.0 (2026-01-14)':'codex-cli 0.163.0'};},commandResolver:async()=>({command:'codex.exe',args:[]}),github:{identity:async()=>({login:'member',token:'SECRET_AUTH'})},bridge:{request:async(method,args)=>{calls.push({method,args});return {data:[{path:'PRIVATE_PATH'}]};},identity:async()=>'PRIVATE_IDENTITY'},catalog:{snapshot:()=>({status:'partial',repositories:[{fullName:'private/repo'}],warnings:['DIRECTORY_LIMIT']})}};
}

test('连接检查只探测版本/身份/项目接口，SQLite临时检查清理且不返回凭据路径',async t=>{
  const directory=await temporary(t),deps=dependencies();
  const result=await createRuntimeDiagnostics({...deps,directory}).diagnose();
  assert.equal(result.data.status,'ok');assert.equal(result.data.checks.length,9);
  assert.equal(result.data.discovery.repositories,1);assert.deepEqual(result.data.discovery.warnings,[]);
  assert.deepEqual(await readdir(directory),[]);
  assert.ok(deps.calls.filter(call=>call.command).every(call=>call.args.at(-1)==='--version'&&call.options.shell===false&&call.options.windowsHide===true));
  assert.deepEqual(deps.calls.filter(call=>call.method).map(call=>call.method),['project/list']);
  const text=JSON.stringify(result);for(const secret of ['SECRET_AUTH','PRIVATE_PATH','PRIVATE_IDENTITY','private/repo',directory])assert.ok(!text.includes(secret));
});

test('某项失败不隐藏其他结果，也不回显原始子进程和存储错误',async()=>{
  const deps=dependencies();deps.run=async(command,args,options)=>{if(command==='git')throw new Error('SECRET_STDERR');return {stdout:command==='gh'?'gh version 2.85.0':'codex-cli 0.163.0'};};
  deps.github.identity=async()=>{throw new ProofError('AUTH_REQUIRED','SECRET_TOKEN');};
  deps.bridge.request=async()=>{throw new ProofError('HOST_CONTEXT_CHANGED','SECRET_CONFIG_PATH');};
  const result=await createRuntimeDiagnostics({...deps,directory:'C:/private',probeStorage:async()=>{throw new Error('SECRET_DB_PATH');}}).diagnose();
  assert.equal(result.data.status,'error');
  assert.equal(result.data.checks.find(check=>check.id==='gh').status,'ok');
  assert.equal(result.data.checks.find(check=>check.id==='github').code,'AUTH_REQUIRED');
  assert.equal(result.data.checks.find(check=>check.id==='projects').status,'warning');
  assert.ok(!JSON.stringify(result).includes('SECRET_'));
});

test('断网与宿主会话受限显示部分可用，Node非24不执行SQLite检查',async()=>{
  const deps=dependencies();deps.github.identity=async()=>{throw new ProofError('NETWORK_UNAVAILABLE','连接不可用');};deps.bridge.identity=async()=>{throw new ProofError('HOST_IDENTITY_UNAVAILABLE','不可用');};
  const result=await createRuntimeDiagnostics({...deps,directory:'C:/private',probeStorage:async()=>{}}).diagnose();
  assert.equal(result.data.status,'warning');assert.equal(result.data.checks.find(check=>check.id==='github').status,'warning');
  let probed=false;const unsupported=await createRuntimeDiagnostics({...deps,nodeVersion:'22.1.0',directory:'C:/private',probeStorage:async()=>{probed=true;}}).diagnose();
  assert.equal(unsupported.data.status,'error');assert.equal(probed,false);
});

test('固定扫描边界、链接和缓存检查进度不产生连接警告',async()=>{
  const deps=dependencies();deps.catalog.snapshot=()=>({status:'partial',checking:true,repositories:[],warnings:['DIRECTORY_DEPTH_LIMIT','DIRECTORY_LIMIT','CATALOG_DEEP_SCAN_PENDING','DEEP_SCAN_PENDING','CATALOG_CACHE_CHECKING','LINK_SKIPPED','ROOT_NOT_REPOSITORY','PROJECT_PAGE_LIMIT']});
  const result=await createRuntimeDiagnostics({...deps,directory:'C:/private',probeStorage:async()=>{}}).diagnose();
  assert.deepEqual(result.data.discovery.warnings,[]);assert.equal(result.data.discovery.status,'partial');assert.equal(result.data.discovery.checking,true);assert.equal(result.data.status,'ok');
});

test('真实项目目录和Git故障保留安全说明，不回显未知代码和私有路径',async()=>{
  const deps=dependencies();deps.catalog.snapshot=()=>({status:'partial',repositories:[],warnings:['ROOT_MISSING','ROOT_ACCESS_FAILED','ROOT_INSPECTION_FAILED','GIT_READ_FAILED','GIT_UNAVAILABLE','WORKSPACE_INVALID','C:/PRIVATE/SECRET_PATH','UNKNOWN_PRIVATE_ERROR']});
  const result=await createRuntimeDiagnostics({...deps,directory:'C:/private',probeStorage:async()=>{}}).diagnose();
  assert.equal(result.data.discovery.warnings.length,6);assert.equal(result.data.status,'warning');assert.match(result.data.discovery.warnings.join(' '),/目录已不存在|目录无法访问|Git信息无法读取|无法运行Git/);
  assert.doesNotMatch(JSON.stringify(result),/SECRET_PATH|UNKNOWN_PRIVATE_ERROR/);
  deps.catalog.snapshot=()=>({status:'unavailable',warnings:['HOST_DISCOVERY_FAILED'],repositories:[]});
  const unavailable=await createRuntimeDiagnostics({...deps,directory:'C:/private',probeStorage:async()=>{}}).diagnose();
  assert.equal(unavailable.data.discovery.status,'unavailable');assert.equal(unavailable.data.status,'warning');assert.match(unavailable.data.discovery.warnings[0],/桌面项目读取失败/);
});

test('尚未扫描不是项目不可用，真实失败即使没有采样时间也保留错误',async()=>{
  const deps=dependencies();let snapshot={status:'unavailable',sampledAt:null,warnings:[],repositories:[]};deps.catalog.snapshot=()=>snapshot;
  const diagnostic=createRuntimeDiagnostics({...deps,directory:'C:/private',probeStorage:async()=>{}});
  const initial=await diagnostic.diagnose();assert.equal(initial.data.discovery.status,'not-scanned');assert.equal(initial.data.status,'ok');
  snapshot={...snapshot,error:{code:'HOST_DISCOVERY_FAILED'}};
  const failed=await diagnostic.diagnose();assert.equal(failed.data.discovery.status,'unavailable');assert.equal(failed.data.status,'warning');
  snapshot={...snapshot,error:undefined,warnings:['DISCOVERY_FAILED']};
  const warning=await diagnostic.diagnose();assert.equal(warning.data.discovery.status,'unavailable');assert.equal(warning.data.status,'warning');
  snapshot={...snapshot,status:'loading',warnings:[]};
  const loading=await diagnostic.diagnose();assert.equal(loading.data.discovery.status,'loading');assert.equal(loading.data.status,'ok');
});
