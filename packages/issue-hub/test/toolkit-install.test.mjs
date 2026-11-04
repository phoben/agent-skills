import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { collectPluginFiles, validateToolkitBundle, installToolkit } from '../scripts/install-toolkit.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'yg-install-test-'));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  const plugin = join(root, 'plugins/yg-toolkit');
  async function put(path, value) { const target = join(plugin, path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, value); }
  for (const path of ['LICENSE', 'assets/usage-light.svg', 'assets/usage-dark.svg', 'assets/issue-hub.svg', 'skills/demo/SKILL.md']) await put(path, '演示内容');
  for (const path of ['token-usage.cjs', 'token-usage.html', 'THIRD-PARTY-LICENSES.txt', 'issue-hub.cjs', 'issue-hub.html', 'issue-hub-THIRD-PARTY-LICENSES.txt']) {
    const marker = path.startsWith('issue-hub') ? 'Issue Hub' : 'YG Toolkit';
    const value = path.endsWith('.cjs') ? `// ${marker} 版本: 0.3.0\n` : path.endsWith('.html') ? `<!-- ${marker} 版本: 0.3.0 -->\n` : '测试许可';
    await put(`dist/${path}`, value);
  }
  await put('plugin.json', JSON.stringify({ name: 'yg-toolkit', version: '0.3.0', $schema: 'plugin.schema.json' }));
  await put('.codex-plugin/plugin.json', JSON.stringify({ name: 'yg-toolkit', version: '0.3.0' }));
  await put('mcp.json', JSON.stringify({ $schema: 'mcp.schema.json', mcpServers: { 'yg-token-usage': { command: 'node', args: ['${PLUGIN_ROOT}/dist/token-usage.cjs'] }, 'issue-hub': { command: 'node', args: ['${PLUGIN_ROOT}/dist/issue-hub.cjs'] } } }));
  await mkdir(join(root, '.agents/plugins'), { recursive: true });
  await writeFile(join(root, '.agents/plugins/marketplace.json'), JSON.stringify({ name: 'yg', plugins: [{ name: 'yg-toolkit', source: { source: 'local', path: './plugins/yg-toolkit' } }] }));
  const files = await collectPluginFiles(plugin);
  const manifest = { name: 'yg-toolkit', version: '0.3.0', marketplace: 'yg', files: await Promise.all(files.map(async path => ({ path: `plugins/yg-toolkit/${path}`, sha256: createHash('sha256').update(await readFile(join(plugin, path))).digest('hex') }))) };
  await writeFile(join(root, 'package-manifest.json'), JSON.stringify(manifest));
  return { root, plugin, manifest, put };
}

function environment(warnings = []) { return async () => ({ target: { command: 'unused', args: [] }, warnings }); }
function setupDependencies({ source = true, ygVersion = '0.2.5', legacyEnabled = true } = {}) {
  const calls = [], records = [{ pluginId: 'yg-toolkit@yg', version: ygVersion, enabled: true }, { pluginId: 'issue-hub@yg', version: '0.3.5', enabled: legacyEnabled }, { pluginId: 'unrelated@other', version: '1.0.0', enabled: true }];
  const rpc = { async request(method, params) {
    calls.push({ method, params });
    if (method === 'config/read') return { config: { plugins: { 'issue-hub@yg': { enabled: records[1].enabled } } } };
    if (method === 'plugin/install') records[0].version = '0.3.0';
    else if (method === 'config/value/write') { assert.equal(params.keyPath, 'plugins."issue-hub@yg".enabled'); records[1].enabled = false; }
    else throw new Error('不允许的调用');
  }, async close() { calls.push({ closed: true }); } };
  return { calls, records, dependencies: { inspectEnvironment: environment(), createClient: async () => rpc, runCodex: async args => {
    calls.push({ cli: args });
    if (args.join(' ') === 'plugin list --json') return { installed: structuredClone(records) };
    if (args.join(' ') === 'plugin marketplace list --json') return { marketplaces: source ? [{ name: 'yg', root: '旧源' }] : [] };
    if (args.slice(0, 3).join(' ') === 'plugin marketplace add') { source = true; return {}; }
    throw new Error('意外命令');
  } } };
}

test('统一YG包必须包含技能和两套资源，完整哈希校验通过', async t => {
  const f = await fixture(t), result = await validateToolkitBundle(f.root);
  assert.ok(result.files.includes('skills/demo/SKILL.md')); assert.ok(result.files.includes('dist/issue-hub.html')); assert.equal(result.manifest.version, '0.3.0');
});

