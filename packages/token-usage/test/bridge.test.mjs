import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCodexBridge } from '../src/codex-bridge.mjs';
import { EventEmitter } from 'node:events';
import { Writable, PassThrough } from 'node:stream';

test('并发请求等待初始化，认证文件元数据变化后重建账号快照', async () => {
  const home = await mkdtemp(join(tmpdir(), 'yg-usage-auth-'));
  await writeFile(join(home, 'auth.json'), JSON.stringify({ account: 'test-a' }));
  const bridge = createCodexBridge({ codexHome: home, commandResolver: async () => ({ command: process.execPath, args: [fileURLToPath(new URL('./fixtures/codex-rpc.mjs', import.meta.url))] }) });
  try {
    const [first, identity] = await Promise.all([bridge.snapshot(), bridge.identity()]);
    assert.equal(first.accountId, 'test-a'); assert.equal(identity.accountId, 'test-a'); assert.equal(first.usage.summary.lifetimeTokens, 100);
    await writeFile(join(home, 'auth.json'), JSON.stringify({ account: 'test-b' }));
    const later = new Date(Date.now() + 1000); await utimes(join(home, 'auth.json'), later, later);
    const second = await bridge.snapshot();
    assert.equal(second.accountId, 'test-b'); assert.equal(second.usage.summary.lifetimeTokens, 200);
  } finally { await bridge.close(); await rm(home, { recursive: true, force: true }); }
});

test('App Server写端提前关闭时返回安全错误，不产生未处理EPIPE', async () => {
  const home = await mkdtemp(join(tmpdir(), 'yg-usage-pipe-'));
  const bridge = createCodexBridge({ codexHome: home, commandResolver: async () => ({ command: 'fixture', args: [] }), spawnProcess: () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.stdin = new Writable({ write(chunk, encoding, callback) { callback(Object.assign(new Error('测试写端已关闭'), { code: 'EPIPE' })); } });
    child.kill = () => { child.emit('exit', 1); return true; };
    return child;
  } });
  try { await assert.rejects(bridge.identity(), { code: 'CODEX_UNAVAILABLE' }); await new Promise(resolve => setImmediate(resolve)); }
  finally { await bridge.close(); await rm(home, { recursive: true, force: true }); }
});

test('发现命令期间关闭连接，不再启动账号进程', async () => {
  const home = await mkdtemp(join(tmpdir(), 'yg-usage-close-'));
  let release, entered;
  const discovering = new Promise(resolve => { entered = resolve; });
  const command = new Promise(resolve => { release = resolve; });
  let spawned = 0;
  const bridge = createCodexBridge({ codexHome: home, commandResolver: () => { entered(); return command; }, spawnProcess: () => { spawned++; throw new Error('不应启动'); } });
  const pending = bridge.identity();
  const rejected = assert.rejects(pending, { code: 'CODEX_UNAVAILABLE' });
  await discovering;
  const closing = bridge.close();
  release({ command: 'fixture', args: [] });
  await Promise.all([closing, rejected]);
  assert.equal(spawned, 0);
  await rm(home, { recursive: true, force: true });
});
