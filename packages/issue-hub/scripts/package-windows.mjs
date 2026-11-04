import {readFile,writeFile,mkdir,copyFile,mkdtemp,rm,lstat} from 'node:fs/promises';
import {dirname,join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';

// 产物为可转交的Windows验收包，不推送、不发布，也不修改当前用户插件配置。
const packageRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),pluginRoot=resolve(packageRoot,'../../plugins/issue-hub');
const outputArg=process.argv.indexOf('--out');if(outputArg<0||!process.argv[outputArg+1])throw new Error('请用--out明确指定验收包输出目录');
if(process.platform!=='win32')throw new Error('此打包入口需要Windows内置压缩支持');
const outputRoot=resolve(process.argv[outputArg+1]);await mkdir(outputRoot,{recursive:true});
const manifest=JSON.parse(await readFile(join(pluginRoot,'plugin.json'),'utf8')),compat=JSON.parse(await readFile(join(pluginRoot,'.codex-plugin/plugin.json'),'utf8'));
assert.equal(manifest.name,'issue-hub');assert.match(manifest.version,/^\d+\.\d+\.\d+$/);assert.equal(compat.version,manifest.version);
const paths=['plugin.json','.codex-plugin/plugin.json','mcp.json','LICENSE','assets/icon.svg','dist/issue-hub.cjs','dist/app.html','dist/THIRD-PARTY-LICENSES.txt'];
const stage=await mkdtemp(join(tmpdir(),'issue-hub-windows-')),entries=[];
const run=promisify(execFile),sha=data=>createHash('sha256').update(data).digest('hex');
try{
  for(const path of paths){const input=join(pluginRoot,path),target=join(stage,'plugins/issue-hub',path),stat=await lstat(input);assert.ok(stat.isFile()&&!stat.isSymbolicLink());await mkdir(dirname(target),{recursive:true});await copyFile(input,target);entries.push({path:`plugins/issue-hub/${path}`,sha256:sha(await readFile(input))});}
  assert.ok((await readFile(join(stage,'plugins/issue-hub/dist/issue-hub.cjs'),'utf8')).startsWith(`// Issue Hub 版本: ${manifest.version}\n`));
  assert.ok((await readFile(join(stage,'plugins/issue-hub/dist/app.html'),'utf8')).startsWith(`<!-- Issue Hub 版本: ${manifest.version} -->`));
  await mkdir(join(stage,'.agents/plugins'),{recursive:true});
  await writeFile(join(stage,'.agents/plugins/marketplace.json'),JSON.stringify({name:'issue-hub-review',interface:{displayName:'Issue Hub Review'},plugins:[{name:'issue-hub',source:{source:'local',path:'./plugins/issue-hub'},policy:{installation:'AVAILABLE',authentication:'ON_INSTALL'},category:'Productivity'}]},null,2)+'\n');
  const installer=await readFile(join(packageRoot,'scripts/install-windows-review.ps1'),'utf8');await writeFile(join(stage,'install.ps1'),'\uFEFF'+installer.replace(/^\uFEFF/,''));
  await writeFile(join(stage,'package-manifest.json'),JSON.stringify({name:'issue-hub',version:manifest.version,marketplace:'issue-hub-review',files:entries},null,2)+'\n');
  await writeFile(join(stage,'README.md'),`# Issue Hub ${manifest.version} Windows验收包\n\n这是本地可转交验收包，尚未正式发布到yg源。预先安装Node 24、Git、gh、Codex，并完成各自gh登录。\n\n先解压到稳定目录；不要在压缩包内直接运行。仅检查环境：\n\n\`\`\`powershell\npowershell -NoProfile -ExecutionPolicy Bypass -File .\\install.ps1 -CheckOnly\n\`\`\`\n\n在尚未安装正式Issue Hub的验收电脑安装：\n\n\`\`\`powershell\npowershell -NoProfile -ExecutionPolicy Bypass -File .\\install.ps1\n\`\`\`\n\n脚本校验文件和依赖，只注册issue-hub-review临时源，不替换已有yg源。已有正式Issue Hub时拒绝并装；正式分发仍沿用yg，验收版与正式版不要同时启用。解压目录是本地源，安装后保留。\n\n插件主入口只有一个。核对仓库列表、真实正文/评论、草稿恢复；在授权仓库核对写后读回；创建任务应在正确工作区预填但未发送，原草稿保留，手动发送后可核对关联并返回。迁移身份仅兼容可证明的旧scope，不按名称猜认其他会话。\n\n命令行诊断：\`node plugins/issue-hub/dist/issue-hub.cjs --doctor\`。诊断不发布GitHub内容或发送聊天。包外协议、隔离Codex配置目录不能代替第二台真实Windows验收。\n\n卸载验收入口：\`codex plugin remove issue-hub@issue-hub-review\`，随后可按团队正式发布说明使用yg源；本机未发布草稿不随卸载自动删除。\n`);
  const archive=join(outputRoot,`issue-hub-${manifest.version}-windows-${Date.now()}.zip`);
  await run('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:ISSUE_HUB_STAGE,$env:ISSUE_HUB_ARCHIVE)'],{windowsHide:true,shell:false,env:{...process.env,ISSUE_HUB_STAGE:stage,ISSUE_HUB_ARCHIVE:archive},maxBuffer:1048576});
  const checked=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead($env:ISSUE_HUB_ARCHIVE); try { @($z.Entries | ForEach-Object { $_.FullName.Replace("\\","/") }) | ConvertTo-Json -Compress } finally { $z.Dispose() }'],{windowsHide:true,shell:false,env:{...process.env,ISSUE_HUB_ARCHIVE:archive},maxBuffer:1048576});
  const included=JSON.parse(checked.stdout).map(path=>path.replaceAll('\\','/'));for(const path of [...entries.map(entry=>entry.path),'.agents/plugins/marketplace.json','install.ps1','package-manifest.json','README.md'])assert.ok(included.includes(path),`压缩包缺少${path}`);
  const result={version:manifest.version,archive,sha256:sha(await readFile(archive)),files:included.length,originalMarketplaceModified:false,secondMachineVerified:false};await writeFile(join(outputRoot,`package-${manifest.version}.json`),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{const actual=resolve(stage);if(actual.startsWith(`${resolve(tmpdir())}${sep}issue-hub-windows-`))await rm(actual,{recursive:true,force:true});}
