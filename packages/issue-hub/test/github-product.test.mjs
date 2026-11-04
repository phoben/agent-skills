import test from 'node:test';
import assert from 'node:assert/strict';
import { createGithubClient } from '../src/github/client.mjs';

const response = (data, status = 200, headers = '') => `HTTP/2.0 ${status} OK\r\nContent-Type: application/json\r\n${headers}\r\n${JSON.stringify(data)}`;
test('gh API 固定主机、JSON通过stdin且无shell参数拼接', async () => {
  const calls = [];
  const github = createGithubClient({ run: async (args, input, options) => { calls.push({ args, input, options }); return { stdout: response({ number: 1 }) }; } });
  const body = { title: '中文 $(do-not-run)', body: '正文\n第二行' };
  await github.request('POST', '/repos/team/repo/issues', body);
  assert.equal(calls[0].input, JSON.stringify(body));
  assert.ok(calls[0].args.includes('--include')); assert.ok(calls[0].args.includes('github.com'));
  assert.ok(!calls[0].args.some(arg => arg.includes('do-not-run')));
  await assert.rejects(github.request('GET', 'https://other.test/token'), { code: 'GITHUB_PATH' });
});
test('限流与权限、身份失效和网络结果未知分别归类', async () => {
  for (const [status, headers, expected] of [[403, 'X-RateLimit-Remaining: 0\r\nX-RateLimit-Reset: 1900000000\r\n', 'RATE_LIMITED'], [403, '', 'PERMISSION_DENIED'], [401, '', 'AUTH_REQUIRED'], [422, '', 'VALIDATION_FAILED']]) {
    const github = createGithubClient({ run: async () => { throw Object.assign(new Error(), { stdout: response({}, status, headers) }); } });
    await assert.rejects(github.request('POST', '/repos/team/repo/issues', {}), { code: expected });
  }
  const network = createGithubClient({ run: async () => { throw new Error('token-secret-must-not-leak'); } });
  await assert.rejects(network.request('POST', '/repos/team/repo/issues', {}), error => error.code === 'WRITE_UNKNOWN' && !error.message.includes('token-secret'));
});
test('身份凭据只返回散列不返回token', async () => {
  const github = createGithubClient({ run: async args => ({ stdout: args[0] === 'auth' ? 'ghp_never-store-this-secret\n' : response({ id: 8, login: 'member', name: '成员' }) }) });
  const account = await github.identity(); assert.equal(account.id, 8); assert.match(account.credentialFingerprint, /^[a-f0-9]{64}$/); assert.ok(!JSON.stringify(account).includes('ghp_'));
});
test('同凭据并发身份查询合并但完成后不缓存远端身份', async () => {
  let release, userRequests = 0;
  const gate = new Promise(resolve => release = resolve);
  const github = createGithubClient({ run: async args => {
    if (args[0] === 'auth') return { stdout: 'secret-not-logged' };
    userRequests++; await gate; return { stdout: response({ id: 8, login: 'member' }) };
  } });
  const first = github.identity(), second = github.identity();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(userRequests, 1);
  release(); await Promise.all([first, second]);
  await github.identity(); assert.equal(userRequests, 2);
});
