import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ProofError, requireValue } from '../errors.mjs';
import { IMAGE_MAX_BYTES, normalizeImageUrl } from '../image-policy.mjs';

export class GithubError extends ProofError {}
const digest = value => createHash('sha256').update(value).digest('hex');
function execute(args, input, { command, timeout, maxBuffer, binary = false }) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { encoding: binary ? null : 'utf8', shell: false, windowsHide: true, timeout, maxBuffer, env: { ...process.env, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0', GH_PAGER: 'cat', NO_COLOR: '1' } }, (error, stdout, stderr) => {
      if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); } else resolve({ stdout, stderr });
    });
    child.stdin?.on('error', () => {});
    child.stdin?.end(input || '');
  });
}
function parseResponse(stdout) {
  const match = /^HTTP\/[\d.]+\s+(\d+)[^\r\n]*\r?\n([\s\S]*?)\r?\n\r?\n([\s\S]*)$/.exec(stdout || '');
  if (!match) throw new GithubError('GITHUB_PROTOCOL', 'GitHub 响应格式无法识别。');
  const headers = Object.fromEntries(match[2].split(/\r?\n/).filter(line => line.includes(':')).map(line => { const at = line.indexOf(':'); return [line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim()]; }));
  let data = null;
  try { data = match[3].trim() ? JSON.parse(match[3]) : null; } catch { throw new GithubError('GITHUB_PROTOCOL', 'GitHub 数据格式无法识别。'); }
  return { status: Number(match[1]), headers, data };
}
function classify(error, response, method) {
  const status = response?.status;
  const headers = response?.headers || {};
  if (status === 401) return new GithubError('AUTH_REQUIRED', 'GitHub 登录已失效，请运行 gh auth login 后重试。', { definitelyRejected: true });
  if (status === 429 || status === 403 && (headers['x-ratelimit-remaining'] === '0' || headers['retry-after'] || /rate limit|abuse|secondary/i.test(response?.data?.message || ''))) {
    const retryAt = headers['retry-after'] ? new Date(Date.now() + Number(headers['retry-after']) * 1000).toISOString() : headers['x-ratelimit-reset'] ? new Date(Number(headers['x-ratelimit-reset']) * 1000).toISOString() : null;
    return new GithubError('RATE_LIMITED', 'GitHub 暂时限流，当前内容和草稿已保留，请稍后手动重试。', { retryAt, definitelyRejected: true });
  }
  if (status === 403) return new GithubError('PERMISSION_DENIED', '当前 GitHub 身份无权执行此操作，可能需要组织授权。', { definitelyRejected: true });
  if (status === 404) return new GithubError('NOT_FOUND', '仓库或 Issue 不存在，或当前账号没有访问权限。', { definitelyRejected: true });
  if (status === 409 || status === 422) return new GithubError('VALIDATION_FAILED', 'GitHub 拒绝了当前内容或属性，请重新读取候选项后检查。', { definitelyRejected: true });
  if (error?.code === 'ENOENT') return new GithubError('GH_UNAVAILABLE', '未找到 GitHub CLI，请先安装 gh 并完成登录。', { definitelyRejected: true });
  if (!status || status >= 500) return new GithubError(method === 'GET' ? 'NETWORK_UNAVAILABLE' : 'WRITE_UNKNOWN', method === 'GET' ? '暂时无法连接 GitHub，正在保留本机内容。' : 'GitHub 写入结果未确认，请先在 GitHub 核对，避免重复创建。');
  return new GithubError('GITHUB_REJECTED', 'GitHub 未接受本次操作，请重新读取后检查。', { definitelyRejected: status < 500 });
}

