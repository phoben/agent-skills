import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { findCodexCommand } from '../../token-usage/src/codex-bridge.mjs';

const runFile = promisify(execFile), sha = value => createHash('sha256').update(value).digest('hex');
const runtimes = ['token-usage.cjs', 'token-usage.html', 'THIRD-PARTY-LICENSES.txt', 'issue-hub.cjs', 'issue-hub.html', 'issue-hub-THIRD-PARTY-LICENSES.txt'];
const required = ['plugin.json', '.codex-plugin/plugin.json', 'mcp.json', 'LICENSE', 'assets/usage-light.svg', 'assets/usage-dark.svg', 'assets/issue-hub.svg', ...runtimes.map(name => `dist/${name}`)];
const forbidden = new Set(['node_modules', '.git', '.cache', '.trellis', 'auth.json', 'credentials.json', 'config.toml']);
const ownedLegacy = new Set(['issue-hub@yg', 'issue-hub@issue-hub-review']);

export async function collectPluginFiles(pluginRoot) {
  const files = [];
  async function visit(relative) {
    const target = join(pluginRoot, relative), details = await lstat(target);
    if (details.isSymbolicLink()) throw new Error('插件包不能包含符号链接。');
    const name = basename(relative).toLowerCase();
    if (forbidden.has(name) || name.startsWith('.env') || /\.(?:sqlite(?:-wal|-shm)?|db|log|zip)$/i.test(name)) throw new Error('插件包包含本机数据或禁止分发的文件。');
    if (details.isDirectory()) {
      for (const child of (await readdir(target)).sort()) await visit(relative ? `${relative}/${child}` : child);
    } else if (details.isFile()) {
      if (!(required.includes(relative) || relative.startsWith('skills/') || relative.startsWith('assets/'))) throw new Error('插件目录存在未声明的分发文件。');
      files.push(relative);
    } else throw new Error('插件包只能包含普通文件。');
  }
  await visit('');
  for (const path of required) if (!files.includes(path)) throw new Error(`缺少插件文件：${path}`);
  if (!files.some(path => /^skills\/[^/]+\/SKILL\.md$/.test(path))) throw new Error('YG包缺少工程技能。');
  return files;
}

async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function safeBundlePath(root, relative) {
  let current = root;
  for (const part of ['', ...relative.split('/')]) {
    current = part ? join(current, part) : current;
    if ((await lstat(current)).isSymbolicLink()) throw new Error('验收包路径不能经过符号链接。');
  }
}
export async function validateToolkitBundle(bundleRoot) {
  const root = resolve(bundleRoot); await safeBundlePath(root, 'package-manifest.json'); await safeBundlePath(root, 'plugins/yg-toolkit'); await safeBundlePath(root, '.agents/plugins/marketplace.json');
  const manifest = await json(join(root, 'package-manifest.json'));
  if (manifest.name !== 'yg-toolkit' || manifest.marketplace !== 'yg' || !/^\d+\.\d+\.\d+$/.test(manifest.version) || !Array.isArray(manifest.files)) throw new Error('YG验收包清单无效。');
  const expected = new Map();
  for (const entry of manifest.files) {
    if (typeof entry.path !== 'string' || !entry.path.startsWith('plugins/yg-toolkit/') || entry.path.includes('\\') || entry.path.includes('\0') || entry.path.split('/').some(part => ['', '.', '..'].includes(part)) || !/^[a-f0-9]{64}$/.test(entry.sha256 || '') || expected.has(entry.path)) throw new Error('文件清单包含无效或重复路径。');
    expected.set(entry.path, entry.sha256);
  }
  const pluginRoot = join(root, 'plugins/yg-toolkit'), files = await collectPluginFiles(pluginRoot);
  if (files.length !== expected.size) throw new Error('插件文件与哈希清单数量不一致。');
  for (const path of files) if (sha(await readFile(join(pluginRoot, path))) !== expected.get(`plugins/yg-toolkit/${path}`)) throw new Error(`文件校验失败：${path}`);
  const primary = await json(join(pluginRoot, 'plugin.json')), compat = await json(join(pluginRoot, '.codex-plugin/plugin.json')), mcp = await json(join(pluginRoot, 'mcp.json'));
  if (primary.name !== 'yg-toolkit' || compat.name !== primary.name || primary.version !== manifest.version || compat.version !== manifest.version || !primary.$schema || !mcp.$schema) throw new Error('YG双清单或schema声明不一致。');
  for (const [name, marker] of [['token-usage.cjs', 'YG Toolkit'], ['token-usage.html', 'YG Toolkit'], ['issue-hub.cjs', 'Issue Hub'], ['issue-hub.html', 'Issue Hub']]) {
    const first = (await readFile(join(pluginRoot, 'dist', name), 'utf8')).split(/\r?\n/, 1)[0];
    const expectedHeader = name.endsWith('.cjs') ? `// ${marker} 版本: ${manifest.version}` : `<!-- ${marker} 版本: ${manifest.version} -->`;
    if (first !== expectedHeader) throw new Error('两个服务与页面必须共享YG清单版本。');
  }
  for (const name of ['LICENSE', 'dist/THIRD-PARTY-LICENSES.txt', 'dist/issue-hub-THIRD-PARTY-LICENSES.txt']) if (!(await readFile(join(pluginRoot, name), 'utf8')).trim()) throw new Error('插件及两个服务的许可不能为空。');
  if (JSON.stringify(Object.keys(mcp.mcpServers || {}).sort()) !== JSON.stringify(['issue-hub', 'yg-token-usage'])) throw new Error('YG包必须包含两个独立MCP服务。');
  for (const [server, filename] of [['yg-token-usage', 'token-usage.cjs'], ['issue-hub', 'issue-hub.cjs']]) if (mcp.mcpServers[server].command !== 'node' || JSON.stringify(mcp.mcpServers[server].args) !== JSON.stringify([`\${PLUGIN_ROOT}/dist/${filename}`])) throw new Error('MCP入口不是已核对的本机产物。');
  const marketplacePath = join(root, '.agents/plugins/marketplace.json'), marketplace = await json(marketplacePath);
  if (marketplace.name !== 'yg' || marketplace.plugins?.length !== 1 || marketplace.plugins[0].name !== 'yg-toolkit' || marketplace.plugins[0].source?.source !== 'local' || marketplace.plugins[0].source?.path !== './plugins/yg-toolkit') throw new Error('安装源必须只包含当前YG本机包。');
  return { root, pluginRoot, marketplacePath, manifest, files };
}

