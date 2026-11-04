import { readFile, writeFile, mkdir, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { collectPluginFiles, validateToolkitBundle } from './install-toolkit.mjs';

// 保留原package:windows命令，实际交付整个YG工具箱及便携安装助手。
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(packageRoot, '../..');
const run = promisify(execFile), sha = value => createHash('sha256').update(value).digest('hex');

export async function packageToolkit({ outputRoot, pluginRoot = join(repository, 'plugins/yg-toolkit') }) {
  if (process.platform !== 'win32') throw new Error('此入口需要Windows内置压缩支持。');
  // 技能不是本轮构建输出；脏或未跟踪技能会将其他任务混进安装包，必须先拒绝。
  const changedSkills = await run('git', ['-C', repository, 'status', '--porcelain', '--untracked-files=all', '--', 'plugins/yg-toolkit/skills'], { windowsHide: true, shell: false, maxBuffer: 1048576 });
  if (changedSkills.stdout.trim()) throw new Error('YG技能目录存在未提交改动，请从干净工作区打包。');
  const files = await collectPluginFiles(pluginRoot);
  const primary = JSON.parse(await readFile(join(pluginRoot, 'plugin.json'), 'utf8'));
  const stage = await mkdtemp(join(tmpdir(), 'yg-toolkit-windows-')), entries = [];
  try {
    for (const path of files) {
      const input = join(pluginRoot, path), target = join(stage, 'plugins/yg-toolkit', path);
      await mkdir(dirname(target), { recursive: true }); await copyFile(input, target);
      entries.push({ path: `plugins/yg-toolkit/${path}`, sha256: sha(await readFile(input)) });
    }
    const version = primary.version;
    for (const [name, marker] of [['token-usage.cjs', 'YG Toolkit'], ['token-usage.html', 'YG Toolkit'], ['issue-hub.cjs', 'Issue Hub'], ['issue-hub.html', 'Issue Hub']]) {
      const first = (await readFile(join(pluginRoot, 'dist', name), 'utf8')).split(/\r?\n/, 1)[0];
      const expected = name.endsWith('.cjs') ? `// ${marker} 版本: ${version}` : `<!-- ${marker} 版本: ${version} -->`;
      if (first !== expected) throw new Error('两个服务与页面必须共享当前YG构建版本。');
    }
    await mkdir(join(stage, '.agents/plugins'), { recursive: true });
    await writeFile(join(stage, '.agents/plugins/marketplace.json'), JSON.stringify({ name: 'yg', interface: { displayName: 'YG Toolkit Transfer' }, plugins: [{ name: 'yg-toolkit', source: { source: 'local', path: './plugins/yg-toolkit' }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' }] }, null, 2) + '\n');
    await writeFile(join(stage, 'package-manifest.json'), JSON.stringify({ name: 'yg-toolkit', version, marketplace: 'yg', files: entries }, null, 2) + '\n');
    const installer = await readFile(join(packageRoot, 'scripts/install-windows-review.ps1'), 'utf8');
    await writeFile(join(stage, 'install.ps1'), '\uFEFF' + installer.replace(/^\uFEFF/, ''));
    await build({ absWorkingDir: packageRoot, entryPoints: ['scripts/install-toolkit.mjs'], platform: 'node', target: 'node24', format: 'cjs', bundle: true, outfile: join(stage, 'install-toolkit.cjs'), minify: true, charset: 'utf8' });
    await writeFile(join(stage, 'README.md'), `# YG Toolkit ${version} Windows交接包\n\n一个YG安装包含原有工程技能、Tokens与Issue Hub两个页面。准备Windows、Node 24、Git和Codex；gh缺失只限制Issue管理，可在安装后单独准备并登录。\n\n保持解压目录稳定；先运行 \`powershell -ExecutionPolicy Bypass -File .\\install.ps1 -CheckOnly\`，再运行不带CheckOnly的命令安装。CheckOnly仅检查文件与核心依赖，不注册、安装或停用插件。\n\n首次没有yg源时注册本解压目录；已有yg源保留原指针，官方安装API仅为本次安装指定当前干净包。既有源也需同步到整合版本，否则今后手动从旧源安装可能回退。新YG确认成功后仅停用已知旧Issue独立入口，不删除其缓存、草稿或聊天关联。业务数据仍在原IssueHub/data，插件版本号不决定数据库schema。\n\n已经安装同版且文件不同则拒绝覆盖，请使用新修订。已有更高YG版本不自动降级。不要把另一插件的旧Issue版本号与YG版本作比较。\n\n安装后分别打开Tokens与Issue Hub，核对原草稿和聊天关联；不自动创建或发送聊天。本机隔离配置测试不替代另一台真实Windows及成员授权验收。\n`);
    await validateToolkitBundle(stage);
    await mkdir(resolve(outputRoot), { recursive: true });
    const archive = join(resolve(outputRoot), `yg-toolkit-${version}-windows-${Date.now()}.zip`);
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:YG_TOOLKIT_STAGE,$env:YG_TOOLKIT_ARCHIVE)'], { windowsHide: true, shell: false, env: { ...process.env, YG_TOOLKIT_STAGE: stage, YG_TOOLKIT_ARCHIVE: archive }, maxBuffer: 1048576 });
    const result = { name: 'yg-toolkit', version, archive, sha256: sha(await readFile(archive)), pluginFiles: files.length, installerFiles: 5, skills: files.filter(path => /^skills\/[^/]+\/SKILL\.md$/.test(path)).length, originalMarketplaceModified: false, secondMachineVerified: false };
    await writeFile(join(resolve(outputRoot), `package-yg-toolkit-${version}.json`), JSON.stringify(result, null, 2) + '\n'); return result;
  } finally {
    const actual = resolve(stage);
    if (!actual.startsWith(`${resolve(tmpdir())}${sep}yg-toolkit-windows-`)) throw new Error('临时目录范围不符，保留现场。');
    await rm(actual, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  }
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--out');
  if (at < 0 || !process.argv[at + 1]) throw new Error('请用--out指定交接包输出目录。');
  console.log(JSON.stringify(await packageToolkit({ outputRoot: process.argv[at + 1] })));
}
