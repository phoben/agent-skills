import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createCatalog, discoverGitRepositories, parseGithubRemote } from '../src/catalog.mjs';
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

test('扫描目录或深度达到上限时标部分覆盖，不声称已发现全部', async t => {
  const root = await temporary(t); await gitRepo(join(root, 'one', 'two'), 'deep');
  const scan = await discoverGitRepositories(root, { maxDepth: 0 }); assert.ok(scan.warnings.includes('DIRECTORY_DEPTH_LIMIT'));
  const catalog = createCatalog({ bridge: { request: async () => ({ data: [{ id: 'p', roots: [{ path: root }] }] }) }, discoveryOptions: { maxDirectories: 1 } });
  const result = await catalog.refresh(); assert.equal(result.status, 'partial'); assert.ok(result.warnings.includes('DIRECTORY_LIMIT'));
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
