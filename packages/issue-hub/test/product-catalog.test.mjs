import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createCatalog, discoverGitRepositories, inspectGit, parseGithubRemote } from '../src/catalog.mjs';
import { temporary } from './helpers.mjs';

async function gitRepo(path, name) {
  await mkdir(path, { recursive: true });
  const git = args => execFileSync('git', args, { cwd: path, stdio: 'pipe', windowsHide: true });
  git(['init']); git(['remote', 'add', 'origin', `https://github.com/fixture/${name}.git`]);
  return path;
}

test('注册根下发现嵌套仓库，跳过依赖目录并保留多个路径', async t => {
  const root = await temporary(t);
  await gitRepo(join(root, 'one'), 'shared'); await gitRepo(join(root, 'nested', 'two'), 'shared');
  await gitRepo(join(root, 'node_modules', 'hidden'), 'hidden');
  const bridge = { request: async () => ({ data: [{ id: 'p', name: '项目', roots: [{ path: root }] }] }) };
  const catalog = createCatalog({ bridge }); const result = await catalog.refresh();
  assert.equal(result.status, 'complete'); assert.equal(result.repositories.length, 1);
  assert.equal(result.repositories[0].fullName, 'fixture/shared'); assert.equal(result.repositories[0].workspaces.length, 2);
  const workspace = result.repositories[0].workspaces[1];
  assert.equal((await catalog.resolveWorkspace(result.repositories[0].key, workspace.key)).workspace.cwd, workspace.cwd);
});

test('真实 worktree 的 .git 文件和同名远端多个 fetch URL 均可识别', async t => {
  const root = await temporary(t); const main = await gitRepo(join(root, 'main'), 'main');
  const git = args => execFileSync('git', args, { cwd: main, stdio: 'pipe', windowsHide: true });
  git(['-c', 'user.name=Issue Hub Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', '测试初始提交']);
  git(['worktree', 'add', '-b', 'test-worktree', join(root, 'worktree')]);
  git(['remote', 'set-url', '--add', 'origin', 'https://github.com/fixture/upstream.git']);
  const catalog = createCatalog({ bridge: { request: async () => ({ data: [{ id: 'p', roots: [{ path: root }] }] }) } });
  const result = await catalog.refresh();
  assert.deepEqual(result.repositories.map(item => item.fullName).sort(), ['fixture/main', 'fixture/upstream']);
  assert.ok(result.repositories.every(item => item.workspaces.length === 2));
});

test('正常深度边界结束搜索，目录数量保护仍保留内部分类', async t => {
  const root = await temporary(t); await gitRepo(join(root, 'one', 'two'), 'deep');
  const scan = await discoverGitRepositories(root, { maxDepth: 0 }); assert.deepEqual(scan.warnings, []); assert.equal(scan.scannedDirectories, 1);
  const catalog = createCatalog({ bridge: { request: async () => ({ data: [{ id: 'p', roots: [{ path: root }] }] }) }, discoveryOptions: { maxDirectories: 1 } });
  const result = await catalog.refresh(); assert.equal(result.status, 'partial'); assert.ok(result.warnings.includes('DIRECTORY_LIMIT'));
});

test('默认查找三层内的.git候选，不检查第四层或普通源码目录', async t => {
  const root = await temporary(t), calls = [];
  const third = await gitRepo(join(root, 'one', 'two', 'three'), 'third');
  await gitRepo(join(third, 'four'), 'outside-policy');
  await mkdir(join(root, 'source', 'feature', 'screens'), { recursive: true });
  const scan = await discoverGitRepositories(root, { gitInspector: async path => { calls.push(path); return inspectGit(path); } });
  assert.deepEqual(scan.infos.flatMap(info => info.repositories.map(repo => repo.fullName)), ['fixture/third']);
  assert.deepEqual(calls, [root, third]);
  assert.deepEqual(scan.warnings, []);
});

