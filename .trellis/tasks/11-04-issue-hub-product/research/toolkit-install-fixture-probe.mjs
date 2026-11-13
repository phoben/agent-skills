import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';
import { mkdtemp, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { findCodexCommand } from '../../../../packages/token-usage/src/codex-bridge.mjs';

// 仅在research自有profile验证官方安装API；不使用真实用户配置或业务数据。
const research = resolve('E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research');
const base = await mkdtemp(join(research, 'toolkit-migration-fixture-'));
const profile = join(base, 'profile'), first = join(base, 'first'), second = join(base, 'second');
const target = await findCodexCommand(), run = promisify(execFile);
const env = { ...process.env, CODEX_HOME: profile };
const unregistered = process.argv.includes('--unregistered'), twoServers = process.argv.includes('--two-servers');
const report = { version: '0.163.0', realUserConfigModified: false, fixtureOnly: true, unregistered, twoServers, steps: [], failure: null };
await mkdir(profile);
async function fixture(root, version) {
  const plugin = join(root, 'plugins/yg-toolkit');
  await mkdir(join(root, '.agents/plugins'), { recursive: true }); await mkdir(join(plugin, '.codex-plugin'), { recursive: true }); await mkdir(join(plugin, 'dist'));
  const manifest = { name: 'yg-toolkit', version, description: '仅用于安装形状验证的隔离夹具', interface: { displayName: 'YG Toolkit' } };
  await writeFile(join(plugin, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: manifest.name, version, description: manifest.description, extensions: { 'com.openai': { interface: manifest.interface } } }));
  await writeFile(join(plugin, '.codex-plugin/plugin.json'), JSON.stringify({ ...manifest, mcpServers: './mcp.json' }));
  const trace = `require('node:fs').writeFileSync(${JSON.stringify(join(root, 'trace.json'))},JSON.stringify({arg:process.argv[1]}));require(process.argv[1]);`;
  const server = { type: 'stdio', command: 'node', args: ['-e', trace, '${PLUGIN_ROOT}/dist/probe.cjs'] };
  await writeFile(join(plugin, 'mcp.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', mcpServers: { 'yg-token-usage': server, ...(twoServers ? { 'issue-hub': server } : {}) } }));
  await writeFile(join(plugin, 'dist/probe.cjs'), `const rl=require('node:readline').createInterface({input:process.stdin});rl.on('line',line=>{let m;try{m=JSON.parse(line)}catch{return}if(m.id===undefined)return;let result;if(m.method==='initialize')result={protocolVersion:m.params.protocolVersion,serverInfo:{name:'fixture',version:${JSON.stringify(version)}},capabilities:{tools:{},resources:{}}};else if(m.method==='tools/list')result={tools:[]};else if(m.method==='resources/list')result={resources:[]};else if(m.method==='resources/templates/list')result={resourceTemplates:[]};else if(m.method==='prompts/list')result={prompts:[]};else{process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'unknown fixture method'}})+String.fromCharCode(10));return}process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+String.fromCharCode(10))});`);
  await run(process.execPath, ['--check', join(plugin, 'dist/probe.cjs')], { windowsHide: true, shell: false });
  await writeFile(join(root, '.agents/plugins/marketplace.json'), JSON.stringify({ name: 'yg', interface: { displayName: 'YG Fixture' }, plugins: [{ name: 'yg-toolkit', source: { source: 'local', path: './plugins/yg-toolkit' }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' }] }));
}
async function cli(args) { return JSON.parse((await run(target.command, [...target.args, ...args, '--json'], { env, cwd: base, shell: false, windowsHide: true, timeout: 60000, maxBuffer: 1048576 })).stdout); }
async function start() {
  const child = spawn(target.command, [...target.args, 'app-server', '--stdio'], { env, cwd: base, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.on('data', () => {}); const lines = createInterface({ input: child.stdout }); let serial = 0; const pending = new Map();
  lines.on('line', line => { let row; try { row = JSON.parse(line); } catch { return; } const item = pending.get(row.id); if (!item) return; pending.delete(row.id); clearTimeout(item.timer); row.error ? item.reject(Object.assign(new Error(row.error.message), { rpcCode: row.error.code })) : item.resolve(row.result); });
  child.stdin.on('error', () => {});
  function request(method, params) { return new Promise((resolveRequest, reject) => { const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(new Error('夹具请求超时')); }, 30000); pending.set(id, { resolve: resolveRequest, reject, timer }); child.stdin.write(JSON.stringify({ id, method, params }) + '\n'); }); }
  await request('initialize', { clientInfo: { name: 'toolkit_fixture_probe', version: '1' }, capabilities: { experimentalApi: true } }); child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  return { request, async close() { lines.close(); child.stdin.end(); for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('夹具结束')); } await new Promise(r => { if (child.exitCode !== null) r(); else { const timer = setTimeout(() => { child.kill(); r(); }, 1500); child.once('exit', () => { clearTimeout(timer); r(); }); } }); } };
}
let host;
try {
  await fixture(first, '0.2.5'); await fixture(second, '0.3.0');
  if (!unregistered) await cli(['plugin', 'marketplace', 'add', first]);
  const before = await cli(['plugin', 'marketplace', 'list']); report.steps.push({ action: 'registered-first', sourceIsFirst: before.marketplaces.some(m => m.name === 'yg' && resolve(m.root) === resolve(first)) });
  host = await start();
  let marketplacePath;
  for (const [kind, path] of [['root', second], ['manifest', join(second, '.agents/plugins/marketplace.json')]]) {
    try { const value = await host.request('plugin/read', { marketplacePath: path, pluginName: 'yg-toolkit' }); report.steps.push({ action: 'read-second', pathKind: kind, responseKeys: Object.keys(value) }); marketplacePath = path; break; }
    catch (error) { report.steps.push({ action: 'read-second', pathKind: kind, error: error.message }); }
  }
  if (!marketplacePath) throw new Error('两个官方路径形状均未识别');
  await host.request('plugin/install', { marketplacePath, pluginName: 'yg-toolkit' }); report.steps.push({ action: 'install-second-api', success: true }); await host.close(); host = null;
  const after = await cli(['plugin', 'marketplace', 'list']);
  const installed = await cli(['plugin', 'list', '--marketplace', 'yg']);
  report.steps.push({ action: 'cli-after-install', sourceIsFirst: after.marketplaces.some(m => m.name === 'yg' && resolve(m.root) === resolve(first)), installed: installed.installed.filter(p => p.pluginId === 'yg-toolkit@yg').map(p => ({ pluginId: p.pluginId, version: p.version, enabled: p.enabled })) });
  host = await start(); let inventory;
  for (let attempt = 0; attempt < 12; attempt++) {
    inventory = await host.request('mcpServerStatus/list', { limit: 100 });
    const active = (inventory.data || []).filter(p => p.pluginId === 'yg-toolkit@yg');
    if (active.length === (twoServers ? 2 : 1) && active.every(p => p.serverInfo?.version)) break;
    await new Promise(r => setTimeout(r, 400));
  }
  report.steps.push({ action: 'new-host-live', services: (inventory.data || []).filter(p => p.pluginId === 'yg-toolkit@yg').map(p => ({ pluginId: p.pluginId, serverInfo: p.serverInfo, runtimeStatus: p.runtimeStatus, toolsError: p.toolsError, toolCount: Object.keys(p.tools || {}).length, statusKeys: Object.keys(p) })) });
  for (const [label, root] of [['first', first], ['second', second]]) {
    try { const value = JSON.parse(await readFile(join(root, 'trace.json'), 'utf8')); report.steps.push({ action: 'fixture-trace', definitionSource: label, hasPlaceholder: value.arg.includes('${PLUGIN_ROOT}'), usesOldCacheVersion: value.arg.includes('0.2.5'), usesNewCacheVersion: value.arg.includes('0.3.0'), argument: value.arg.replaceAll(base, '<fixture>') }); } catch {}
  }
  if (!(inventory.data || []).some(p => p.pluginId === 'yg-toolkit@yg' && p.serverInfo?.version === '0.3.0')) throw new Error('新宿主未读到第二源的活体版本');
  if (twoServers && (inventory.data || []).filter(p => p.pluginId === 'yg-toolkit@yg' && p.serverInfo?.version === '0.3.0').length !== 2) throw new Error('未发现两个同包服务');
  await host.close(); host = null;
  const final = await cli(['plugin', 'list', '--marketplace', 'yg']); report.steps.push({ action: 'final-cli', installed: final.installed.filter(p => p.pluginId === 'yg-toolkit@yg').map(p => ({ pluginId: p.pluginId, version: p.version, enabled: p.enabled })) });
  if (process.argv.includes('--legacy-add-probe')) {
    await cli(['plugin', 'add', 'yg-toolkit@yg']);
    const replaced = await cli(['plugin', 'list', '--marketplace', 'yg']);
    host = await start(); const replacedStatus = await host.request('mcpServerStatus/list', { limit: 100 }); await host.close(); host = null;
    report.steps.push({ action: 'manual-cli-add-from-registered-old-source', installed: replaced.installed.filter(p => p.pluginId === 'yg-toolkit@yg').map(p => ({ version: p.version, enabled: p.enabled })), liveVersions: (replacedStatus.data || []).filter(p => p.pluginId === 'yg-toolkit@yg').map(p => p.serverInfo?.version || null) });
  }
  if (process.argv.includes('--disable-probe')) {
    host = await start();
    await host.request('config/value/write', { keyPath: 'plugins.\"yg-toolkit@yg\".enabled', value: false, mergeStrategy: 'replace' });
    await host.close(); host = null;
    const disabled = await cli(['plugin', 'list', '--marketplace', 'yg']);
    host = await start(); const disabledStatus = await host.request('mcpServerStatus/list', { limit: 100 }); await host.close(); host = null;
    const ownConfig = await readFile(join(profile, 'config.toml'), 'utf8');
    report.steps.push({ action: 'official-disable', configDisabled: ownConfig.includes('[plugins.\"yg-toolkit@yg\"]') && ownConfig.includes('enabled = false'), cliListedAsDisabled: disabled.installed.some(p => p.pluginId === 'yg-toolkit@yg' && p.enabled === false), loadedServices: (disabledStatus.data || []).filter(p => p.pluginId === 'yg-toolkit@yg').length, cachePreserved: (await stat(join(profile, 'plugins/cache/yg/yg-toolkit/0.3.0/dist/probe.cjs'))).isFile() });
  }
  // 同名marketplace add是否覆盖，只在独立profile最后执行。
  try {
    await cli(['plugin', 'marketplace', 'add', second]); const replaced = await cli(['plugin', 'marketplace', 'list']);
    report.steps.push({ action: 'same-name-add-second', sourceIsSecond: replaced.marketplaces.some(m => m.name === 'yg' && resolve(m.root) === resolve(second)) });
  } catch (error) { report.steps.push({ action: 'same-name-add-second', rejectedDifferentSource: /already added from a different source/.test(error.stderr || '') }); }
} catch (error) { report.failure = { message: error.message, code: error.code || error.rpcCode }; }
finally { await host?.close(); const suffix = process.argv.includes('--legacy-add-probe') ? '-legacy-add' : unregistered ? '-unregistered' : process.argv.includes('--complete') ? '-complete' : process.argv.includes('--schema') ? '-schema' : process.argv.includes('--trace') ? '-trace' : process.argv.includes('--full-fixture') ? '-full-fixture' : process.argv.includes('--validated') ? '-validated' : process.argv.includes('--corrected') ? '-corrected' : ''; await writeFile(join(research, `toolkit-install-fixture-probe${suffix}.json`), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); }
