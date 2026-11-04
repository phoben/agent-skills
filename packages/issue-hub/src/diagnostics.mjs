import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,rm} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {resolveCodexCommand} from './host/bridge.mjs';

const exec=promisify(execFile);
const coverageMessages={DIRECTORY_DEPTH_LIMIT:'子目录扫描达到深度上限',DIRECTORY_LIMIT:'子目录扫描达到数量上限',DEEP_SCAN_PENDING:'完整子目录扫描尚未完成',CATALOG_DEEP_SCAN_PENDING:'完整子目录扫描尚未完成',ROOT_INSPECTION_FAILED:'部分项目目录无法读取',ROOT_MISSING:'部分工作区目录已不存在',ROOT_ACCESS_FAILED:'部分目录无法访问',GIT_READ_FAILED:'部分仓库的Git信息无法读取',CATALOG_CACHE_CHECKING:'当前显示项目缓存，正在核对'};
const item=(id,label,status,message,extra={})=>({id,label,status,message,...extra});
const networkErrors=new Set(['NETWORK_UNAVAILABLE','RATE_LIMITED','HOST_TIMEOUT','HOST_UNAVAILABLE','HOST_CLOSED','HOST_CONTEXT_CHANGED']);

// 仅创建和清理本检查自己的临时数据库，不读写业务表或输出本机私有路径。
async function storageCheck(directory){
  if(typeof directory!=='string'||!isAbsolute(directory))throw new Error('STORAGE_PATH');
  await mkdir(directory,{recursive:true});
  const filename=join(directory,`.issue-hub-check-${randomUUID()}.sqlite`);
  let database;
  try{
    const {DatabaseSync}=await import('node:sqlite');database=new DatabaseSync(filename);
    database.exec('CREATE TABLE probe(value INTEGER NOT NULL); INSERT INTO probe VALUES(1)');
    if(database.prepare('SELECT value FROM probe').get().value!==1)throw new Error('STORAGE_READBACK');
  }finally{
    database?.close();
    for(const path of [filename,`${filename}-wal`,`${filename}-shm`])await rm(path,{force:true});
  }
}

export function createRuntimeDiagnostics({bridge,github,catalog,directory,run=exec,commandResolver=resolveCodexCommand,probeStorage=storageCheck,nodeVersion=process.versions.node,platform=process.platform,now=()=>new Date().toISOString()}={}){
  async function version(id,label,command,args,pattern){
    try{
      const result=await run(command,[...args,'--version'],{shell:false,windowsHide:true,timeout:8000,maxBuffer:65536});
      const found=String(result.stdout||'').match(pattern)?.[1];
      return item(id,label,found?'ok':'warning',found?'已找到可用程序。':'程序可运行，但未识别到版本。',found?{version:found}:{});
    }catch{return item(id,label,'error',`无法运行${label}。`,{action:`安装${label}并确认可从命令行运行。`});}
  }
  async function diagnose(){
    const major=Number(String(nodeVersion).replace(/^v/,'').split('.')[0]);
    const checks=[item('platform','Windows',platform==='win32'?'ok':'warning',platform==='win32'?'当前为Windows首发平台。':'此平台尚未完成安装兼容验收。'),item('node','Node.js',major===24?'ok':'error',major===24?'Node 24可用。':'当前插件需要Node 24。',{version:String(nodeVersion),...(major===24?{}:{action:'安装Node 24后重新打开插件。'})})];
    const jobs=[
      version('git','Git','git',[],/^git version ([0-9A-Za-z.+-]+)/m),
      version('gh','GitHub CLI','gh',[],/^gh version ([0-9A-Za-z.+-]+)/m),
      (async()=>{try{const target=await commandResolver();return await version('codex','Codex',target.command,target.args||[],/^codex-cli ([0-9A-Za-z.+-]+)/m);}catch{return item('codex','Codex','error','未找到当前配置可用的Codex程序。',{action:'检查Codex安装或显式程序路径配置。'});}})(),
      (async()=>{try{const account=await github.identity();return item('github','GitHub登录','ok',`当前登录：${account.login}。`);}catch(error){return item('github','GitHub登录',networkErrors.has(error.code)?'warning':'error',networkErrors.has(error.code)?'暂时无法在线核对GitHub登录。':'尚未取得可用的GitHub登录。',{code:error.code||'AUTH_REQUIRED',action:networkErrors.has(error.code)?'检查网络后重试；不会自动发布草稿。':'运行 gh auth login --hostname github.com 后重试。'});}})(),
      (async()=>{try{const value=await bridge.request('project/list',{limit:1,sortKey:'position'});if(!Array.isArray(value?.data))throw new Error('HOST_PROTOCOL');return item('projects','桌面项目接口','ok','项目读取接口可用。');}catch(error){return item('projects','桌面项目接口','warning','当前无法核对桌面项目接口。',{code:error.code||'HOST_PROTOCOL',action:'重试连接检查；若接口不受支持，请升级Codex。'});}})(),
      (async()=>{try{const identity=await bridge.identity();if(!identity)throw new Error('HOST_IDENTITY_UNAVAILABLE');return item('chat','会话身份','ok','可核对当前Codex会话身份。');}catch(error){return item('chat','会话身份','warning','暂时无法确认会话身份，任务关联可能受限。',{code:error.code||'HOST_IDENTITY_UNAVAILABLE',action:'检查Codex登录后重试；Issue内容不会因此清空。'});}})(),
      (async()=>{if(major!==24)return item('storage','本机存储','warning','更新Node后再核对SQLite存储。');try{await probeStorage(directory);return item('storage','本机存储','ok','SQLite创建与读回检查通过。');}catch{return item('storage','本机存储','error','无法在插件数据目录完成SQLite读写。',{action:'检查当前用户数据目录的写权限。'});}})(),
    ];
    const settled=await Promise.allSettled(jobs);
    checks.push(...settled.map(result=>result.status==='fulfilled'?result.value:item('unknown','连接检查','error','部分检查没有完成，请重试。')));
    const snapshot=catalog?.snapshot?.()||{};
    const discovery={status:!snapshot.sampledAt&&!snapshot.warnings?.length?'not-scanned':snapshot.status||'unavailable',checking:Boolean(snapshot.checking),repositories:Array.isArray(snapshot.repositories)?snapshot.repositories.length:0,warnings:(snapshot.warnings||[]).filter(code=>typeof code==='string').map(code=>coverageMessages[code]||'部分项目尚未完成核对。')};
    return {schemaVersion:1,data:{status:checks.some(check=>check.status==='error')?'error':checks.some(check=>check.status==='warning')?'warning':'ok',checks,discovery,sampledAt:now()}};
  }
  return {diagnose};
}
