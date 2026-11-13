import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

// 所有安装及宿主探针只作用于自有临时profile，不接触真实配置、业务库或聊天。
const workspace = 'E:/Develop/agent-skills/.worktrees/issue-hub-in-yg-20261104';
const { findCodexCommand } = await import(pathToFileURL(join(workspace, 'packages/token-usage/src/codex-bridge.mjs')));
const run = promisify(execFile), target = await findCodexCommand();
const archive = process.argv[2]; assert.ok(archive);
const temporary = await mkdtemp(join(tmpdir(), 'yg-toolkit-review-'));
const bundle = join(temporary, 'bundle'), profile = join(temporary, 'profile');
const env = { ...process.env, CODEX_HOME: profile, ISSUE_HUB_DATA_DIR: join(temporary, 'issue-data'), GH_CONFIG_DIR: join(temporary, 'gh'), LOCALAPPDATA: join(temporary, 'localappdata'), APPDATA: join(temporary, 'appdata'), USERPROFILE: profile, HOME: profile };
for (const key of ['GH_TOKEN', 'GITHUB_TOKEN', 'OPENAI_API_KEY']) delete env[key];
const report = { actualUserProfileModified: false, actualUserDataModified: false, sandboxedUserDirectories: true, secondMachineVerified: false, remoteWrites: false, chatOpened: false, failure: null };
let child, lines, serial = 0; const pending = new Map();
const sha = value => createHash('sha256').update(value).digest('hex');
async function cli(args) { const result = await run(target.command, [...target.args, ...args, '--json'], { env, windowsHide: true, shell: false, timeout: 60000, maxBuffer: 4194304 }); return JSON.parse(result.stdout); }
function rpc(method, params) {
  assert.ok(['initialize', 'mcpServerStatus/list'].includes(method));
  return new Promise((resolveRequest, reject) => { const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(new Error('隔离宿主超时')); }, 60000); pending.set(id, { resolve: resolveRequest, reject, timer }); child.stdin.write(JSON.stringify({ id, method, params }) + '\n'); });
}
try {
  report.archiveSha256 = sha(await readFile(archive));
  assert.equal(report.archiveSha256, '03ad7b6bf8531291e3c0a22c5db2c506041634858ac958069cab917f3b273729');
  await mkdir(bundle); await mkdir(profile);
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:YG_REVIEW_ZIP,$env:YG_REVIEW_DIR)'], { env: { ...env, YG_REVIEW_ZIP: resolve(archive), YG_REVIEW_DIR: bundle }, windowsHide: true, shell: false, timeout: 30000 });
  const manifest = JSON.parse(await readFile(join(bundle, 'package-manifest.json'), 'utf8'));
  const published = (await run('git', ['-C', workspace, 'ls-tree', '-r', '--name-only', 'origin/main', '--', 'plugins/yg-toolkit/skills'], { windowsHide: true, shell: false })).stdout.trim().split(/\r?\n/).filter(Boolean);
  await run('git', ['-C', workspace, 'diff', '--quiet', 'origin/main', '--', 'plugins/yg-toolkit/skills'], { windowsHide: true, shell: false });
  const packaged = manifest.files.filter(item => item.path.startsWith('plugins/yg-toolkit/skills/'));
  assert.deepEqual(packaged.map(item => item.path).sort(), published.sort());
  for (const item of packaged) { assert.equal(sha(await readFile(join(bundle, item.path))), item.sha256); assert.equal(sha(await readFile(join(workspace, item.path))), item.sha256); }
  report.version = manifest.version; report.pluginFiles = manifest.files.length; report.skillFiles = packaged.length; report.skills = packaged.filter(item => /^plugins\/yg-toolkit\/skills\/[^/]+\/SKILL\.md$/.test(item.path)).length; report.publishedSkillsMatched = true;
  assert.equal(report.pluginFiles, 159); assert.equal(report.skills, 10);
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(bundle, 'install.ps1'), '-CheckOnly'], { env, cwd: bundle, windowsHide: true, shell: false, timeout: 60000, maxBuffer: 4194304 });
  assert.equal((await cli(['plugin', 'marketplace', 'list'])).marketplaces.length, 0); assert.equal((await cli(['plugin', 'list'])).installed.length, 0); report.checkOnlyPassed = true; report.checkOnlyUnchanged = true;
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(bundle, 'install.ps1')], { env, cwd: bundle, windowsHide: true, shell: false, timeout: 120000, maxBuffer: 4194304 });
  const installed = (await cli(['plugin', 'list'])).installed.find(item => item.pluginId === 'yg-toolkit@yg'); assert.equal(installed.version, '0.3.0'); assert.equal(installed.enabled, true);
  for (const item of manifest.files) assert.equal(sha(await readFile(join(profile, 'plugins/cache/yg/yg-toolkit/0.3.0', item.path.slice('plugins/yg-toolkit/'.length)))), item.sha256);
  report.installPassed = true; report.installedFilesMatched = true;
  child = spawn(target.command, [...target.args, 'app-server', '--stdio'], { env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }); child.stderr.on('data', () => {});
  lines = createInterface({ input: child.stdout }); lines.on('line', line => { let value; try { value = JSON.parse(line); } catch { return; } const item = pending.get(value.id); if (!item) return; clearTimeout(item.timer); pending.delete(value.id); value.error ? item.reject(new Error('隔离宿主请求失败')) : item.resolve(value.result); });
  await rpc('initialize', { clientInfo: { name: 'yg_toolkit_final_review', version: '1' }, capabilities: { experimentalApi: true } }); child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  const servers = (await rpc('mcpServerStatus/list', { limit: 100 })).data.filter(item => item.pluginId === 'yg-toolkit@yg');
  report.services = servers.map(item => ({ name: item.serverInfo?.name, version: item.serverInfo?.version, tools: Object.keys(item.tools || {}).length, toolsError: item.toolsError || null }));
  assert.equal(servers.length, 2); assert.ok(servers.every(item => item.serverInfo?.version === '0.3.0' && !item.toolsError)); assert.deepEqual(report.services.map(item => item.tools).sort((a, b) => a - b), [3, 8]); report.passed = true;
} catch (error) { report.failure = { code: error.code || 'REVIEW_FAILED', message: error.message }; report.passed = false; process.exitCode = 1; }
finally {
  for (const item of pending.values()) clearTimeout(item.timer); pending.clear(); lines?.close();
  if (child) { child.stdin.end(); await Promise.race([new Promise(resolveExit => child.once('exit', resolveExit)), new Promise(resolveWait => setTimeout(resolveWait, 2000))]); if (child.exitCode === null) child.kill(); }
  const actual = resolve(temporary); if (!actual.startsWith(`${resolve(tmpdir())}${sep}yg-toolkit-review-`)) throw new Error('拒绝清理非自有临时目录');
  try { await rm(actual, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); report.cleaned = true; } catch { report.cleanupPending = true; }
  await writeFile(new URL('./toolkit-bundle-check-final.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
}