test('零层策略仍核验登记仓库，不读取子候选', async t => {
  const root = await temporary(t); await gitRepo(root, 'direct');
  await mkdir(join(root, 'broken'), { recursive: true });
  await writeFile(join(root, 'broken', '.git'), 'gitdir: missing-git-directory\n');
  const scan = await discoverGitRepositories(root, { maxDepth: 0 });
  assert.deepEqual(scan.infos.flatMap(info => info.repositories.map(repo => repo.fullName)), ['fixture/direct']);
  assert.deepEqual(scan.warnings, []); assert.equal(scan.scannedDirectories, 1);
});

test('固定范围内损坏的.git文件保留Git读取失败分类', async t => {
  const root = await temporary(t), broken = join(root, 'one', 'two', 'three');
  await mkdir(broken, { recursive: true }); await writeFile(join(broken, '.git'), 'gitdir: missing-git-directory\n');
  const scan = await discoverGitRepositories(root);
  assert.deepEqual(scan.infos, []); assert.deepEqual(scan.warnings, ['GIT_READ_FAILED']);
});

test('单独登记的更深仓库仍直接发现，重复root复用扫描', async t => {
  const root = await temporary(t), deep = await gitRepo(join(root, 'one', 'two', 'three', 'four'), 'registered-deep');
  const calls = [];
  const catalog = createCatalog({
    bridge: { request: async () => ({ data: [{ id: 'p', roots: [{ path: root }, { path: deep }, { path: deep }] }] }) },
    gitInspector: async path => { calls.push(path); return inspectGit(path); },
  });
  const result = await catalog.refresh();
  assert.deepEqual(result.repositories.map(repo => repo.fullName), ['fixture/registered-deep']);
  assert.equal(result.repositories[0].workspaces.length, 1); assert.equal(result.repositories[0].workspaces[0].cwd, deep);
  assert.equal(calls.filter(path => path === deep).length, 1); assert.deepEqual(result.warnings, []);
});

test('登记仓库子目录直接关联原仓库并保留原工作目录', async t => {
  const root = await temporary(t); await gitRepo(root, 'parent');
  const child = join(root, 'packages', 'app'); await mkdir(child, { recursive: true });
  const catalog = createCatalog({ bridge: { request: async () => ({ data: [{ id: 'p', roots: [{ path: child }] }] }) } });
  const result = await catalog.refresh(), repository = result.repositories[0];
  assert.equal(repository.fullName, 'fixture/parent'); assert.equal(repository.workspaces[0].cwd, child);
  assert.equal((await catalog.resolveWorkspace(repository.key, repository.workspaces[0].key)).workspace.cwd, child);
});

