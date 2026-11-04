import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createCatalog, inspectGit, parseGithubRemote } from '../src/catalog.mjs';
import { ProofError } from '../src/errors.mjs';
import { temporary } from './helpers.mjs';

test('GitHub远端按仓库去重，拒绝凭据与其他域名', () => {
  const expected = parseGithubRemote('git@github.com:Owner/Repo.git');
  assert.equal(expected.key, parseGithubRemote('https://github.com/owner/repo').key);
  assert.equal(expected.key, parseGithubRemote('ssh://git@github.com/Owner/Repo.git').key);
  assert.equal(expected.key, parseGithubRemote('https://github.com/Owner/Repo.git/').key);
  assert.equal(expected.key, parseGithubRemote('https://github.com/Owner/Repo/').key);
  for (const raw of ['https://token@github.com/a/b', 'https://github.com.evil/a/b', 'git@private.example:a/b', 'https://github.com/a/b/c', 'https://github.com/a/b?token=secret', 'https://github.com/a/%2e%2e']) assert.equal(parseGithubRemote(raw), null);
});

test('真实临时Git仓库读取全部命名远端而不联网', async t => {
  const cwd = await temporary(t);
  const run = args => execFileSync('git', args, { cwd, stdio: 'pipe', windowsHide: true });
  run(['init']); run(['remote', 'add', 'origin', 'git@github.com:fixture/one.git']); run(['remote', 'add', 'upstream', 'https://github.com/fixture/two.git']);
  const result = await inspectGit(cwd);
  assert.deepEqual(result.repositories.map(entry => entry.fullName).sort(), ['fixture/one', 'fixture/two']);
});

test('分页目录保留同仓库的多个工作区，不用线程历史', async t => {
  const cwd = await temporary(t); const repository = parseGithubRemote('https://github.com/fixture/one'); const calls = [];
  const bridge = { request: async (method, params) => { calls.push([method, params]); return params.cursor ? { data: [{ id: 'p2', roots: [{ path: cwd }] }], nextCursor: null } : { data: [{ id: 'p1', roots: [{ path: cwd }] }], nextCursor: 'next' }; } };
  const catalog = createCatalog({ bridge, gitInspector: async () => ({ cwd, repositories: [repository] }) });
  const value = await catalog.refresh();
  assert.equal(value.status, 'complete'); assert.equal(value.projects, 2); assert.equal(value.repositories.length, 1); assert.equal(value.repositories[0].workspaces.length, 2);
  assert.ok(calls.every(([method]) => method === 'project/list'));
  await catalog.resolveWorkspace(repository.key, value.repositories[0].workspaces[0].key);
  await assert.rejects(catalog.resolveWorkspace(repository.key, 'unknown'), { code: 'WORKSPACE_UNKNOWN' });
});

test('发现异常保留具体失败分类，分页重复不伪造完整结果', async t => {
  const cwd = await temporary(t);
  const catalog = createCatalog({ bridge: { request: async () => ({ data: [{ id: 'p', roots: [{ path: cwd }] }] }) }, gitInspector: async () => { throw new ProofError('ROOT_ACCESS_FAILED', '不可读'); } });
  const value = await catalog.refresh(); assert.equal(value.status, 'partial'); assert.deepEqual(value.warnings, ['ROOT_ACCESS_FAILED']);
  const repeated = createCatalog({ bridge: { request: async () => ({ data: [], nextCursor: 'same' }) } });
  await assert.rejects(repeated.refresh(), { code: 'HOST_PROTOCOL' }); assert.equal(repeated.snapshot().status, 'unavailable');
});

test('工作区远端改变后不打开旧仓库任务', async t => {
  const cwd = await temporary(t); let current = parseGithubRemote('https://github.com/fixture/one');
  const catalog = createCatalog({ bridge: { request: async () => ({ data: [{ id: 'p', roots: [{ path: cwd }] }] }) }, gitInspector: async () => ({ cwd, repositories: [current] }) });
  const value = await catalog.refresh(); const old = value.repositories[0]; current = parseGithubRemote('https://github.com/fixture/other');
  await assert.rejects(catalog.resolveWorkspace(old.key, old.workspaces[0].key), { code: 'WORKSPACE_CHANGED' });
});
