import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { writeFile, stat, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { createHostBridge, resolveCodexCommand } from '../src/host/bridge.mjs';
import { temporary } from './helpers.mjs';

function fakeSpawn(handler) {
  return () => {
    const process = new EventEmitter(); process.stdin = new PassThrough(); process.stdout = new PassThrough(); process.stderr = new PassThrough();
    let stopped = false;
    process.kill = () => { if (!stopped) { stopped = true; queueMicrotask(() => process.emit('exit', 0)); } };
    process.stdin.on('finish', process.kill);
    process.stdin.on('data', raw => { const message = JSON.parse(raw.toString()); if (message.id) queueMicrotask(() => handler(process, message)); });
    return process;
  };
}
test('RPC严格限制只读方法并完成初始化', async t => {
  const methods = [], cwd = await temporary(t);
  const bridge = createHostBridge({ codexHome: cwd, commandResolver: async () => ({ command: 'fake', args: [] }), spawnProcess: fakeSpawn((child, message) => { methods.push(message.method); child.stdout.write(`${JSON.stringify({ id: message.id, result: message.method === 'project/list' ? { data: [] } : {} })}\n`); }) });
  t.after(() => bridge.close());
  await assert.rejects(bridge.request('thread/start', {}), { code: 'METHOD_FORBIDDEN' });
  assert.deepEqual(await bridge.request('project/list', {}), { data: [] });
  assert.deepEqual(methods, ['initialize', 'project/list']);
});
test('过大的协议帧会关闭连接且不返回私有载荷', async t => {
  const cwd = await temporary(t);
  const bridge = createHostBridge({ codexHome: cwd, maxLineBytes: 128, commandResolver: async () => ({ command: 'fake', args: [] }), spawnProcess: fakeSpawn((child, message) => child.stdout.write(`${JSON.stringify({ id: message.id, result: 'private'.repeat(100) })}\n`)) });
  t.after(() => bridge.close()); await assert.rejects(bridge.request('project/list'), { code: 'HOST_CLOSED' });
});
test('启动过程中关闭会阻止创建新进程', async t => {
  let release; let spawned = false; const cwd = await temporary(t);
  const bridge = createHostBridge({ codexHome: cwd, commandResolver: () => new Promise(resolve => { release = resolve; }), spawnProcess: () => { spawned = true; throw new Error('不应创建'); } });
  const pending = bridge.request('project/list');
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const closing = bridge.close(); release({ command: 'fake', args: [] });
  await assert.rejects(pending, { code: 'HOST_CLOSED' }); await closing; assert.equal(spawned, false);
});

test('配置mtime变化后只读重连，旧在途与迟到结果不跨连接返回', async t => {
  const cwd = await temporary(t), config = join(cwd, 'config.toml');
  await writeFile(config, 'model="fixture"\n');
  let spawned = 0, requested, held;
  const entered = new Promise(resolve => requested = resolve);
  const make = fakeSpawn((child, message) => {
    if (message.method === 'project/list' && child.instance === 1) { held = { child, message }; requested(); return; }
    child.stdout.write(`${JSON.stringify({ id: message.id, result: message.method === 'account/read' ? { account: { type: 'chatgpt' }, workspaceRouting: { chatgptAccountId: 'same-account' } } : message.method === 'project/list' ? { data: [{ connection: child.instance }] } : {} })}\n`);
  });
  const bridge = createHostBridge({ codexHome: cwd, commandResolver: async () => ({ command: 'fake', args: [] }), spawnProcess: () => { const child = make(); child.instance = ++spawned; return child; } });
  t.after(() => bridge.close());
  const initialIdentity = await bridge.identity();
  const old = bridge.request('project/list'); const rejected = assert.rejects(old, { code: 'HOST_CONTEXT_CHANGED' });
  await entered;
  const before = await stat(config); await utimes(config, before.atime, new Date(before.mtimeMs + 5000));
  const next = await bridge.request('project/list'); await rejected;
  assert.equal(spawned, 2); assert.equal(next.data[0].connection, 2);
  held.child.stdout.write(`${JSON.stringify({ id: held.message.id, result: { data: [{ connection: 'old-private-result' }] } })}\n`);
  assert.equal(await bridge.identity(), initialIdentity, '同账号配置变化不应改变持久身份');
  assert.equal((await bridge.request('project/list')).data[0].connection, 2);
});

test('认证文件刷新与服务重建保持稳定身份，账号或home改变仍隔离', async t => {
  const cwd = await temporary(t); let accountId = 'account-a';
  await writeFile(join(cwd, 'auth.json'), '{}');
  const make = codexHome => createHostBridge({ codexHome, commandResolver: async () => ({ command: 'fake', args: [] }), spawnProcess: fakeSpawn((child, message) => child.stdout.write(`${JSON.stringify({ id: message.id, result: message.method === 'account/read' ? { account: { type: 'chatgpt' }, workspaceRouting: { chatgptAccountId: accountId } } : {} })}\n`)) });
  const bridge = make(cwd); t.after(() => bridge.close());
  const first = await bridge.identityDetails();
  await writeFile(join(cwd, 'auth.json'), '{"refreshed":true}');
  const refreshed = await bridge.identityDetails();
  assert.equal(first.identity, refreshed.identity); assert.equal(first.legacyIdentity, null); assert.equal(refreshed.legacyIdentity, null);
  const rebuilt = make(cwd); t.after(() => rebuilt.close());
  assert.equal(await rebuilt.identity(), first.identity);
  accountId = 'account-b'; assert.notEqual(await bridge.identity(), first.identity);
  accountId = 'account-a'; const other = make(await temporary(t)); t.after(() => other.close());
  assert.notEqual(await other.identity(), first.identity);
});

test('公共Codex程序解析复用显式路径验证与测试注入', async () => {
  const absolute = process.platform === 'win32' ? 'C:\\Tools\\codex.exe' : '/opt/tools/codex';
  assert.deepEqual(await resolveCodexCommand({ codexBin: absolute }), { command: absolute, args: [] });
  await assert.rejects(resolveCodexCommand({ codexBin: 'relative/codex.exe' }), { code: 'HOST_PROGRAM_INVALID' });
  if (process.platform === 'win32') await assert.rejects(resolveCodexCommand({ codexBin: 'C:\\Tools\\codex.cmd' }), { code: 'HOST_PROGRAM_INVALID' });
  assert.deepEqual(await resolveCodexCommand({ resolver: async () => ({ command: 'test-command', args: ['fixture'] }) }), { command: 'test-command', args: ['fixture'] });
});

test('Codex身份不可用使用宿主专用错误，不冒充GitHub身份变化', async t => {
  const cwd = await temporary(t);
  const bridge = createHostBridge({ codexHome: cwd, commandResolver: async () => ({ command: 'fake', args: [] }), spawnProcess: fakeSpawn((child, message) => child.stdout.write(`${JSON.stringify({ id: message.id, result: {} })}\n`)) });
  t.after(() => bridge.close());
  await assert.rejects(bridge.identity(), { code: 'HOST_IDENTITY_UNAVAILABLE' });
});

test('额度接口失败或挂起时可信ChatGPT登录仍直接提供身份且不泄漏秘密', async t => {
  const cwd = await temporary(t), auth = join(cwd, 'auth.json');
  const secret = 'fixture-access-token-secret', account = 'fixture-chatgpt-account';
  await writeFile(auth, JSON.stringify({ auth_mode: 'chatgpt', OPENAI_API_KEY: null, tokens: { account_id: account, access_token: secret, refresh_token: 'fixture-refresh-secret', id_token: 'fixture-id-secret' } }));
  let spawned = 0, quotaCalls = 0;
  const bridge = createHostBridge({ codexHome: cwd, timeoutMs: 100, commandResolver: async () => ({ command: 'fake', args: [] }), spawnProcess: fakeSpawn((child, message) => {
    if (message.method === 'initialize') spawned++;
    if (message.method === 'account/rateLimits/read') { quotaCalls++; child.stdout.write(`${JSON.stringify({ id: message.id, error: { code: -32603, message: secret } })}\n`); return; }
    child.stdout.write(`${JSON.stringify({ id: message.id, result: {} })}\n`);
  }) });
  t.after(() => bridge.close());
  const details = await bridge.identityDetails();
  assert.equal(details.version, 2); assert.equal(details.source, 'auth-store'); assert.equal(details.legacyIdentity, null);
  assert.equal(quotaCalls, 0); assert.equal(spawned, 0, '本机身份不依赖AppServer或额度网络');
  for (const value of [secret, account, 'fixture-refresh-secret', 'fixture-id-secret']) assert.ok(!JSON.stringify(details).includes(value));
  await writeFile(auth, JSON.stringify({ auth_mode: 'chatgpt', tokens: { account_id: 'fixture-other-account', access_token: secret } }));
  assert.notEqual(await bridge.identity(), details.identity);
});

test('本机与官方account读取用同一v2身份域，认证读取中变化不能返回旧身份', async t => {
  const cwd = await temporary(t), auth = join(cwd, 'auth.json');
  const accountId = 'fixture-consistent-account';
  const bridge = createHostBridge({ codexHome: cwd, commandResolver: async () => ({ command: 'fake', args: [] }), spawnProcess: fakeSpawn((child, message) => child.stdout.write(`${JSON.stringify({ id: message.id, result: message.method === 'account/read' ? { account: { type: 'chatgpt' }, workspaceRouting: { chatgptAccountId: accountId } } : {} })}\n`)) });
  t.after(() => bridge.close());
  const rpc = await bridge.identityDetails();
  await writeFile(auth, JSON.stringify({ auth_mode: 'chatgpt', tokens: { account_id: accountId } }));
  const local = await bridge.identityDetails();
  assert.equal(local.identity, rpc.identity); assert.equal(local.source, 'auth-store');
  const changing = createHostBridge({ codexHome: cwd, readAuthFile: async (path, encoding) => {
    const { readFile } = await import('node:fs/promises'); const raw = await readFile(path, encoding);
    await writeFile(path, JSON.stringify({ auth_mode: 'chatgpt', tokens: { account_id: 'different-account-after-read' } }));
    return raw;
  } });
  t.after(() => changing.close());
  await assert.rejects(changing.identity(), { code: 'HOST_CONTEXT_CHANGED' });
});

test('APIkey或损坏登录文件不借用旧ChatGPT账号，也不暴露文件内容', async t => {
  const cwd = await temporary(t), auth = join(cwd, 'auth.json'), secret = 'fixture-api-secret';
  let spawned = 0;
  const bridge = createHostBridge({ codexHome: cwd, spawnProcess: () => { spawned++; throw new Error(secret); } });
  t.after(() => bridge.close());
  for (const content of [JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: secret }), `{"access_token":"${secret}"`, JSON.stringify({ auth_mode: 'chatgpt', OPENAI_API_KEY: secret, tokens: { account_id: 'untrusted-mixed-account' } })]) {
    await writeFile(auth, content);
    await assert.rejects(bridge.identity(), error => error.code === 'HOST_IDENTITY_UNAVAILABLE' && !error.message.includes(secret));
  }
  assert.equal(spawned, 0);
});