test('不跟随通向注册根外部的链接', async t => {
  const root = await temporary(t), external = await temporary(t); await gitRepo(join(external, 'secret'), 'external');
  try { await symlink(external, join(root, 'outside'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('当前账户不能创建目录链接'); return; } throw error; }
  const scan = await discoverGitRepositories(root); assert.equal(scan.infos.flatMap(item => item.repositories).length, 0);
});

async function mappedCatalog(t) {
  const first = await temporary(t), second = await temporary(t);
  const remotes = new Map([[first, 'fixture/old-name'], [second, 'fixture/current-name']]);
  const inspect = async path => ({ cwd: path, repositories: [parseGithubRemote(`https://github.com/${remotes.get(path)}`)] });
  const catalog = createCatalog({
    bridge: { request: async () => ({ data: [{ id: 'project', roots: [{ path: first }, { path: second }] }] }) },
    gitInspector: inspect,
    discover: async path => ({ infos: [await inspect(path)], warnings: [], authorizedRoot: path }),
  });
  await catalog.refresh();
  const mapping = catalog.snapshot({ raw: true }).repositories.map(repository => ({ key: repository.key, id: 12345, fullName: 'fixture/current-name' }));
  return { catalog, first, second, remotes, mapping };
}

test('GitHub稳定ID合并不同名称的仓库和工作区，重复归一幂等且保留原始快照', async t => {
  const f = await mappedCatalog(t);
  const raw = f.catalog.snapshot({ raw: true });
  const result = f.catalog.remap(f.mapping);
  assert.equal(result.repositories.length, 1);
  const repository = result.repositories[0];
  assert.equal(repository.key, createHash('sha256').update('github.com:id:12345').digest('hex').slice(0, 20));
  assert.equal(repository.fullName, 'fixture/current-name'); assert.equal(repository.workspaces.length, 2);
  assert.deepEqual(new Set(repository.sourceKeys), new Set(raw.repositories.map(item => item.key)));
  assert.deepEqual(new Set(repository.sourceNames), new Set(['fixture/old-name', 'fixture/current-name']));
  assert.deepEqual(f.catalog.remap(f.mapping), result);
  // 归一可推进全局显示修订，但原始发现的数据与来源修订必须保持不变。
  const { revision: currentRevision, ...rawAfter } = f.catalog.snapshot({ raw: true });
  const { revision: initialRevision, ...rawBefore } = raw;
  assert.ok(currentRevision >= initialRevision);
  assert.deepEqual(rawAfter, rawBefore);
  for (const workspace of repository.workspaces) {
    assert.equal(workspace.sourceKeys.length, 1);
    assert.equal((await f.catalog.resolveWorkspace(repository.key, workspace.key)).workspace.cwd, workspace.cwd);
  }
});

test('规范键可复核旧remote与已确认新名称，改为其他仓库则拒绝', async t => {
  const f = await mappedCatalog(t); const repository = f.catalog.remap(f.mapping).repositories[0];
  const firstWorkspace = repository.workspaces.find(item => item.cwd === f.first);
  await f.catalog.resolveWorkspace(repository.key, firstWorkspace.key);
  f.remotes.set(f.first, 'fixture/current-name');
  await f.catalog.resolveWorkspace(repository.key, firstWorkspace.key);
  f.remotes.set(f.first, 'fixture/unrelated');
  await assert.rejects(f.catalog.resolveWorkspace(repository.key, firstWorkspace.key), { code: 'WORKSPACE_CHANGED' });
});

test('改名刷新回到原始发现并由当前身份重映射，稳定键和工作区键不变', async t => {
  const f = await mappedCatalog(t); const before = f.catalog.remap(f.mapping).repositories[0];
  f.remotes.set(f.first, 'fixture/current-name');
  const refreshed = await f.catalog.refresh();
  assert.equal(refreshed.repositories.length, 1);
  assert.notEqual(refreshed.repositories[0].key, before.key);
  const mapping = f.catalog.snapshot({ raw: true }).repositories.map(item => ({ key: item.key, id: '12345', fullName: 'fixture/current-name' }));
  const after = f.catalog.remap(mapping).repositories[0];
  assert.equal(after.key, before.key);
  assert.deepEqual(new Set(after.workspaces.map(item => item.key)), new Set(before.workspaces.map(item => item.key)));
});

test('整轮重映射不保留其他账号规范元数据，未知映射或路径注入拒绝且状态不变', async t => {
  const f = await mappedCatalog(t); const normalized = f.catalog.remap(f.mapping);
  assert.throws(() => f.catalog.remap([{ key: 'a'.repeat(20), id: 555, fullName: 'fixture/unknown' }]), { code: 'CATALOG_MAPPING_UNKNOWN' });
  assert.throws(() => f.catalog.remap([{ ...f.mapping[0], cwd: '/not-discovered' }]), { code: 'CATALOG_MAPPING_INVALID' });
  assert.deepEqual(f.catalog.snapshot(), normalized);
  assert.deepEqual(f.catalog.remap([]).repositories, f.catalog.snapshot({ raw: true }).repositories);
  assert.equal(f.catalog.snapshot().repositories.some(item => item.id), false);
});