test('哈希不符、未声明文件和路径穿越都在安装前拒绝', async t => {
  const f = await fixture(t);
  await f.put('dist/issue-hub.cjs', '被替换'); await assert.rejects(validateToolkitBundle(f.root), /文件校验失败/);
  await f.put('dist/issue-hub.cjs', '// Issue Hub 版本: 0.3.0\n'); await f.put('skills/demo/extra.md', '未声明'); await assert.rejects(validateToolkitBundle(f.root), /数量不一致/);
  await rm(join(f.plugin, 'skills/demo/extra.md'));
  f.manifest.files[0].path = 'plugins/yg-toolkit/../../auth.json'; await writeFile(join(f.root, 'package-manifest.json'), JSON.stringify(f.manifest));
  await assert.rejects(validateToolkitBundle(f.root), /无效或重复路径/);
});

test('即使哈希已更新，旧版本Issue页面仍不能随新清单安装', async t => {
  const f = await fixture(t), path = 'dist/issue-hub.html', value = '<!-- Issue Hub 版本: 0.2.5 -->\n';
  await f.put(path, value); f.manifest.files.find(entry => entry.path === `plugins/yg-toolkit/${path}`).sha256 = createHash('sha256').update(value).digest('hex');
  await writeFile(join(f.root, 'package-manifest.json'), JSON.stringify(f.manifest)); await assert.rejects(validateToolkitBundle(f.root), /共享YG清单版本/);
});

test('敏感本机文件与符号链接不能进入完整技能包', async t => {
  const f = await fixture(t); await f.put('skills/demo/auth.json', '{}'); await assert.rejects(collectPluginFiles(f.plugin), /本机数据/); await rm(join(f.plugin, 'skills/demo/auth.json'));
  try { await symlink(join(f.plugin, 'LICENSE'), join(f.plugin, 'skills/demo/link.md'), 'file'); }
  catch (error) { if (error.code === 'EPERM') { t.diagnostic('当前Windows不允许创建文件symlink，保留敏感文件回归。'); return; } throw error; }
  await assert.rejects(collectPluginFiles(f.plugin), /符号链接/);
});

test('CheckOnly即使gh缺失也不安装、注册或停用插件', async t => {
  const f = await fixture(t); let touched = false;
  const result = await installToolkit({ bundleRoot: f.root, checkOnly: true }, { inspectEnvironment: environment(['缺少gh，仅Issue功能受限']), runCodex: () => { touched = true; throw new Error('不应调用'); }, createClient: () => { touched = true; throw new Error('不应调用'); } });
  assert.equal(touched, false); assert.equal(result.installed, false); assert.equal(result.warnings.length, 1);
});

test('从干净同名yg源安装新YG后才停用旧Issue，不改旧源或其他插件', async t => {
  const f = await fixture(t), setup = setupDependencies();
  const result = await installToolkit({ bundleRoot: f.root }, setup.dependencies);
  const rpcCalls = setup.calls.filter(call => call.method);
  assert.deepEqual(rpcCalls.map(call => call.method), ['config/read', 'plugin/install', 'config/value/write', 'config/read']);
  assert.equal(rpcCalls[1].params.pluginName, 'yg-toolkit'); assert.equal(rpcCalls[1].params.marketplacePath, join(f.root, '.agents/plugins/marketplace.json'));
  assert.equal(result.marketplacePreserved, true); assert.equal(result.marketplaceRegistered, undefined); assert.equal(result.issueDataDirectoryChanged, false); assert.equal(result.legacyCacheDeleted, false); assert.equal(setup.records[2].enabled, true);
  assert.deepEqual(result.legacyDisabled, ['issue-hub@yg']); assert.ok(result.warnings.some(message => message.includes('旧源回退')));
});

test('首次成员仅在没有yg源时注册当前包，不因旧Issue版本较大拒绝YG升级', async t => {
  const f = await fixture(t), setup = setupDependencies({ source: false, legacyEnabled: false });
  const result = await installToolkit({ bundleRoot: f.root }, setup.dependencies);
  assert.equal(result.marketplaceRegistered, true); assert.equal(result.installed, true); assert.deepEqual(result.legacyDisabled, []);
  assert.ok(setup.calls.some(call => call.cli?.slice(0, 3).join(' ') === 'plugin marketplace add'));
});