export function createGithubClient({ run = execute, command = 'gh', timeout = 20000, maxBuffer = 20 * 1024 * 1024, imageMaxBytes = IMAGE_MAX_BYTES } = {}) {
  const options = { command, timeout, maxBuffer };
  requireValue(Number.isSafeInteger(imageMaxBytes) && imageMaxBytes > 0 && imageMaxBytes <= IMAGE_MAX_BYTES, 'INVALID_ARGUMENT', '图片读取大小上限无效。');
  const identities = new Map();
  async function fingerprint() {
    try {
      // 只在进程内对凭据求散列；不记录、不返回或持久化令牌原文。
      const result = await run(['auth', 'token', '--hostname', 'github.com'], null, options);
      requireValue(typeof result.stdout === 'string' && result.stdout.trim(), 'AUTH_REQUIRED', '请先运行 gh auth login 登录 GitHub。');
      return digest(`github.com:${result.stdout.trim()}`);
    } catch (error) { if (error?.code === 'ENOENT') throw classify(error, null, 'GET'); if (error instanceof ProofError) throw error; throw new GithubError('AUTH_REQUIRED', '无法确认当前 GitHub 凭据，请先运行 gh auth login。'); }
  }
  async function request(method, endpoint, body) {
    requireValue(['GET', 'POST', 'PATCH'].includes(method) && /^\/(?:user|repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\/[A-Za-z0-9_./-]+)?(?:\?[A-Za-z0-9_=%&.,-]+)?$/.test(endpoint) && !endpoint.includes('..'), 'GITHUB_PATH', 'GitHub 请求路径无效。');
    const args = ['api', '--hostname', 'github.com', '--method', method, '--include', '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28', endpoint];
    if (body !== undefined) args.push('--input', '-');
    let raw, executionError;
    try { raw = await run(args, body === undefined ? null : JSON.stringify(body), options); }
    catch (error) { executionError = error; raw = { stdout: error.stdout || '' }; }
    let response;
    try { response = parseResponse(raw.stdout); } catch (error) { if (!executionError) throw error; }
    if (executionError || response?.status >= 400) throw classify(executionError, response, method);
    return response;
  }
  async function identity() {
    const credentialFingerprint = await fingerprint();
    if (identities.has(credentialFingerprint)) return structuredClone(await identities.get(credentialFingerprint));
    const pending = (async () => {
      const { data } = await request('GET', '/user');
      requireValue(Number.isSafeInteger(data?.id) && data.id > 0 && typeof data.login === 'string', 'GITHUB_PROTOCOL', 'GitHub 用户身份格式无效。');
      return { id: data.id, login: data.login, name: data.name || data.login, initials: (data.name || data.login).slice(0, 1), credentialFingerprint, verifiedOnline: true };
    })();
    identities.set(credentialFingerprint, pending);
    try { return await pending; } finally { if (identities.get(credentialFingerprint) === pending) identities.delete(credentialFingerprint); }
  }
  async function readImage(value) {
    const url = normalizeImageUrl(value);
    // gh按初始URL主机选择凭据；历史图片域保留原链接，避免给它们附加企业凭据。
    requireValue(url && new URL(url).hostname === 'github.com', 'IMAGE_SOURCE_REJECTED', '此图片地址请通过原链接查看。');
    let raw;
    try {
      // 媒体与JSON路径分开，令牌只由gh使用；二进制stdout先限量，不回传重定向头。
      raw = await run(['api', '--hostname', 'github.com', '--method', 'GET', '--include', '-H', 'Accept: application/octet-stream', url], null, { ...options, binary: true, maxBuffer: imageMaxBytes + 64 * 1024 });
    } catch (error) {
      if (error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') throw new GithubError('IMAGE_TOO_LARGE', '图片超过预览大小上限，请打开原图。');
      throw new GithubError('IMAGE_UNAVAILABLE', '图片暂时无法读取，可稍后重试或打开原图。');
    }
    requireValue(Buffer.isBuffer(raw?.stdout), 'IMAGE_UNAVAILABLE', '图片响应格式不可识别，请打开原图。');
    const output = raw.stdout;
    let boundary = output.indexOf('\r\n\r\n'), separator = 4;
    if (boundary < 0) { boundary = output.indexOf('\n\n'); separator = 2; }
    requireValue(boundary > 0 && boundary <= 64 * 1024, 'IMAGE_UNAVAILABLE', '图片响应格式不可识别，请打开原图。');
    const header = output.subarray(0, boundary).toString('utf8');
    const status = Number(/^HTTP\/[\d.]+\s+(\d+)/.exec(header)?.[1]);
    requireValue(status === 200, 'IMAGE_UNAVAILABLE', '图片访问未获确认，请打开原图核对权限。');
    const mimeType = /^content-type:\s*([^;\r\n]+)/im.exec(header)?.[1]?.trim().toLowerCase();
    const bytes = output.subarray(boundary + separator);
    requireValue(bytes.length <= imageMaxBytes, 'IMAGE_TOO_LARGE', '图片超过预览大小上限，请打开原图。');
    const signatures = {
      'image/png': () => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
      'image/jpeg': () => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
      'image/gif': () => bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii')),
      'image/webp': () => bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP',
    };
    requireValue(Object.hasOwn(signatures, mimeType || '') && signatures[mimeType](), 'IMAGE_UNSUPPORTED', '此图片格式暂不支持预览，请打开原图。');
    return { mimeType, bytes };
  }
  return { request, identity, fingerprint, readImage };
}
