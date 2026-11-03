import { spawn } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { delimiter, dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { UsageError } from './contracts.mjs';

const allowed = new Set(['initialize', 'account/read', 'account/usage/read', 'account/rateLimits/read']);
export function defaultCodexHome() { return resolve(process.env.CODEX_HOME || join(homedir(), '.codex')); }
async function exists(path) { try { await access(path); return true; } catch { return false; } }
export async function findCodexCommand() {
  const explicit = process.env.YG_TOKEN_CODEX_BIN;
  const candidates = explicit ? [resolve(explicit)] : (process.env.PATH || '').split(delimiter).flatMap(directory => process.platform === 'win32' ? [join(directory, 'codex.exe'), join(directory, 'codex.cmd')] : [join(directory, 'codex')]);
  for (const candidate of candidates) {
    if (!await exists(candidate)) continue;
    if (process.platform !== 'win32' || candidate.toLowerCase().endsWith('.exe')) return { command: candidate, args: [] };
    const packageRoot = join(dirname(candidate), 'node_modules', '@openai', 'codex');
    if (!await exists(join(packageRoot, 'package.json'))) continue;
    const architecture = process.arch === 'arm64' ? 'arm64' : 'x64';
    const triple = architecture === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
    try {
      const require = createRequire(join(packageRoot, 'package.json'));
      const native = join(dirname(require.resolve(`@openai/codex-win32-${architecture}/package.json`)), 'vendor', triple, 'bin', 'codex.exe');
      if (await exists(native)) return { command: native, args: [] };
    } catch { /* 兼容旧式安装，将已安装的Node入口作为回退。 */ }
    const entry = join(packageRoot, 'bin', 'codex.js');
    if (await exists(entry)) return { command: process.execPath, args: [entry] };
  }
  throw new UsageError('CODEX_UNAVAILABLE', '未找到可用的Codex命令。');
}

export function createCodexBridge({ codexHome = defaultCodexHome(), commandResolver = findCodexCommand, timeoutMs = 18000, spawnProcess = spawn } = {}) {
  let child, starting, fingerprint, serial = 0, accountCache, closed = false;
  const pending = new Map();
  async function authFingerprint() {
    return Promise.all(['auth.json', 'config.toml'].map(async name => {
      try { const value = await stat(join(codexHome, name)); return `${name}:${value.size}:${value.mtimeMs}`; } catch { return `${name}:missing`; }
    })).then(values => values.join('|'));
  }
  function rejectPending() {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new UsageError('CODEX_UNAVAILABLE', 'Codex连接已关闭。')); }
    pending.clear();
  }
  async function stop() {
    const previous = child; child = undefined; accountCache = undefined;
    rejectPending();
    if (previous) {
      previous.stdin.end();
      const timer = setTimeout(() => previous.kill(), 2500); timer.unref();
      previous.once('exit', () => clearTimeout(timer));
    }
  }
  function request(method, params) {
    if (!allowed.has(method)) throw new UsageError('METHOD_FORBIDDEN', '不支持该账号操作。');
    if (!child || closed) return Promise.reject(new UsageError('CODEX_UNAVAILABLE', 'Codex连接已关闭。'));
    return new Promise((resolveRequest, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); reject(new UsageError('CODEX_TIMEOUT', '账号读取超时。')); }, timeoutMs);
      timer.unref(); pending.set(id, { resolve: resolveRequest, reject, timer });
      child.stdin.write(JSON.stringify({ id, method, ...(params === undefined ? {} : { params }) }) + '\n', error => {
        if (error && pending.has(id)) { clearTimeout(timer); pending.delete(id); reject(new UsageError('CODEX_UNAVAILABLE', 'Codex连接不可用。')); }
      });
    });
  }
  async function ensure() {
    if (closed) throw new UsageError('CODEX_UNAVAILABLE', 'Codex连接已关闭。');
    const next = await authFingerprint();
    if (closed) throw new UsageError('CODEX_UNAVAILABLE', 'Codex连接已关闭。');
    if (starting) return starting;
    if (child && next === fingerprint) return;
    starting = (async () => {
      await stop(); fingerprint = next;
      const target = await commandResolver();
      if (closed) throw new UsageError('CODEX_UNAVAILABLE', 'Codex连接已关闭。');
      const processChild = spawnProcess(target.command, [...target.args, 'app-server', '--stdio'], {
        env: { ...process.env, CODEX_HOME: codexHome }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      });
      child = processChild;
      const pipeFailed = () => {
        if (child === processChild) { child = undefined; accountCache = undefined; rejectPending(); }
        try { processChild.kill(); } catch { /* 已退出的账号进程无需再次终止。 */ }
      };
      for (const stream of [processChild.stdin, processChild.stdout, processChild.stderr]) stream.on('error', pipeFailed);
      processChild.on('error', () => { if (child === processChild) { child = undefined; rejectPending(); } });
      processChild.on('exit', () => { if (child === processChild) { child = undefined; accountCache = undefined; rejectPending(); } });
      processChild.stderr.on('data', () => {});
      const lines = createInterface({ input: processChild.stdout });
      lines.on('error', pipeFailed);
      lines.on('line', line => {
        if (line.length > 8 * 1024 * 1024) return;
        let message; try { message = JSON.parse(line); } catch { return; }
        const waiter = pending.get(message.id); if (!waiter) return;
        clearTimeout(waiter.timer); pending.delete(message.id);
        if (message.error) waiter.reject(new UsageError('CODEX_REQUEST_FAILED', 'Codex暂未提供该账号信息。'));
        else waiter.resolve(message.result);
      });
      await request('initialize', { clientInfo: { name: 'yg_toolkit_usage', version: '0.2.0' }, capabilities: { experimentalApi: true } });
      processChild.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    })().finally(() => { starting = undefined; });
    return starting;
  }
  async function identity() {
    await ensure();
    const rates = await request('account/rateLimits/read');
    return { accountId: typeof rates?.accountId === 'string' && rates.accountId ? rates.accountId : null, rates };
  }
  async function snapshot({ refresh = false } = {}) {
    const before = await identity();
    if (!refresh && accountCache && accountCache.accountId === before.accountId && Date.now() - accountCache.cachedAt < 30000) return { ...accountCache, rates: before.rates };
    const results = await Promise.allSettled([request('account/read', { refreshToken: false }), request('account/usage/read')]);
    const after = await identity();
    if (before.accountId !== after.accountId) { accountCache = undefined; throw new UsageError('ACCOUNT_CHANGED', '当前账号已变化。'); }
    const account = results[0].status === 'fulfilled' ? results[0].value?.account : null;
    const usage = results[1].status === 'fulfilled' ? results[1].value : null;
    accountCache = { accountId: after.accountId, account, usage, rates: after.rates, cachedAt: Date.now() };
    return accountCache;
  }
  async function close() {
    closed = true;
    const startup = starting;
    await stop();
    if (startup) await startup.catch(() => {});
    await stop();
  }
  return { snapshot, identity, close };
}
