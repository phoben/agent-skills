import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';
import { findCodexCommand } from '../../../../packages/token-usage/src/codex-bridge.mjs';

// 只安装到自有临时CODEX_HOME；不使用用户配置或业务数据库。
const archive = process.argv[2], resultFile = process.argv[3]; assert.ok(archive && resultFile);
const directory = await mkdtemp(join(tmpdir(), 'yg-toolkit-bundle-smoke-')), bundle = join(directory, 'bundle'), profile = join(directory, 'profile');
const run = promisify(execFile), env = { ...process.env, CODEX_HOME: profile, ISSUE_HUB_DATA_DIR: join(directory, 'data') }, target = await findCodexCommand();
const report = { realUserConfigModified: false, secondMachineVerified: false, remoteWrites: false, chatOpened: false, failure: null };
let child, lines; const pending = new Map(); let serial = 0;
async function cli(args) { const result = await run(target.command, [...target.args, ...args, '--json'], { env, windowsHide: true, shell: false, timeout: 60000, maxBuffer: 4 * 1024 * 1024 }); return JSON.parse(result.stdout); }
function rpc(method, params) { return new Promise((resolveRequest, reject) => { const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(new Error('隔离宿主超时')); }, 60000); pending.set(id, { resolve: resolveRequest, reject, timer }); child.stdin.write(JSON.stringify({ id, method, params }) + '\n'); }); }
try {
  await mkdir(bundle); await mkdir(profile);
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:YG_SMOKE_ZIP,$env:YG_SMOKE_DIR)'], { env: { ...env, YG_SMOKE_ZIP: resolve(archive), YG_SMOKE_DIR: bundle }, windowsHide: true, shell: false, timeout: 30000 });
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(bundle, 'install.ps1'), '-CheckOnly'], { env, cwd: bundle, windowsHide: true, shell: false, timeout: 60000, maxBuffer: 4 * 1024 * 1024 }); report.checkOnlyPassed = true;
  assert.equal((await cli(['plugin', 'marketplace', 'list'])).marketplaces.length, 0); assert.equal((await cli(['plugin', 'list'])).installed.length, 0); report.checkOnlyUnchanged = true;
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(bundle, 'install.ps1')], { env, cwd: bundle, windowsHide: true, shell: false, timeout: 120000, maxBuffer: 4 * 1024 * 1024 }); report.installPassed = true;
  const inventory = await cli(['plugin', 'list']); const installed = inventory.installed.find(item => item.pluginId === 'yg-toolkit@yg'); assert.equal(installed.version, '0.3.0'); assert.equal(installed.enabled, true); report.version = installed.version;
  child = spawn(target.command, [...target.args, 'app-server', '--stdio'], { env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }); child.stderr.on('data', () => {});
  lines = createInterface({ input: child.stdout }); lines.on('line', line => { let value; try { value = JSON.parse(line); } catch { return; } const item = pending.get(value.id); if (!item) return; clearTimeout(item.timer); pending.delete(value.id); value.error ? item.reject(new Error('隔离宿主请求失败')) : item.resolve(value.result); });
  await rpc('initialize', { clientInfo: { name: 'yg_bundle_smoke', version: '1' }, capabilities: { experimentalApi: true } }); child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  const status = await rpc('mcpServerStatus/list', { limit: 100 }); const services = status.data.filter(item => item.pluginId === 'yg-toolkit@yg');
  report.services = services.map(item => ({ name: item.serverInfo?.name, version: item.serverInfo?.version, toolCount: Object.keys(item.tools || {}).length, toolsError: item.toolsError || null }));
  assert.equal(services.length, 2); assert.ok(services.every(item => item.serverInfo?.version === '0.3.0' && !item.toolsError)); assert.deepEqual(report.services.map(item => item.toolCount).sort((a, b) => a - b), [3, 8]); report.passed = true;
} catch (error) { report.failure = { code: error.code || 'SMOKE_FAILED', message: error.message, stdoutTail: String(error.stdout || '').slice(-600), stderrTail: String(error.stderr || '').slice(-300) }; process.exitCode = 1; }
finally {
  for (const item of pending.values()) clearTimeout(item.timer); pending.clear(); lines?.close();
  if (child) { child.stdin.end(); await Promise.race([new Promise(resolveExit => child.once('exit', resolveExit)), new Promise(resolveWait => setTimeout(resolveWait, 2000))]); if (child.exitCode === null) child.kill(); }
  const actual = resolve(directory); if (actual.startsWith(`${resolve(tmpdir())}${sep}yg-toolkit-bundle-smoke-`)) { try { await rm(actual, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); report.cleaned = true; } catch { report.cleanupPending = true; } }
  await writeFile(resolve(resultFile), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
}
