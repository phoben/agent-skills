import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ProofError, requireValue } from './errors.mjs';
import { samePath } from './catalog.mjs';

const execFileAsync = promisify(execFile);
export const isThreadId = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export const taskMarker = nonce => `任务引用：issue-hub:${nonce}`;

export function draftUri(cwd, prompt) {
  const url = new URL('codex://new'); url.search = new URLSearchParams({ mode: 'codex', path: cwd, prompt }).toString();
  requireValue(Buffer.byteLength(url.href) <= 7500, 'LINK_TOO_LONG', '草稿链接过长，不能安全打开。');
  return url.href;
}

export async function openCodexUri(uri) {
  const url = new URL(uri);
  requireValue(url.protocol === 'codex:' && ['new', 'threads'].includes(url.hostname), 'LINK_FORBIDDEN', '只允许打开受控 Codex 链接。');
  requireValue(process.platform === 'win32', 'PLATFORM_UNSUPPORTED', '本验证包只支持 Windows 系统打开。');
  await execFileAsync(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'rundll32.exe'), ['url.dll,FileProtocolHandler', uri], { shell: false, windowsHide: true, timeout: 8000, maxBuffer: 4096 });
}

export function createRequestStore(path) {
  let queue = Promise.resolve();
  async function read() {
    let raw;
    try { raw = await readFile(path, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return { schemaVersion: 1, requests: [] }; throw new ProofError('STATE_UNAVAILABLE', '无法读取本机验证请求。'); }
    requireValue(Buffer.byteLength(raw) <= 2 * 1024 * 1024, 'STATE_INVALID', '本机请求文件超过允许大小。');
    let value; try { value = JSON.parse(raw); } catch { throw new ProofError('STATE_INVALID', '本机验证请求格式无效。'); }
    requireValue(value?.schemaVersion === 1 && Array.isArray(value.requests) && value.requests.length <= 128, 'STATE_INVALID', '本机验证请求格式无效。');
    return value;
  }
  function transaction(callback) {
    const operation = queue.then(async () => {
      const state = await read(); const result = await callback(state);
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(state), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, path);
      return result;
    });
    queue = operation.catch(() => {}); return operation;
  }
  const snapshot = () => queue.then(read);
  return { transaction, snapshot };
}

