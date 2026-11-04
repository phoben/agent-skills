import { spawn } from 'node:child_process';
import { stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { findCodexCommand } from '../../../token-usage/src/codex-bridge.mjs';
import { ProofError, requireValue } from '../errors.mjs';
import { VERSION } from '../version.mjs';

const allowed = new Set(['initialize', 'project/list', 'account/read', 'account/rateLimits/read', 'thread/list', 'thread/items/list', 'thread/read']);

export async function resolveCodexCommand({ codexBin = process.env.ISSUE_HUB_CODEX_BIN, resolver } = {}) {
  if (resolver) return resolver();
  if (codexBin) {
    requireValue(typeof codexBin === 'string' && isAbsolute(codexBin) && (process.platform !== 'win32' || /\.exe$/i.test(codexBin)), 'HOST_PROGRAM_INVALID', '显式 Codex 路径必须指向绝对可执行文件。');
    return { command: codexBin, args: [] };
  }
  return findCodexCommand();
}

export function createHostBridge({ codexHome = resolve(process.env.CODEX_HOME || join(homedir(), '.codex')), spawnProcess = spawn, commandResolver, readAuthFile = readFile, timeoutMs = 18000, maxLineBytes = 8 * 1024 * 1024 } = {}) {
  let child, startup, stopped = false, serial = 0, buffer = '', startupFingerprint;
  const pending = new Map();
  async function fingerprint() {
    const values = await Promise.all(['auth.json', 'config.toml'].map(async name => {
      try { const entry = await stat(join(codexHome, name)); return [name, entry.size, entry.mtimeMs]; } catch { return [name, null]; }
    }));
    return createHash('sha256').update(JSON.stringify([codexHome, values])).digest('hex');
  }
  function fail(code = 'HOST_CLOSED') {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new ProofError(code, 'Codex 连接已关闭或不可用。')); }
    pending.clear();
  }
  function dispose(code = 'HOST_CLOSED') {
    const previous = child; child = undefined; buffer = ''; fail(code);
    if (previous) { previous.stdin.end(); const timer = setTimeout(() => previous.kill(), 1500); timer.unref(); previous.once('exit', () => clearTimeout(timer)); }
  }
  function rpc(method, params) {
    requireValue(allowed.has(method), 'METHOD_FORBIDDEN', '该宿主方法不在验证允许范围。');
    requireValue(child && !stopped, 'HOST_CLOSED', 'Codex 连接已关闭。');
    const active = child;
    return new Promise((resolveRequest, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); reject(new ProofError('HOST_TIMEOUT', 'Codex 读取超时。')); dispose(); }, timeoutMs);
      timer.unref(); pending.set(id, { resolve: resolveRequest, reject, timer });
      active.stdin.write(`${JSON.stringify({ id, method, ...(params === undefined ? {} : { params }) })}\n`, error => {
        if (error && pending.has(id)) { clearTimeout(timer); pending.delete(id); reject(new ProofError('HOST_CLOSED', 'Codex 请求无法发送。')); dispose(); }
      });
    });
  }
  async function ensure() {
    requireValue(!stopped, 'HOST_CLOSED', 'Codex 连接已关闭。');
    if (startup) return startup;
    startup = (async () => {
      const currentFingerprint = await fingerprint();
      requireValue(!stopped, 'HOST_CLOSED', 'Codex 连接已关闭。');
      if (child && currentFingerprint === startupFingerprint) return { child, fingerprint: startupFingerprint };
      // 只关闭本桥接创建的旧子进程；在途旧上下文读取明确失败，不跨连接认领结果。
      if (child) dispose('HOST_CONTEXT_CHANGED');
      startupFingerprint = currentFingerprint;
      const target = await resolveCodexCommand({ resolver: commandResolver });
      requireValue(!stopped, 'HOST_CLOSED', 'Codex 连接已关闭。');
      const active = spawnProcess(target.command, [...target.args, 'app-server', '--stdio'], { shell: false, windowsHide: true, env: { ...process.env, CODEX_HOME: codexHome }, stdio: ['pipe', 'pipe', 'pipe'] });
      child = active;
      const broken = () => { if (child === active) { dispose(); } };
      for (const stream of [active.stdin, active.stdout, active.stderr]) stream.on('error', broken);
      active.on('error', broken); active.on('exit', broken); active.stderr.on('data', () => {});
      active.stdout.setEncoding('utf8');
      active.stdout.on('data', chunk => {
        if (child !== active) return;
        buffer += chunk;
        if (Buffer.byteLength(buffer) > maxLineBytes) { dispose(); return; }
        let newline;
        while ((newline = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
          if (!line.trim()) continue;
          let message; try { message = JSON.parse(line); } catch { dispose(); return; }
          const request = pending.get(message.id); if (!request) continue;
          pending.delete(message.id); clearTimeout(request.timer);
          if (message.error) request.reject(new ProofError('HOST_REQUEST_FAILED', '当前 Codex 版本未能完成该读取。'));
          else request.resolve(message.result);
        }
      });
      await rpc('initialize', { clientInfo: { name: 'issue_hub_host_proof', version: VERSION }, capabilities: { experimentalApi: true } });
      active.stdin.write(`${JSON.stringify({ method: 'initialized' })}\n`);
      requireValue(await fingerprint() === currentFingerprint, 'HOST_CONTEXT_CHANGED', 'Codex 配置正在变化，请重试读取。');
      return { child: active, fingerprint: currentFingerprint };
    })().catch(error => { dispose(); throw error instanceof ProofError ? error : new ProofError('HOST_UNAVAILABLE', '无法连接 Codex，请检查宿主是否可用。'); }).finally(() => { startup = undefined; });
    return startup;
  }
  async function scopedRequest(method, params) {
    requireValue(allowed.has(method) && method !== 'initialize', 'METHOD_FORBIDDEN', '该宿主方法不在验证允许范围。');
    const connection = await ensure();
    requireValue(child === connection.child && !stopped, 'HOST_CONTEXT_CHANGED', 'Codex 连接已切换，请重新读取。');
    const value = await rpc(method, params);
    if (await fingerprint() !== connection.fingerprint) {
      if (child === connection.child) dispose('HOST_CONTEXT_CHANGED');
      throw new ProofError('HOST_CONTEXT_CHANGED', 'Codex 配置已变化，旧上下文结果已忽略，请重试读取。');
    }
    requireValue(child === connection.child && !stopped, 'HOST_CONTEXT_CHANGED', 'Codex 连接已切换，旧结果已忽略。');
    return { value, fingerprint: connection.fingerprint };
  }
  async function request(method, params) { return (await scopedRequest(method, params)).value; }
  async function authStoreAccount() {
    let raw;
    try { raw = await readAuthFile(join(codexHome, 'auth.json'), 'utf8'); }
    catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw new ProofError('HOST_IDENTITY_UNAVAILABLE', '无法读取当前 Codex 登录状态，会话操作暂不可用。');
    }
    requireValue(typeof raw === 'string' && Buffer.byteLength(raw) <= 1024 * 1024, 'HOST_IDENTITY_UNAVAILABLE', '当前 Codex 登录状态格式不可识别。');
    let value;
    try { value = JSON.parse(raw); }
    catch { throw new ProofError('HOST_IDENTITY_UNAVAILABLE', '当前 Codex 登录状态格式不可识别。'); }
    requireValue(value && typeof value === 'object' && !Array.isArray(value), 'HOST_IDENTITY_UNAVAILABLE', '当前 Codex 登录状态格式不可识别。');
    requireValue(!value.OPENAI_API_KEY && (value.auth_mode === undefined || value.auth_mode === null || value.auth_mode === 'chatgpt'), 'HOST_IDENTITY_UNAVAILABLE', '当前登录方式不能提供可验证的 Codex 会话账户。');
    const accountId = value.auth_mode === 'chatgpt' ? value.tokens?.account_id : null;
    return typeof accountId === 'string' && accountId.trim() && accountId.length <= 256 ? accountId : null;
  }
  async function identityDetails() {
    requireValue(!stopped, 'HOST_CLOSED', 'Codex 连接已关闭。');
    const before = await fingerprint();
    if (child && startupFingerprint !== before) dispose('HOST_CONTEXT_CHANGED');
    let accountId = await authStoreAccount(), source = 'auth-store';
    if (!accountId) {
      // 官方账户读取不主动刷新令牌；额度是独立网络功能，不作为身份前置条件。
      let value;
      try { value = (await scopedRequest('account/read', { refreshToken: false })).value; }
      catch (error) {
        if (['HOST_CONTEXT_CHANGED', 'HOST_CLOSED'].includes(error?.code)) throw error;
        throw new ProofError('HOST_IDENTITY_UNAVAILABLE', '无法确认当前 Codex 会话账户，请检查桌面登录状态。');
      }
      accountId = value?.account?.type === 'chatgpt' ? value.workspaceRouting?.chatgptAccountId : null;
      source = 'account-rpc';
    }
    if (await fingerprint() !== before) {
      if (child) dispose('HOST_CONTEXT_CHANGED');
      throw new ProofError('HOST_CONTEXT_CHANGED', 'Codex 登录或配置正在变化，旧身份结果已忽略。');
    }
    requireValue(!stopped, 'HOST_CLOSED', 'Codex 连接已关闭。');
    requireValue(typeof accountId === 'string' && accountId.trim().length > 0 && accountId.length <= 256, 'HOST_IDENTITY_UNAVAILABLE', '无法确认当前 Codex 身份，暂停会话操作。');
    const normalizedHome = process.platform === 'win32' ? resolve(codexHome).toLowerCase() : resolve(codexHome);
    // 连接指纹只管在途结果，持久归属独立于配置、令牌更新时间和插件版本。
    const identity = createHash('sha256').update(JSON.stringify(['issue-hub-codex-identity-v2', normalizedHome, accountId])).digest('hex');
    // 本机账户与旧额度快照账户的同义性未被证明，不猜测或枚举旧指纹作用域。
    return { identity, legacyIdentity: null, version: 2, source };
  }
  async function identity() { return (await identityDetails()).identity; }
  async function close() { stopped = true; dispose(); await startup?.catch(() => {}); dispose(); }
  return { request, identity, identityDetails, close };
}