for (const version of ['0.4.0', '0.3.0']) {
  test(`补注册yg源后重新核对隐藏的${version}安装，不绕过版本或同版缓存保护`, async t => {
    const f = await fixture(t), setup = setupDependencies({ source: false, ygVersion: version });
    const original = setup.dependencies.runCodex, previous = process.env.CODEX_HOME;
    let registered = false;
    setup.dependencies.runCodex = async args => {
      const result = await original(args);
      if (args.slice(0, 3).join(' ') === 'plugin marketplace add') registered = true;
      if (args.join(' ') === 'plugin list --json' && !registered) return { installed: result.installed.filter(item => item.pluginId !== 'yg-toolkit@yg') };
      return result;
    };
    process.env.CODEX_HOME = join(f.root, 'isolated-empty-profile');
    try { await assert.rejects(installToolkit({ bundleRoot: f.root }, setup.dependencies), version === '0.4.0' ? /不自动降级/ : /同版本安装缓存/); }
    finally { previous === undefined ? delete process.env.CODEX_HOME : process.env.CODEX_HOME = previous; }
    assert.equal(setup.calls.some(call => call.method === 'plugin/install' || call.method === 'config/value/write'), false);
    assert.equal(setup.records[0].version, version); assert.equal(setup.records[1].enabled, true);
  });
}

test('YG降级被拒绝，安装失败也不先停用旧Issue', async t => {
  const f = await fixture(t), setup = setupDependencies({ ygVersion: '0.4.0' });
  await assert.rejects(installToolkit({ bundleRoot: f.root }, setup.dependencies), /不自动降级/);
  assert.equal(setup.calls.some(call => call.method), false);
  const failed = setupDependencies(); failed.dependencies.createClient = async () => ({ request: async method => { failed.calls.push({ method }); if (method === 'config/read') return { config: { plugins: { 'issue-hub@yg': { enabled: true } } } }; throw new Error('安装未完成'); }, close: async () => {} });
  await assert.rejects(installToolkit({ bundleRoot: f.root }, failed.dependencies), /安装未完成/); assert.equal(failed.records[1].enabled, true); assert.ok(failed.calls.some(call => call.method === 'plugin/install')); assert.equal(failed.calls.some(call => call.method === 'config/value/write'), false);
});

test('旧源条目被移除而CLI不枚举时，仍按明确配置停用旧自有入口', async t => {
  const f = await fixture(t), setup = setupDependencies(), original = setup.dependencies.runCodex;
  setup.dependencies.runCodex = async args => { const result = await original(args); return args.join(' ') === 'plugin list --json' ? { installed: result.installed.filter(item => item.pluginId !== 'issue-hub@yg') } : result; };
  const result = await installToolkit({ bundleRoot: f.root }, setup.dependencies);
  assert.deepEqual(result.legacyDisabled, ['issue-hub@yg']); assert.equal(setup.records[1].enabled, false); assert.equal(setup.records[2].enabled, true);
});

test('已核实同版缓存只复用安装，可继续停用旧入口且gh警告不阻断', async t => {
  const f = await fixture(t), setup = setupDependencies({ ygVersion: '0.3.0' }), previous = process.env.CODEX_HOME, home = join(f.root, 'profile');
  for (const entry of f.manifest.files) { const relative = entry.path.slice('plugins/yg-toolkit/'.length), target = join(home, 'plugins/cache/yg/yg-toolkit/0.3.0', relative); await mkdir(dirname(target), { recursive: true }); await copyFile(join(f.plugin, relative), target); }
  process.env.CODEX_HOME = home; setup.dependencies.inspectEnvironment = environment(['未找到gh，Issue需要单独准备']);
  try { const result = await installToolkit({ bundleRoot: f.root }, setup.dependencies); assert.equal(result.alreadyInstalled, true); assert.equal(result.installed, true); assert.equal(result.warnings.length, 2); assert.deepEqual(result.legacyDisabled, ['issue-hub@yg']); }
  finally { previous === undefined ? delete process.env.CODEX_HOME : process.env.CODEX_HOME = previous; }
  assert.equal(setup.calls.some(call => call.method === 'plugin/install'), false);
});

test('同版缓存无法核对时不覆盖安装，也不停用旧入口', async t => {
  const f = await fixture(t), setup = setupDependencies({ ygVersion: '0.3.0' }), previous = process.env.CODEX_HOME;
  process.env.CODEX_HOME = join(f.root, 'empty-profile');
  try { await assert.rejects(installToolkit({ bundleRoot: f.root }, setup.dependencies)); }
  finally { previous === undefined ? delete process.env.CODEX_HOME : process.env.CODEX_HOME = previous; }
  assert.equal(setup.calls.some(call => call.method && call.method !== 'config/read'), false); assert.equal(setup.records[1].enabled, true);
});