export function createTaskProof({ catalog, bridge, store, openUri = openCodexUri, now = Date.now, maxCandidates = 30 } = {}) {
  const projection = request => ({ requestId: request.requestId, repositoryKey: request.repositoryKey, workspaceKey: request.workspaceKey, status: request.status, prompt: request.prompt, threadId: request.threadId || null, checkedCandidates: request.checkedCandidates || 0, coverage: request.coverage || 'not-checked' });
  async function owned(state, requestId) {
    const request = state.requests.find(entry => entry.requestId === requestId);
    requireValue(request, 'REQUEST_UNKNOWN', '没有此验证请求。');
    requireValue(request.identityKey === await bridge.identity(), 'IDENTITY_CHANGED', 'Codex 身份已变化，不能读取或打开旧请求。');
    return request;
  }
  async function prepare({ repositoryKey, workspaceKey, requestId }) {
    const { workspace, repository } = await catalog.resolveWorkspace(repositoryKey, workspaceKey);
    const identityKey = await bridge.identity();
    return store.transaction(state => {
      const existing = state.requests.find(entry => entry.requestId === requestId);
      if (existing) {
        requireValue(existing.identityKey === identityKey && existing.repositoryKey === repositoryKey && existing.workspaceKey === workspaceKey, 'REQUEST_REUSED', '该请求标识已绑定其他操作。');
        return projection(existing);
      }
      requireValue(state.requests.length < 128, 'REQUEST_LIMIT', '本机验证请求达到上限，请先处理现有请求。');
      const nonce = randomUUID();
      const prompt = `${taskMarker(nonce)}\n这是一条 Issue Hub 宿主验证消息。\n仓库：${repository.fullName}\n请仅回复“宿主验证收到”，不要读取或修改项目文件，不运行命令，不提交推送或操作 GitHub。`;
      const request = { requestId, nonce, identityKey, repositoryKey, workspaceKey, projectId: workspace.projectId, cwd: workspace.cwd, createdAt: now(), prompt, status: 'prepared' };
      state.requests.push(request); return projection(request);
    });
  }
  async function latest({ repositoryKey, workspaceKey }) {
    const { workspace } = await catalog.resolveWorkspace(repositoryKey, workspaceKey);
    const identityKey = await bridge.identity();
    const state = await store.snapshot();
    const entries = state.requests.filter(entry => entry?.identityKey === identityKey && entry.repositoryKey === repositoryKey && entry.workspaceKey === workspaceKey && typeof entry.cwd === 'string' && samePath(entry.cwd, workspace.cwd) && entry.projectId === workspace.projectId && Number.isFinite(entry.createdAt));
    entries.reverse().sort((left, right) => right.createdAt - left.createdAt);
    requireValue(identityKey === await bridge.identity(), 'IDENTITY_CHANGED', '恢复期间 Codex 身份已变化，未返回旧请求。');
    return entries.length ? projection(entries[0]) : null;
  }
  async function open({ requestId }) {
    return store.transaction(async state => {
      const request = await owned(state, requestId);
      const { workspace } = await catalog.resolveWorkspace(request.repositoryKey, request.workspaceKey);
      requireValue(samePath(workspace.cwd, request.cwd), 'WORKSPACE_CHANGED', '验证请求的工作区已变化。');
      if (request.threadId) {
        requireValue(isThreadId(request.threadId), 'THREAD_INVALID', '关联聊天标识无效。');
        const read = await bridge.request('thread/read', { threadId: request.threadId, includeTurns: false });
        requireValue(read?.thread?.id === request.threadId && typeof read.thread.cwd === 'string' && samePath(read.thread.cwd, request.cwd) && (!read.thread.projectId || read.thread.projectId === request.projectId), 'THREAD_CHANGED', '关联聊天不再属于预期工作区。');
        requireValue(request.identityKey === await bridge.identity(), 'IDENTITY_CHANGED', '操作期间 Codex 身份已变化。');
        await openUri(`codex://threads/${request.threadId}`);
        return { ...projection(request), navigation: 'requested' };
      }
      if (request.status !== 'prepared') return { ...projection(request), navigation: 'already-requested' };
      // 先持久化请求状态，避免系统已接收链接但响应丢失时重复打开。
      request.status = 'requested';
      return { ...projection(request), navigation: 'ready-to-open', uri: draftUri(request.cwd, request.prompt), expectedIdentity: request.identityKey };
    }).then(async result => {
      if (!result.uri) return result;
      requireValue(result.expectedIdentity === await bridge.identity(), 'IDENTITY_CHANGED', '打开前 Codex 身份已变化，未发送打开请求。');
      try { await openUri(result.uri); } catch { throw new ProofError('OPEN_UNCONFIRMED', '打开请求结果未确认，请先检查桌面草稿，勿连续重复打开。'); }
      const { uri: _uri, expectedIdentity: _identity, ...safe } = result; return { ...safe, navigation: 'requested' };
    });
  }
  async function check({ requestId }) {
    return store.transaction(async state => {
      const request = await owned(state, requestId);
      await catalog.resolveWorkspace(request.repositoryKey, request.workspaceKey);
      if (request.threadId) {
        requireValue(request.identityKey === await bridge.identity(), 'IDENTITY_CHANGED', '恢复关联期间 Codex 身份已变化。');
        return projection(request);
      }
      requireValue(request.status !== 'prepared', 'REQUEST_NOT_OPENED', '请先打开并发送验证草稿，再检查关联。');
      requireValue(now() - request.createdAt <= 24 * 60 * 60 * 1000, 'REQUEST_EXPIRED', '验证请求已过期，请另建验证请求。');
      const list = await bridge.request('thread/list', { cwd: request.cwd, projectId: request.projectId, sortKey: 'created_at', sortDirection: 'desc', useStateDbOnly: true, limit: maxCandidates });
      requireValue(Array.isArray(list?.data), 'HOST_PROTOCOL', '聊天候选格式不可识别。');
      const candidates = list.data.filter(thread => typeof thread?.cwd === 'string' && samePath(thread.cwd, request.cwd) && isThreadId(thread.id) && Number.isFinite(thread.createdAt) && thread.createdAt * 1000 >= request.createdAt - 2000 && (!thread.projectId || thread.projectId === request.projectId));
      const matches = []; let incomplete = Boolean(list.nextCursor), checked = 0;
      for (const thread of candidates.slice(0, maxCandidates)) {
        const result = await bridge.request('thread/items/list', { threadId: thread.id, sortDirection: 'asc', limit: 8 });
        requireValue(Array.isArray(result?.data), 'HOST_PROTOCOL', '聊天初始项格式不可识别。');
        const first = result.data.find(item => item?.type === 'userMessage');
        if (!first) { if (result.nextCursor) incomplete = true; continue; }
        requireValue(Array.isArray(first.content), 'HOST_PROTOCOL', '聊天用户项格式不可识别。');
        const text = first.content.filter(part => part?.type === 'text' && typeof part.text === 'string').map(part => part.text).join('\n');
        checked++;
        if (text.split(/\r?\n/, 1)[0] === taskMarker(request.nonce)) matches.push(thread.id);
      }
      requireValue(request.identityKey === await bridge.identity(), 'IDENTITY_CHANGED', '查询期间 Codex 身份已变化，未保存关联。');
      request.checkedCandidates = checked;
      request.coverage = incomplete ? 'partial' : 'complete';
      if (matches.length > 1) request.status = 'ambiguous';
      else if (matches.length === 1 && !incomplete) { request.status = 'linked'; request.threadId = matches[0]; }
      else request.status = 'waiting-for-send';
      return projection(request);
    });
  }
  return { prepare, latest, open, check };
}