function compare(left, right) {
  const parse = value => { const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value || ''); if (!match) throw new Error('已安装版本无法识别，请先核对。'); return match.slice(1).map(Number); };
  const a = parse(left), b = parse(right); return a.findIndex((value, i) => value !== b[i]) < 0 ? 0 : a.reduce((result, value, i) => result || Math.sign(value - b[i]), 0);
}

export async function createSetupClient({ target, timeoutMs = 60000 } = {}) {
  target ||= await findCodexCommand();
  const child = spawn(target.command, [...target.args, 'app-server', '--stdio'], { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.on('data', () => {});
  const lines = createInterface({ input: child.stdout }), pending = new Map(); let serial = 0;
  function fail() { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Codex安装连接已关闭。')); } pending.clear(); }
  child.on('error', fail); child.on('exit', fail); child.stdin.on('error', fail);
  lines.on('line', line => { let value; try { value = JSON.parse(line); } catch { return; } const item = pending.get(value.id); if (!item) return; pending.delete(value.id); clearTimeout(item.timer); value.error ? item.reject(new Error('Codex未接受本次插件设置，请保留原数据并核对安装状态。')) : item.resolve(value.result); });
  const allowed = new Set(['initialize', 'plugin/install', 'config/read', 'config/value/write']);
  function request(method, params) {
    if (!allowed.has(method)) throw new Error('安装器拒绝其他宿主操作。');
    return new Promise((resolveRequest, reject) => { const id = ++serial; const timer = setTimeout(() => { pending.delete(id); reject(new Error('Codex安装检查超时。')); }, timeoutMs); pending.set(id, { resolve: resolveRequest, reject, timer }); child.stdin.write(JSON.stringify({ id, method, params }) + '\n'); });
  }
  const close = async () => { lines.close(); child.stdin.end(); fail(); if (child.exitCode === null) { await Promise.race([new Promise(resolveExit => child.once('exit', resolveExit)), new Promise(resolveWait => setTimeout(resolveWait, 1500))]); if (child.exitCode === null) child.kill(); } };
  try { await request('initialize', { clientInfo: { name: 'yg_toolkit_installer', version: '1.0.0' }, capabilities: { experimentalApi: true } }); child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n'); }
  catch (error) { await close(); throw error; }
  return { request, close };
}

async function defaultEnvironment() {
  if (process.platform !== 'win32' || Number(process.versions.node.split('.')[0]) !== 24) throw new Error('此安装器需要Windows和Node 24。');
  try { await runFile('git', ['--version'], { windowsHide: true, shell: false, timeout: 15000 }); } catch { throw new Error('Git不可用，请安装后重试。'); }
  let target;
  try { target = await findCodexCommand(); await runFile(target.command, [...target.args, '--version'], { windowsHide: true, shell: false, timeout: 15000 }); } catch { throw new Error('Codex不可用，请核对安装和命令路径。'); }
  const warnings = [];
  try { await runFile('gh', ['--version'], { windowsHide: true, shell: false, timeout: 15000 }); } catch { warnings.push('未找到gh：Tokens及工程技能可安装，Issue管理需另装GitHub CLI并登录。'); }
  return { target, warnings };
}

export async function installToolkit({ bundleRoot, checkOnly = false }, dependencies = {}) {
  const bundle = await validateToolkitBundle(bundleRoot), environment = await (dependencies.inspectEnvironment || defaultEnvironment)();
  const report = { name: 'yg-toolkit', version: bundle.manifest.version, checkedFiles: bundle.files.length, warnings: [...environment.warnings], checkOnly, installed: false, legacyDisabled: [], marketplacePreserved: true, issueDataDirectoryChanged: false, legacyCacheDeleted: false };
  if (checkOnly) return report;
  const runCodex = dependencies.runCodex || (async args => { try { const result = await runFile(environment.target.command, [...environment.target.args, ...args], { windowsHide: true, shell: false, timeout: 60000, maxBuffer: 4 * 1024 * 1024 }); return JSON.parse(result.stdout); } catch { throw new Error('Codex插件命令未完成，请核对当前安装状态。'); } });
  const checkedExisting = inventory => {
    if (!Array.isArray(inventory.installed)) throw new Error('插件安装清单格式不可识别。');
    const existing = inventory.installed.find(item => item.pluginId === 'yg-toolkit@yg');
    if (existing && compare(existing.version, bundle.manifest.version) > 0) throw new Error('已安装较新YG版本，不自动降级。');
    return existing;
  };
  let inventory = await runCodex(['plugin', 'list', '--json']), existing = checkedExisting(inventory);
  const marketplaces = await runCodex(['plugin', 'marketplace', 'list', '--json']);
  const marketplaceRows = Array.isArray(marketplaces) ? marketplaces : marketplaces.marketplaces;
  if (!Array.isArray(marketplaceRows)) throw new Error('插件源列表格式不可识别。');
  if (!marketplaceRows.some(item => item.name === 'yg')) {
    await runCodex(['plugin', 'marketplace', 'add', bundle.root, '--json']); report.marketplaceRegistered = true;
    // 无注册源时CLI可能隐藏已装项；补注册后重新核对，不能绕过新版或同版缓存保护。
    inventory = await runCodex(['plugin', 'list', '--json']); existing = checkedExisting(inventory);
  }
  else report.warnings.push('已有yg源保持原指针；请同步该源到整合后的版本，避免以后手动安装旧源回退。');
  const createClient = dependencies.createClient || (() => createSetupClient({ target: environment.target }));
  let rpc;
  try {
    rpc = await createClient();
    const configuration = await rpc.request('config/read', { includeLayers: false });
    if (!configuration?.config || typeof configuration.config !== 'object') throw new Error('无法核对旧插件启用状态，未开始安装。');
    const legacyActive = [...ownedLegacy].filter(id => inventory.installed.some(item => item.pluginId === id && item.enabled === true) || configuration.config.plugins?.[id] && configuration.config.plugins[id].enabled !== false);
    if (existing?.version === bundle.manifest.version) {
      const cache = join(resolve(process.env.CODEX_HOME || join(homedir(), '.codex')), 'plugins/cache/yg/yg-toolkit', existing.version);
      let equal = false;
      try { equal = (await Promise.all(bundle.manifest.files.map(async file => sha(await readFile(join(cache, file.path.slice('plugins/yg-toolkit/'.length)))) === file.sha256))).every(Boolean); } catch { /* 缓存缺失也不能覆盖同版本。 */ }
      if (!equal) throw new Error('同版本安装缓存无法核对或与包内容不同，请使用新的修订版本，勿覆盖占用缓存。');
      report.alreadyInstalled = true;
    } else await rpc.request('plugin/install', { pluginName: 'yg-toolkit', marketplacePath: bundle.marketplacePath });
    const after = await runCodex(['plugin', 'list', '--json']);
    if (!after.installed?.some(item => item.pluginId === 'yg-toolkit@yg' && item.version === bundle.manifest.version && item.enabled === true)) throw new Error('安装后未确认当前YG版本，请保留旧插件与数据。');
    report.installed = true;
    // 新YG确认后才停用明确的旧独立入口，不删除缓存、草稿或其他插件。
    for (const id of legacyActive) {
      await rpc.request('config/value/write', { keyPath: `plugins.${JSON.stringify(id)}.enabled`, value: false, mergeStrategy: 'replace' }); report.legacyDisabled.push(id);
    }
    if (report.legacyDisabled.length) {
      const final = await rpc.request('config/read', { includeLayers: false });
      if (report.legacyDisabled.some(id => final.config?.plugins?.[id]?.enabled !== false)) throw new Error('旧Issue入口尚未确认停用，请在插件设置核对，原数据已保留。');
    }
    return report;
  } finally { await rpc?.close(); }
}

if (['install-toolkit.mjs', 'install-toolkit.cjs'].includes(basename(process.argv[1] || ''))) {
  const at = process.argv.indexOf('--bundle'), bundleRoot = at >= 0 ? process.argv[at + 1] : null;
  if (!bundleRoot) { process.stderr.write('请通过--bundle指定已解压的YG包。\n'); process.exitCode = 1; }
  else installToolkit({ bundleRoot, checkOnly: process.argv.includes('--check-only') }).then(report => process.stdout.write(JSON.stringify(report, null, 2) + '\n')).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
