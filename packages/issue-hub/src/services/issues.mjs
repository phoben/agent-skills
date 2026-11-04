import { createHash } from 'node:crypto';
import { ProofError, requireValue } from '../errors.mjs';

const clone = value => structuredClone(value);
const keyPattern = /^[a-f0-9]{20}$/;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const loginPattern = /^[a-z0-9][a-z0-9-]{0,38}$/i;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const orderedInput = value => Array.isArray(value) ? value.map(orderedInput) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, orderedInput(value[key])])) : value;
const requestHash = (repo, action, input) => hash({ repositoryId: repo.id, action, input: orderedInput(input) });
const repositoryIdKey = id => createHash('sha256').update(`github.com:id:${id}`).digest('hex').slice(0, 20);
const safeLink = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } };
const isNetwork = error => ['NETWORK_UNAVAILABLE', 'RATE_LIMITED'].includes(error?.code);
function checkFields(value, allowed) { requireValue(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => allowed.includes(key)), 'INVALID_ARGUMENT', '请求包含不支持的内容。'); }
function integer(value, optional = false) { requireValue(optional && value === undefined || Number.isSafeInteger(value) && value > 0, 'INVALID_ARGUMENT', 'Issue 或评论编号无效。'); }
function text(value, maximum, empty = true) { requireValue(typeof value === 'string' && value.length <= maximum && (empty || value.trim().length > 0), 'INVALID_ARGUMENT', '输入为空或超出可接受长度。'); }
function pageNumber(cursor) { requireValue(cursor === undefined || cursor === null || typeof cursor === 'string' && /^[1-9]\d{0,5}$/.test(cursor), 'INVALID_ARGUMENT', '分页位置无效。'); return cursor ? Number(cursor) : 1; }
function nextPage(response, page) {
  const next = /<([^>]+)>;\s*rel="next"/.exec(response.headers?.link || '');
  if (next) {
    const target = new URL(next[1]);
    requireValue(target.protocol === 'https:' && target.hostname === 'api.github.com' && Number(target.searchParams.get('page')) === page + 1, 'GITHUB_PROTOCOL', 'GitHub 分页位置异常。');
    return String(page + 1);
  }
  return null;
}
function normalizeComment(row) {
  requireValue(Number.isSafeInteger(row?.id) && typeof row.body === 'string', 'GITHUB_PROTOCOL', '评论格式无法识别。');
  return { id: row.id, login: row.user?.login || '', author: row.user?.login || '未知账号', initials: (row.user?.login || '?').slice(0, 1), time: row.created_at || '', text: row.body, updatedAt: row.updated_at || '', url: safeLink(row.html_url) };
}
function normalizeActivity(row) {
  const names = { closed: '关闭了 Issue', reopened: '重新打开了 Issue', labeled: '添加了标签', unlabeled: '移除了标签', assigned: '调整了负责人', unassigned: '移除了负责人', milestoned: '设置了里程碑', demilestoned: '移除了里程碑', renamed: '修改了标题', referenced: '引用了此 Issue', 'cross-referenced': '关联了其他工作项', locked: '锁定了讨论', unlocked: '解锁了讨论', pinned: '置顶了 Issue', unpinned: '取消了置顶', transferred: '转移了 Issue', converted_to_discussion: '转为了讨论' };
  const actor = row.actor?.login || row.user?.login || 'GitHub';
  return { id: row.id || row.node_id || hash(row), event: row.event || 'unknown', text: `${actor} ${names[row.event] || row.event || '更新了活动'}${row.label?.name ? ` · ${row.label.name}` : row.milestone?.title ? ` · ${row.milestone.title}` : ''}`, time: row.created_at || '', sourceUrl: safeLink(row.source?.issue?.html_url), sourceIsPr: Boolean(row.source?.issue?.pull_request) };
}
function attachments(body) {
  const urls = [...body.matchAll(/https:\/\/[^\s<>\)\]"']+/g)].map(match => match[0]);
  return [...new Set(urls)].filter(value => { try { const url = new URL(value); return ['github.com', 'user-images.githubusercontent.com', 'private-user-images.githubusercontent.com', 'github-production-user-asset-6210df.s3.amazonaws.com'].includes(url.hostname) && (/\/user-attachments\//.test(url.pathname) || url.hostname !== 'github.com'); } catch { return false; } }).map(url => { const name = new URL(url).pathname.split('/').pop() || '附件'; let decoded; try { decoded = decodeURIComponent(name); } catch { decoded = name; } return { url: safeLink(url), name: decoded }; });
}

export function createIssueService({ github, storage, catalog, pageLimit = 10, now = () => new Date().toISOString() }) {
  const inflight = new Map();
  async function context({ fast = false } = {}) {
    if (fast && github.fingerprint) {
      const fingerprint = await github.fingerprint();
      const verified = storage.get('_identity', 'credential', fingerprint);
      if (verified) return { ...verified, fingerprint, offline: false, checkingIdentity: true };
    }
    try {
      const raw = await github.identity();
      requireValue((Number.isSafeInteger(raw?.id) || typeof raw?.id === 'string' && /^\d+$/.test(raw.id)) && typeof raw.login === 'string', 'AUTH_REQUIRED', '无法确认当前 GitHub 身份。');
      const account = { id: raw.id, login: raw.login, name: raw.name || raw.login, initials: raw.initials || raw.login.slice(0, 1) };
      const scope = `github.com:${account.id}`;
      if (raw.credentialFingerprint && github.fingerprint) requireValue(await github.fingerprint() === raw.credentialFingerprint, 'IDENTITY_CHANGED', '身份读取期间 GitHub 凭据已变化，请重新读取。');
      if (raw.credentialFingerprint) storage.set('_identity', 'credential', raw.credentialFingerprint, { account, scope });
      return { scope, account, fingerprint: raw.credentialFingerprint || null, offline: false };
    } catch (error) {
      if (error?.code === 'AUTH_REQUIRED' && github.fingerprint) {
        try { storage.remove('_identity', 'credential', await github.fingerprint()); } catch { /* 无法取得当前凭据时不选择其他身份。 */ }
      }
      // 离线只允许同一凭据散列对应的已验证稳定身份，绝不按上一次账号猜测。
      if (isNetwork(error) && github.fingerprint) {
        const fingerprint = await github.fingerprint();
        const verified = storage.get('_identity', 'credential', fingerprint);
        if (verified) return { ...verified, fingerprint, offline: true, identityWarning: error.code };
      }
      throw error;
    }
  }
  async function guard(ctx) {
    if (ctx.fingerprint && github.fingerprint) requireValue(await github.fingerprint() === ctx.fingerprint, 'IDENTITY_CHANGED', 'GitHub 账号已变化，旧账号结果已忽略。');
    else requireValue(String((await github.identity()).id) === String(ctx.account.id), 'IDENTITY_CHANGED', 'GitHub 账号已变化，旧账号结果已忽略。');
    if (ctx.checkingIdentity) {
      const verified = storage.get('_identity', 'credential', ctx.fingerprint);
      requireValue(verified?.scope === ctx.scope && String(verified.account?.id) === String(ctx.account.id), 'AUTH_REQUIRED', 'GitHub 身份资格已撤销，请重新登录后读取。');
    }
  }
  async function request(ctx, method, endpoint, body) {
    try { const response = await github.request(method, endpoint, body); ctx.networkChecked = true; return response; }
    catch (error) {
      // 身份验证后的资源请求仍可能返回401，不能保留该凭据的离线授权映射。
      if (error?.code === 'AUTH_REQUIRED' && ctx.fingerprint) storage.remove('_identity', 'credential', ctx.fingerprint);
      throw error;
    }
  }
  function invalidateAccess(ctx, kind, key, previous) {
    storage.remove(ctx.scope, kind, key);
    const repositoryId = kind === 'repository' ? previous?.id : String(key).split(/[:#]/, 1)[0];
    if (!repositoryId) return;
    // 明确失权后撤销整个仓库的读取缓存，草稿和操作回执继续保留供账号恢复后处理。
    for (const row of storage.list(ctx.scope, 'repository')) if (String(row.value.id) === String(repositoryId)) storage.remove(ctx.scope, 'repository', row.key);
    for (const cacheKind of ['page', 'issue-raw', 'issue-detail']) for (const row of storage.list(ctx.scope, cacheKind)) {
      if (row.key.startsWith(`${repositoryId}:`) || row.key.startsWith(`${repositoryId}#`)) storage.remove(ctx.scope, cacheKind, row.key);
    }
  }
  function envelope(ctx, data) { return { schemaVersion: 1, identity: ctx.account.id, account: ctx.account, data, sampledAt: now(), offline: Boolean(ctx.offline), cached: Boolean(ctx.usedCache), networkChecked: Boolean(ctx.networkChecked || !ctx.checkingIdentity), ...(ctx.checkingIdentity || ctx.preferCache && ctx.usedCache ? { checking: { identity: Boolean(ctx.checkingIdentity), data: Boolean(ctx.preferCache && ctx.usedCache) } } : {}), ...(ctx.identityWarning ? { warning: ctx.identityWarning } : {}) }; }
  async function cached(ctx, kind, key, loader) {
    const previous = storage.get(ctx.scope, kind, key);
    if (ctx.preferCache && previous !== null) { ctx.usedCache = true; return previous; }
    if (ctx.offline) { requireValue(previous !== null, 'OFFLINE_UNCACHED', '当前离线，此内容尚未缓存。'); ctx.usedCache = true; return previous; }
    try { const value = await loader(); await guard(ctx); storage.set(ctx.scope, kind, key, value); return value; }
    catch (error) {
      if (['PERMISSION_DENIED', 'NOT_FOUND'].includes(error?.code)) invalidateAccess(ctx, kind, key, previous);
      if (isNetwork(error) && previous !== null) { await guard(ctx); ctx.offline = true; ctx.usedCache = true; ctx.identityWarning = error.code; return previous; }
      throw error;
    }
  }
  function discovered(key) {
    requireValue(typeof key === 'string' && keyPattern.test(key), 'INVALID_ARGUMENT', '仓库标识无效。');
    const entry = catalog.snapshot().repositories.find(repo => repo.key === key);
    requireValue(entry && /^[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/i.test(entry.fullName), 'REPOSITORY_UNKNOWN', '仓库不在当前项目列表，请重新发现项目。');
    return entry;
  }
  async function repositoryMetadata(ctx, entry, { reuse = false, cacheOnly = false } = {}) {
    const alias = storage.get(ctx.scope, 'repository-alias', entry.key);
    const cacheKey = entry.id ? repositoryIdKey(entry.id) : alias?.key;
    const previous = cacheKey ? storage.get(ctx.scope, 'repository', cacheKey) : null;
    if (previous && (ctx.offline || ctx.preferCache || cacheOnly || reuse && new Date(now()).getTime() - new Date(previous._checkedAt || 0).getTime() < 60000)) {
      if (!cacheOnly && !ctx.preferCache) await guard(ctx); ctx.usedCache = true; return previous;
    }
    requireValue(!cacheOnly, 'METADATA_PENDING', '正在核对仓库信息，稍后显示最新结果。');
    requireValue(!ctx.offline, 'OFFLINE_UNCACHED', '当前离线，此仓库身份尚未确认。');
    try {
      const { data } = await request(ctx, 'GET', `/repos/${entry.fullName}`);
      requireValue(Number.isSafeInteger(data?.id) && data.id > 0 && /^[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/i.test(data.full_name || ''), 'GITHUB_PROTOCOL', 'GitHub 仓库格式无法识别。');
      if (entry.id && String(data.id) !== String(entry.id)) {
        invalidateAccess(ctx, 'repository', cacheKey, previous || { id: entry.id });
        throw new ProofError('REPOSITORY_CHANGED', '此仓库地址已对应其他仓库，请重新发现项目。');
      }
      await guard(ctx);
      const stableKey = repositoryIdKey(data.id), remote = { ...data, _checkedAt: now() };
      storage.transaction(() => {
        storage.set(ctx.scope, 'repository', stableKey, remote);
        for (const sourceKey of new Set([entry.key, ...(entry.sourceKeys || [])])) storage.set(ctx.scope, 'repository-alias', sourceKey, { key: stableKey, id: data.id });
      });
      return remote;
    } catch (error) {
      if (['PERMISSION_DENIED', 'NOT_FOUND'].includes(error?.code)) invalidateAccess(ctx, 'repository', cacheKey || entry.key, previous);
      if (isNetwork(error) && previous !== null) { await guard(ctx); ctx.offline = true; ctx.usedCache = true; ctx.identityWarning = error.code; return previous; }
      throw error;
    }
  }
  function repositoryProjection(entry, remote) {
    const permission = remote.permissions || {};
    return { ...entry, id: remote.id, remoteName: remote.full_name, name: remote.name || remote.full_name.split('/')[1], owner: remote.owner?.login || remote.full_name.split('/')[0], url: safeLink(remote.html_url), access: 'available', permissions: { read: true, createIssue: remote.has_issues !== false && !remote.archived && !remote.disabled, comment: !remote.archived && !remote.disabled, manage: Boolean(permission.push || permission.maintain || permission.admin) }, archived: Boolean(remote.archived), hasIssues: remote.has_issues !== false };
  }
  async function repository(ctx, key) {
    const entry = discovered(key);
    return repositoryProjection(entry, await repositoryMetadata(ctx, entry));
  }
  function localRepository(ctx, key) {
    requireValue(typeof key === 'string' && keyPattern.test(key), 'INVALID_ARGUMENT', '仓库标识无效。');
    const raw = catalog.snapshot({ raw: true }).repositories;
    for (const entry of raw) {
      const alias = storage.get(ctx.scope, 'repository-alias', entry.key);
      if (!alias || !Number.isSafeInteger(Number(alias.id)) || Number(alias.id) <= 0 || alias.key !== repositoryIdKey(alias.id)) continue;
      if (entry.key === key || alias.key === key) return { key, id: alias.id, canonicalKey: alias.key };
    }
    throw new ProofError('REPOSITORY_UNVERIFIED', '此仓库尚未与当前账号确认关联，请保留输入并重新发现项目。');
  }
  function viewState(ctx) {
    const saved = storage.get(ctx.scope, 'view', 'layout') || {};
    if (!saved.repositoryKey) return saved;
    try { return { ...saved, repositoryKey: localRepository(ctx, saved.repositoryKey).canonicalKey }; }
    catch (error) { if (['REPOSITORY_UNVERIFIED', 'INVALID_ARGUMENT'].includes(error.code)) return { ...saved, repositoryKey: '' }; throw error; }
  }
  async function normalizeCatalog(ctx, { refreshMetadata = false, cacheOnly = false } = {}) {
    const original = catalog.snapshot({ raw: true }), metadata = new Map(), diagnostics = new Map(), mappings = [];
    if (original.status === 'unavailable') { const waiting = cacheOnly && !original.warnings.includes('DISCOVERY_FAILED'); return { repositories: [], catalog: { ...original, status: waiting ? 'loading' : 'unavailable', checking: waiting } }; }
    let index = 0;
    // 仓库多时限制并发，不逐项串行放大启动等待，也不无上限冲击 GitHub。
    await Promise.all(Array.from({ length: Math.min(4, original.repositories.length) }, async () => {
      while (index < original.repositories.length) {
        const entry = original.repositories[index++];
        try {
          const remote = await repositoryMetadata(ctx, entry, { reuse: !refreshMetadata, cacheOnly });
          metadata.set(repositoryIdKey(remote.id), remote);
          mappings.push({ key: entry.key, id: remote.id, fullName: remote.full_name });
        } catch (error) {
          if (['IDENTITY_CHANGED', 'AUTH_REQUIRED'].includes(error?.code)) throw error;
          diagnostics.set(entry.key, { code: error.code || 'REPOSITORY_UNAVAILABLE', message: error instanceof ProofError ? error.message : '此仓库暂时无法读取。' });
        }
      }
    }));
    await guard(ctx);
    // 较慢请求不得用旧目录或旧元信息覆盖期间已完成的新一轮归一。
    const current = catalog.snapshot();
    const superseded = current.sourceRevision !== original.sourceRevision || cacheOnly && current.revision !== original.revision;
    const snapshot = superseded ? current : typeof catalog.remap === 'function' ? catalog.remap(mappings) : original;
    const repositories = snapshot.repositories.map(entry => {
      const id = entry.id || mappings.find(mapping => mapping.key === entry.key)?.id;
      const remote = id ? (superseded ? storage.get(ctx.scope, 'repository', repositoryIdKey(id)) : metadata.get(repositoryIdKey(id))) : null;
      if (remote) return repositoryProjection(entry, remote);
      const diagnostic = diagnostics.get(entry.key) || { code: 'REPOSITORY_UNAVAILABLE', message: '此仓库尚未确认访问权限。' };
      return { ...entry, id: null, name: entry.fullName.split('/')[1], owner: entry.fullName.split('/')[0], access: cacheOnly && diagnostic.code === 'METADATA_PENDING' ? 'checking' : 'unavailable', diagnostic, permissions: { read: false, createIssue: false, comment: false, manage: false } };
    });
    const warnings = [...new Set([...snapshot.warnings, ...(diagnostics.size ? ['REPOSITORY_METADATA_INCOMPLETE'] : [])])];
    return { repositories, catalog: { ...snapshot, repositories, status: snapshot.status === 'unavailable' ? 'unavailable' : warnings.length ? 'partial' : snapshot.status, warnings, ...(cacheOnly ? { checking: true } : {}) } };
  }
  const prefix = repo => `/repos/${repo.remoteName}`;
  async function page(ctx, repo, suffix, cursor = undefined, transform = value => value, query = '') {
    const current = pageNumber(cursor), endpoint = `${prefix(repo)}${suffix}?per_page=100&page=${current}${query}`;
    return cached(ctx, 'page', `${repo.id}:${suffix}:${current}:${query}`, async () => {
      const response = await request(ctx, 'GET', endpoint);
      requireValue(Array.isArray(response.data), 'GITHUB_PROTOCOL', 'GitHub 分页数据无法识别。');
      const nextCursor = nextPage(response, current);
      return { items: response.data.map(transform).filter(Boolean), pageInfo: { complete: !nextCursor, nextCursor, loaded: response.data.length, page: current } };
    });
  }
  async function allPages(ctx, repo, suffix, transform, query = '') {
    let cursor, pageInfo, items = [];
    for (let index = 0; index < pageLimit; index++) {
      const result = await page(ctx, repo, suffix, cursor, transform, query);
      items.push(...result.items); pageInfo = result.pageInfo;
      if (!pageInfo.nextCursor) break;
      cursor = pageInfo.nextCursor;
    }
    const seen = new Set(); items = items.filter(item => { const id = item?.id ?? JSON.stringify(item); if (seen.has(id)) return false; seen.add(id); return true; });
    return { items, pageInfo: { ...pageInfo, loaded: items.length } };
  }
  async function rawIssue(ctx, repo, number) {
    integer(number);
    return cached(ctx, 'issue-raw', `${repo.id}#${number}`, async () => {
      const { data } = await request(ctx, 'GET', `${prefix(repo)}/issues/${number}`);
      requireValue(!data?.pull_request && Number.isSafeInteger(data?.id) && data.number === number && typeof data.title === 'string' && typeof data.updated_at === 'string', 'ISSUE_INVALID', '该对象不是可管理的 Issue。');
      return data;
    });
  }
  function normalizeIssue(row, repo, ctx, detail = {}) {
    const labels = (row.labels || []).map(label => typeof label === 'string' ? label : label.name).filter(Boolean);
    const assignees = (row.assignees || (row.assignee ? [row.assignee] : [])).map(user => user.login);
    const canManage = repo.permissions.manage, isAuthor = String(row.user?.id) === String(ctx.account.id);
    const body = row.body || '';
    return { id: row.id, number: row.number, title: row.title, body, state: row.state, labels, assignee: assignees[0] || '', assignees, author: row.user?.login || '', authorLogin: row.user?.login || '', authorId: row.user?.id, created: row.created_at || '', updated: row.updated_at || '', updatedAt: row.updated_at, revision: row.updated_at, milestone: row.milestone?.title || '', milestoneNumber: row.milestone?.number || null, comments: row.comments || 0, commentItems: detail.commentItems || [], activities: detail.activities || [], url: safeLink(row.html_url), relatedPr: detail.relatedPr || [], attachments: attachments(body), coverage: detail.coverage || { comments: { complete: !row.comments, loaded: 0, total: row.comments || 0 }, activity: { complete: false, loaded: 0 } }, permissions: { edit: !repo.archived && (canManage || isAuthor), comment: repo.permissions.comment && !row.locked, manage: !repo.archived && canManage, editOwnComment: !repo.archived }, locked: Boolean(row.locked), stateReason: row.state_reason || null };
  }
  async function read(ctx, repo, number) {
    const raw = await rawIssue(ctx, repo, number);
    const comments = await allPages(ctx, repo, `/issues/${number}/comments`, normalizeComment);
    let activity;
    try { activity = await allPages(ctx, repo, `/issues/${number}/timeline`, row => row.event === 'commented' ? null : normalizeActivity(row)); }
    catch (error) { if (!['NOT_FOUND', 'PERMISSION_DENIED'].includes(error.code)) throw error; activity = { items: [], pageInfo: { complete: false, nextCursor: null, loaded: 0, unavailable: error.code } }; }
    const relatedPr = activity.items.filter(item => item.sourceIsPr && item.sourceUrl).map(item => ({ url: item.sourceUrl, title: item.text }));
    const issue = normalizeIssue(raw, repo, ctx, { commentItems: comments.items, activities: activity.items, relatedPr, coverage: { comments: { ...comments.pageInfo, total: raw.comments || 0 }, activity: activity.pageInfo, extensions: { projects: 'github-link', subIssues: 'github-link', dependencies: 'github-link' } } });
    await guard(ctx); storage.set(ctx.scope, 'issue-detail', `${repo.id}#${number}`, issue); return issue;
  }
  async function options(ctx, repo) {
    const labels = await allPages(ctx, repo, '/labels', row => ({ id: row.id, name: row.name, color: row.color, description: row.description || '' }));
    const assignees = await allPages(ctx, repo, '/assignees', row => ({ id: row.id, login: row.login, name: row.login }));
    const milestones = await allPages(ctx, repo, '/milestones', row => ({ id: row.id, number: row.number, title: row.title, state: row.state }), '&state=all');
    return { labels: labels.items.map(row => row.name), assignees: assignees.items.map(row => row.login), milestones: milestones.items.map(row => row.title), labelItems: labels.items, assigneeItems: assignees.items, milestoneItems: milestones.items, coverage: { labels: labels.pageInfo, assignees: assignees.pageInfo, milestones: milestones.pageInfo } };
  }
  function local(ctx, repositories) {
    const byId = new Map();
    for (const repo of repositories) {
      // 草稿与偏好属于成员的本机输入，仓库失权清理读取缓存后仍能恢复；不读取 Issue 缓存。
      try { const known = localRepository(ctx, repo.key); byId.set(String(known.id), repo.key); } catch (error) { if (error?.code !== 'REPOSITORY_UNVERIFIED') throw error; }
    }
    const drafts = {}, preferences = {};
    for (const row of storage.list(ctx.scope, 'draft')) { const at = row.key.indexOf('#'), repoKey = byId.get(row.key.slice(0, at)); if (repoKey) drafts[`${repoKey}${row.key.slice(at)}`] = row.value; }
    for (const row of storage.list(ctx.scope, 'preference')) { const repoKey = byId.get(row.key); if (repoKey) preferences[repoKey] = row.value; }
    return { drafts, preferences };
  }
  function issueFields(issue, fields) {
    const values = { title: issue.title, body: issue.body, state: issue.state, labels: [...issue.labels].sort(), assignees: [...issue.assignees].sort(), milestone: issue.milestoneNumber };
    return Object.fromEntries(fields.map(field => [field, values[field]]));
  }
  async function verifyReadBack(ctx, repo, operation, issue) {
    const verification = operation.verification;
    if (!verification) return;
    if (verification.kind === 'issue') {
      requireValue(hash(issueFields(issue, verification.fields)) === verification.hash, 'READBACK_MISMATCH', 'GitHub 已接受写入，但读回内容与本次修改不一致，请核对远端。');
      return;
    }
    const { data } = await request(ctx, 'GET', `${prefix(repo)}/issues/comments/${verification.commentId}`);
    let parentPath; try { parentPath = new URL(data?.issue_url).pathname.toLowerCase(); } catch { parentPath = ''; }
    requireValue(data?.id === verification.commentId && parentPath === `${prefix(repo)}/issues/${operation.number}`.toLowerCase() && hash(data.body) === verification.hash, 'READBACK_MISMATCH', 'GitHub 已接受评论，但尚未读回一致的评论内容，请核对远端。');
  }
  async function replayConfirmed(ctx, repo, action, operationId, requestSignature, legacyMatches) {
    requireValue(typeof operationId === 'string' && uuidPattern.test(operationId), 'INVALID_ARGUMENT', '本次操作缺少有效请求标识。');
    const prior = storage.get(ctx.scope, 'operation', operationId);
    if (prior?.status !== 'confirmed') return null;
    requireValue(prior.repositoryId === repo.id && prior.action === action && (prior.requestSignature ? prior.requestSignature === requestSignature : legacyMatches?.(prior)), 'OPERATION_REUSED', '此操作标识已用于其他内容。');
    requireValue(prior.issue && Number.isSafeInteger(prior.issue.number), 'OPERATION_STATE', '此操作缺少可恢复的确认结果，请重新读取。');
    return confirmedProjection(ctx, repo, prior);
  }
  async function confirmedProjection(ctx, repo, operation) {
    await guard(ctx);
    try {
      const issue = await read(ctx, repo, operation.issue.number);
      requireValue(!ctx.offline && !ctx.usedCache, 'READBACK_PENDING', '当前最新内容尚未取得。');
      await guard(ctx);
      // operation是历史成功回执，issue是此次只读的新投影；后续写入不能使用历史快照当新基线。
      return { issue, operation: clone(operation), replayed: true, projectionFresh: true };
    } catch (error) {
      if (['IDENTITY_CHANGED', 'AUTH_REQUIRED', 'PERMISSION_DENIED', 'NOT_FOUND'].includes(error?.code)) throw error;
      await guard(ctx);
      return { issue: null, operation: clone(operation), replayed: true, projectionFresh: false, readbackWarning: { code: error instanceof ProofError ? error.code : 'READBACK_PENDING', message: '原操作已确认，当前最新内容尚未读取。请稍后刷新核对，不要重新提交。' } };
    }
  }
  function legacyIssueMatches(prior, repo, action, values) {
    if (prior.verification?.kind !== 'issue' || !Array.isArray(prior.verification.fields) || !prior.issue) return false;
    const submitted = { title: values.title?.trim(), body: values.body, state: values.state, labels: values.labels, assignees: values.assignees ?? ('assignee' in values ? values.assignee ? [values.assignee] : [] : undefined), milestone: values.milestoneNumber !== undefined ? values.milestoneNumber : values.milestone !== undefined ? values.milestone === '' ? null : values.milestone === prior.issue.milestone ? prior.issue.milestoneNumber : undefined : undefined };
    if (values.milestone !== undefined && submitted.milestone === undefined) return false;
    if (action === 'create' && submitted.body === undefined) submitted.body = '';
    const fields = ['title', 'body', 'state', 'labels', 'assignees', 'milestone'];
    // 旧回执没有原始请求摘要。仅当修改字段摘要、原版本及所有提交字段均能由确认投影证明时兼容。
    for (const [field, value] of Object.entries(submitted)) if (value !== undefined) {
      const actual = issueFields(prior.issue, [field])[field];
      if (hash(Array.isArray(value) ? [...value].sort() : value) !== hash(actual)) return false;
    }
    const body = {};
    for (const field of prior.verification.fields) {
      if (!fields.includes(field) || submitted[field] === undefined) return false;
      body[field] = submitted[field];
    }
    return hash({ repositoryId: repo.id, action, input: { number: values.number, body, revision: values.revision } }) === prior.signature;
  }
  async function write(ctx, repo, action, operationId, input, perform, readBack, requestSignature) {
    requireValue(!ctx.offline, 'OFFLINE', '当前离线，请保存本机草稿，恢复后手动提交。');
    requireValue(typeof operationId === 'string' && uuidPattern.test(operationId), 'INVALID_ARGUMENT', '本次操作缺少有效请求标识。');
    const signature = hash({ repositoryId: repo.id, action, input });
    let prior;
    storage.transaction(() => {
      prior = storage.get(ctx.scope, 'operation', operationId);
      if (prior) {
        requireValue(prior.signature === signature && (!prior.requestSignature || prior.requestSignature === requestSignature), 'OPERATION_REUSED', '此操作标识已用于其他内容。');
        if (prior.status === 'pending' && new Date(now()).getTime() - new Date(prior.createdAt).getTime() > 120000) { prior = { ...prior, status: 'unknown' }; storage.set(ctx.scope, 'operation', operationId, prior); }
        if (prior.status === 'rejected') { storage.set(ctx.scope, 'operation', operationId, { ...prior, status: 'pending' }); prior = null; }
        return;
      }
      const unknown = storage.list(ctx.scope, 'operation').find(row => row.value.signature === signature && ['pending', 'unknown', 'readback-failed'].includes(row.value.status));
      if (unknown) throw new ProofError('OPERATION_UNKNOWN', '相同内容已有未确认操作，请先在 GitHub 核对，不要重复提交。', { operation: unknown.value });
      storage.set(ctx.scope, 'operation', operationId, { id: operationId, repositoryId: repo.id, action, signature, requestSignature, status: 'pending', createdAt: now() });
    });
    if (prior?.status === 'confirmed') return { issue: prior.issue, operation: prior };
    if (prior?.status === 'resolved-not-created') throw new ProofError('OPERATION_RESOLVED', '此操作已结束。请明确点击重新提交以生成新操作标识。', { operation: prior });
    if (prior && ['pending', 'unknown', 'readback-failed'].includes(prior.status)) throw new ProofError('OPERATION_UNKNOWN', '本次操作已发出但结果未确认，请先在 GitHub 核对。', { operation: prior });
    // 已被明确拒绝的相同请求可重试；写入前再次确认身份。
    await guard(ctx);
    let written;
    try { written = await perform(); }
    catch (error) {
      const operation = { id: operationId, repositoryId: repo.id, action, signature, requestSignature, status: error.definitelyRejected ? 'rejected' : 'unknown', number: input.number, createdAt: now() };
      storage.set(ctx.scope, 'operation', operationId, operation);
      if (!error.definitelyRejected) throw new ProofError('OPERATION_UNKNOWN', '写入结果尚未确认。输入已保留，请在 GitHub 核对后再决定，不要重复创建。', { operation });
      throw error;
    }
    const verification = action.startsWith('comment-') ? { kind: 'comment', commentId: written?.id, hash: hash(input.content) } : { kind: 'issue', fields: Object.keys(input.body), hash: hash(Object.fromEntries(Object.entries(input.body).map(([name, value]) => [name, Array.isArray(value) ? [...value].sort() : value]))) };
    const operation = { id: operationId, repositoryId: repo.id, action, signature, requestSignature, status: 'readback-failed', number: input.number || written?.number, url: safeLink(written?.html_url), createdAt: now(), verification };
    storage.set(ctx.scope, 'operation', operationId, operation);
    try {
      await guard(ctx);
      const issue = await readBack(written);
      await verifyReadBack(ctx, repo, operation, issue);
      requireValue(!ctx.offline && !ctx.usedCache, 'READBACK_UNAVAILABLE', 'GitHub 写入已返回，但重新读取未完成。');
      operation.status = 'confirmed'; operation.issue = issue; storage.set(ctx.scope, 'operation', operationId, operation);
      return { issue, operation };
    } catch (error) {
      if (error?.code === 'IDENTITY_CHANGED') throw error;
      throw new ProofError('READBACK_PENDING', 'GitHub 已接受写入，重新读取尚未完成。请刷新核对，不要重复提交。', { operation });
    }
  }
  async function saveIssue(ctx, repo, payload, { stateOnly = false } = {}) {
    const { values, force = false, operationId } = payload;
    checkFields(values, ['number', 'title', 'body', 'labels', 'assignee', 'assignees', 'milestone', 'milestoneNumber', 'revision', 'state']);
    integer(values.number, true); requireValue(typeof force === 'boolean', 'INVALID_ARGUMENT', '冲突处理选项无效。');
    if (stateOnly) integer(values.number);
    if ('title' in values) text(values.title, 256, false);
    if ('body' in values) text(values.body, 65536);
    if ('revision' in values) text(values.revision, 64, false);
    const existing = values.number ? await rawIssue(ctx, repo, values.number) : null;
    requireValue(!ctx.offline, 'OFFLINE', '当前离线，请保存本机草稿。');
    requireValue(existing ? normalizeIssue(existing, repo, ctx).permissions.edit : repo.permissions.createIssue, 'PERMISSION_DENIED', '当前账号无法编辑或新增此 Issue。');
    const action = existing ? 'update' : 'create', requestSignature = requestHash(repo, action, { values, force });
    const replay = await replayConfirmed(ctx, repo, action, operationId, requestSignature, prior => legacyIssueMatches(prior, repo, action, values));
    if (replay) return replay;
    if (existing) requireValue(typeof values.revision === 'string', 'BASELINE_REQUIRED', '请重新打开 Issue 后再保存。');
    if (stateOnly) {
      const expectedState = values.state === 'closed' ? 'open' : 'closed';
      // 状态入口只PATCH状态，以原状态比较；评论/活动的全局更新时间不能冒充状态冲突。
      if (existing.state !== expectedState) throw new ProofError('CONFLICT', 'Issue 状态已变化，请重新读取后确认。', { remote: normalizeIssue(existing, repo, ctx) });
    } else if (existing && values.revision !== existing.updated_at && !force) throw new ProofError('CONFLICT', 'GitHub 已有新修改。你的输入已保留，请比较后再决定。', { remote: normalizeIssue(existing, repo, ctx) });
    const body = {};
    for (const field of ['title', 'body']) if (field in values && (!existing || values[field] !== existing[field])) body[field] = field === 'title' ? values[field].trim() : values[field];
    if (values.state !== undefined) { requireValue(['open', 'closed'].includes(values.state) && existing, 'INVALID_ARGUMENT', 'Issue 状态无效。'); if (values.state !== existing.state) body.state = values.state; }
    let candidate;
    if (['labels', 'assignee', 'assignees', 'milestone', 'milestoneNumber'].some(field => field in values)) candidate = await options(ctx, repo);
    if ('labels' in values) {
      requireValue(Array.isArray(values.labels) && values.labels.length <= 100 && values.labels.every(value => typeof value === 'string' && candidate.labels.includes(value)), 'INVALID_LABEL', '只能使用当前仓库已有标签。');
      const original = (existing?.labels || []).map(label => typeof label === 'string' ? label : label.name);
      if (hash([...new Set(values.labels)].sort()) !== hash([...original].sort())) body.labels = [...new Set(values.labels)];
    }
    if ('assignee' in values || 'assignees' in values) {
      const selected = values.assignees !== undefined ? values.assignees : values.assignee ? [values.assignee] : [];
      requireValue(Array.isArray(selected) && selected.length <= 10 && selected.every(value => typeof value === 'string' && loginPattern.test(value) && candidate.assignees.includes(value)), 'INVALID_ASSIGNEE', '负责人不在当前仓库候选列表中。');
      const original = (existing?.assignees || []).map(user => user.login);
      if (hash([...selected].sort()) !== hash([...original].sort())) body.assignees = selected;
    }
    if ('milestone' in values || 'milestoneNumber' in values) {
      const selected = values.milestoneNumber !== undefined ? candidate.milestoneItems.find(item => item.number === values.milestoneNumber) : candidate.milestoneItems.find(item => item.title === values.milestone);
      requireValue(selected || values.milestone === '' || values.milestoneNumber === null, 'INVALID_MILESTONE', '里程碑不在当前仓库候选列表中。');
      if ((selected?.number || null) !== (existing?.milestone?.number || null)) body.milestone = selected?.number || null;
    }
    if (['labels', 'assignees', 'milestone'].some(field => field in body)) requireValue(repo.permissions.manage, 'PERMISSION_DENIED', '当前账号没有管理标签、负责人或里程碑的权限。');
    if (!existing) { requireValue(typeof body.title === 'string', 'INVALID_ARGUMENT', '新 Issue 必须填写标题。'); body.body ??= ''; }
    // GitHub 没有通用原子条件更新；此处只检测保存前已出现的远端版本变化。
    const result = await write(ctx, repo, action, operationId, { number: values.number, body, revision: values.revision }, async () => (await request(ctx, existing ? 'PATCH' : 'POST', `${prefix(repo)}/issues${existing ? `/${values.number}` : ''}`, body)).data, written => read(ctx, repo, written.number), requestSignature);
    storage.remove(ctx.scope, 'draft', `${repo.id}#${existing ? values.number : 'new'}:issue`);
    return result;
  }
  async function saveComment(ctx, repo, payload) {
    const { number, text: content, commentId, expectedText, operationId } = payload;
    integer(number); text(content, 65536, false); if (commentId !== undefined && commentId !== null) integer(commentId);
    const issue = await rawIssue(ctx, repo, number);
    requireValue(repo.permissions.comment && !issue.locked, 'PERMISSION_DENIED', '当前 Issue 无法发表评论。');
    const action = commentId ? 'comment-edit' : 'comment-create', input = { number, commentId, content, expectedText }, requestSignature = requestHash(repo, action, input);
    let comment;
    if (commentId) {
      text(expectedText, 65536);
      ({ data: comment } = await request(ctx, 'GET', `${prefix(repo)}/issues/comments/${commentId}`));
      const expectedIssuePath = `/repos/${repo.remoteName}/issues/${number}`.toLowerCase();
      let parentPath; try { parentPath = new URL(comment.issue_url).pathname.toLowerCase(); } catch { parentPath = ''; }
      requireValue(parentPath === expectedIssuePath && String(comment.user?.id) === String(ctx.account.id), 'PERMISSION_DENIED', '只能编辑当前 Issue 中本人发表的评论。');
    }
    const replay = await replayConfirmed(ctx, repo, action, operationId, requestSignature, prior => prior.signature === hash({ repositoryId: repo.id, action, input }));
    if (replay) return replay;
    if (comment && comment.body !== expectedText) throw new ProofError('CONFLICT', '这条评论已有新修改，请重新读取并合并，当前输入已保留。', { remote: normalizeComment(comment) });
    const result = await write(ctx, repo, action, operationId, input, async () => (await request(ctx, commentId ? 'PATCH' : 'POST', commentId ? `${prefix(repo)}/issues/comments/${commentId}` : `${prefix(repo)}/issues/${number}/comments`, { body: content })).data, async written => { requireValue(Number.isSafeInteger(written?.id), 'GITHUB_PROTOCOL', '评论写入结果格式异常。'); return read(ctx, repo, number); }, requestSignature);
    storage.remove(ctx.scope, 'draft', `${repo.id}#${number}:${commentId ? `comment:${commentId}` : 'comment'}`);
    return result;
  }
  async function resolveOperation(ctx, repo, payload) {
    requireValue(typeof payload.operationId === 'string' && uuidPattern.test(payload.operationId) && payload.confirmed === true && ['not-created', 'readback'].includes(payload.resolution), 'INVALID_ARGUMENT', '请先明确核对远端结果，再选择恢复操作。');
    await guard(ctx);
    const previous = storage.get(ctx.scope, 'operation', payload.operationId);
    requireValue(previous && previous.repositoryId === repo.id, 'OPERATION_UNKNOWN', '当前仓库没有此操作回执。');
    if (payload.resolution === 'readback' && previous.status === 'confirmed') {
      requireValue(previous.issue && Number.isSafeInteger(previous.issue.number), 'OPERATION_STATE', '此操作缺少可恢复的确认结果。');
      return confirmedProjection(ctx, repo, previous);
    }
    if (payload.resolution === 'not-created') {
      // 此入口只解除明确人工核对过的未知结果，不产生任何 GitHub 写入。
      const operation = storage.transaction(() => {
        const current = storage.get(ctx.scope, 'operation', payload.operationId);
        requireValue(current?.status === 'unknown', 'OPERATION_STATE', '只有结果未知的操作可确认未创建；已被接受的操作请重新读取。');
        const resolved = { ...current, status: 'resolved-not-created', resolvedAt: now() }; storage.set(ctx.scope, 'operation', current.id, resolved); return resolved;
      });
      return { operation };
    }
    requireValue(previous.status === 'readback-failed' && Number.isSafeInteger(previous.number), 'OPERATION_STATE', '此操作没有可重新读取的写入结果。');
    const issue = await read(ctx, repo, previous.number);
    await verifyReadBack(ctx, repo, previous, issue);
    requireValue(!ctx.offline && !ctx.usedCache, 'READBACK_PENDING', '仍未取得 GitHub 最新结果，请稍后重新读取。');
    await guard(ctx);
    const operation = { ...previous, status: 'confirmed', issue, confirmedAt: now() };
    storage.transaction(() => { requireValue(storage.get(ctx.scope, 'operation', previous.id)?.status === 'readback-failed', 'OPERATION_STATE', '操作状态已变化，请刷新。'); storage.set(ctx.scope, 'operation', previous.id, operation); });
    return { issue, operation };
  }
  async function executeAction(action, payload = {}) {
    const fast = action === 'bootstrap' || ['view-state-save', 'draft-save', 'preference-save', 'local-state'].includes(action) || ['list', 'read-summary'].includes(action) && payload.cacheFirst === true;
    const ctx = await context({ fast });
    ctx.preferCache = ['list', 'read-summary'].includes(action) && payload.cacheFirst === true;
    const allowed = {
      bootstrap: [], refresh: ['repositoryKey'], list: ['repositoryKey', 'state', 'cursor', 'cacheFirst'], read: ['repositoryKey', 'number'], 'read-summary': ['repositoryKey', 'number', 'cacheFirst'], comments: ['repositoryKey', 'number', 'cursor'], activity: ['repositoryKey', 'number', 'cursor'], options: ['repositoryKey'], 'local-state': ['repositoryKey', 'expectedIdentity'], 'view-state-save': ['value'],
      'save-issue': ['repositoryKey', 'values', 'force', 'operationId'], 'change-state': ['repositoryKey', 'number', 'state', 'revision', 'operationId'], 'save-comment': ['repositoryKey', 'number', 'text', 'commentId', 'expectedText', 'operationId'], 'draft-save': ['repositoryKey', 'number', 'kind', 'value'], 'preference-save': ['repositoryKey', 'value'], 'operation-resolve': ['repositoryKey', 'operationId', 'resolution', 'confirmed'],
    };
    requireValue(Object.hasOwn(allowed, action), 'ACTION_UNSUPPORTED', '不支持此操作。');
    const mutation = ['save-issue', 'change-state', 'save-comment', 'draft-save', 'preference-save', 'operation-resolve', 'view-state-save'].includes(action);
    checkFields(payload, mutation ? [...allowed[action], 'expectedIdentity'] : allowed[action]);
    if (mutation) requireValue(payload.expectedIdentity !== undefined && String(payload.expectedIdentity) === String(ctx.account.id), 'IDENTITY_CHANGED', 'GitHub 账号已变化，请重新读取页面后再保存。');
    if (action === 'local-state' && payload.expectedIdentity !== undefined) requireValue(String(payload.expectedIdentity) === String(ctx.account.id), 'IDENTITY_CHANGED', 'GitHub 账号已变化，请重新读取页面。');
    if (payload.cacheFirst !== undefined) requireValue(typeof payload.cacheFirst === 'boolean', 'INVALID_ARGUMENT', '缓存读取选项无效。');
    if (action === 'view-state-save') {
      checkFields(payload.value, ['navigationWidth', 'queueWidth', 'repositoryKey']);
      const value = { ...payload.value };
      if (value.navigationWidth !== undefined) requireValue(Number.isFinite(value.navigationWidth) && value.navigationWidth >= 164 && value.navigationWidth <= 420, 'INVALID_ARGUMENT', '项目列宽超过允许范围。');
      if (value.queueWidth !== undefined) requireValue(Number.isFinite(value.queueWidth) && value.queueWidth >= 280 && value.queueWidth <= 640, 'INVALID_ARGUMENT', 'Issue列宽超过允许范围。');
      if (value.repositoryKey !== undefined && value.repositoryKey !== null && value.repositoryKey !== '') value.repositoryKey = localRepository(ctx, value.repositoryKey).canonicalKey;
      await guard(ctx);
      const viewState = { ...(storage.get(ctx.scope, 'view', 'layout') || {}), ...value };
      storage.set(ctx.scope, 'view', 'layout', viewState);
      return envelope(ctx, { viewState });
    }
    if (action === 'bootstrap' || action === 'refresh') {
      let discoveryFailure = null;
      if (action === 'refresh') {
        const before = catalog.snapshot({ raw: true });
        try { await catalog.refresh(); }
        catch (error) {
          discoveryFailure = { code: error instanceof ProofError ? error.code : 'HOST_DISCOVERY_FAILED', message: 'Codex项目读取暂不可用，正在显示已核对的本机缓存，请稍后重试。' };
          const stored = storage.get(ctx.scope, 'catalog', 'raw');
          const fallback = stored || (['complete', 'partial'].includes(before.status) ? before : null);
          if (fallback && typeof catalog.restore === 'function') {
            try { catalog.restore(fallback); } catch (restoreError) { if (restoreError.code !== 'CATALOG_CACHE_INVALID') throw restoreError; }
          }
        }
        const raw = catalog.snapshot({ raw: true });
        await guard(ctx);
        if (!discoveryFailure && raw.status !== 'unavailable') storage.set(ctx.scope, 'catalog', 'raw', raw);
      } else if (catalog.snapshot().status === 'unavailable' && typeof catalog.restore === 'function') {
        const stored = storage.get(ctx.scope, 'catalog', 'raw');
        if (stored) { try { catalog.restore(stored); } catch (error) { if (error.code !== 'CATALOG_CACHE_INVALID') throw error; storage.remove(ctx.scope, 'catalog', 'raw'); } }
      }
      if (action === 'bootstrap' && catalog.snapshot().status === 'unavailable') {
        try { await catalog.refresh({ quick: true }); }
        catch (error) { discoveryFailure = { code: error instanceof ProofError ? error.code : 'HOST_DISCOVERY_FAILED', message: 'Codex项目读取暂不可用，请稍后重新发现。' }; }
      }
      const normalized = await normalizeCatalog(ctx, { refreshMetadata: action === 'refresh' && !discoveryFailure, cacheOnly: action === 'bootstrap' || Boolean(discoveryFailure) });
      if (discoveryFailure) { ctx.usedCache = true; normalized.catalog = { ...normalized.catalog, status: 'unavailable', checking: true, error: discoveryFailure, warnings: [...new Set([...normalized.catalog.warnings, 'DISCOVERY_FAILED', discoveryFailure.code])] }; }
      await guard(ctx); return envelope(ctx, { account: ctx.account, ...normalized, ...local(ctx, normalized.repositories), viewState: viewState(ctx), ...(action === 'bootstrap' || discoveryFailure ? { checking: { identity: Boolean(ctx.checkingIdentity), catalog: true, metadata: true }, refreshNeeded: true } : { refreshNeeded: false }) });
    }
    const repo = ['draft-save', 'preference-save', 'local-state'].includes(action) ? localRepository(ctx, payload.repositoryKey) : await repository(ctx, payload.repositoryKey);
    let data;
    if (action === 'list') {
      requireValue(payload.state === undefined || ['all', 'open', 'closed'].includes(payload.state), 'INVALID_ARGUMENT', 'Issue 状态筛选无效。');
      const result = await page(ctx, repo, '/issues', payload.cursor, row => row.pull_request ? null : normalizeIssue(row, repo, ctx), `&state=${payload.state || 'all'}&sort=updated&direction=desc`);
      data = { repository: repo, issues: result.items, pageInfo: result.pageInfo };
    } else if (action === 'read') data = { issue: await read(ctx, repo, payload.number) };
    else if (action === 'read-summary') {
      const raw = await rawIssue(ctx, repo, payload.number);
      data = { issue: normalizeIssue(raw, repo, ctx, { coverage: { comments: { complete: false, loaded: 0, total: raw.comments || 0, nextCursor: '1' }, activity: { complete: false, loaded: 0, nextCursor: '1' }, extensions: { projects: 'github-link', subIssues: 'github-link', dependencies: 'github-link' } } }) };
    }
    else if (action === 'comments' || action === 'activity') { integer(payload.number); await rawIssue(ctx, repo, payload.number); data = await page(ctx, repo, `/issues/${payload.number}/${action === 'comments' ? 'comments' : 'timeline'}`, payload.cursor, action === 'comments' ? normalizeComment : row => row.event === 'commented' ? null : normalizeActivity(row)); }
    else if (action === 'options') data = await options(ctx, repo);
    else if (action === 'local-state') data = local(ctx, [repo]);
    else if (action === 'save-issue') data = await saveIssue(ctx, repo, payload);
    else if (action === 'change-state') { requireValue(['open', 'closed'].includes(payload.state), 'INVALID_ARGUMENT', 'Issue 状态无效。'); data = await saveIssue(ctx, repo, { values: { number: payload.number, state: payload.state, revision: payload.revision }, operationId: payload.operationId }, { stateOnly: true }); }
    else if (action === 'save-comment') data = await saveComment(ctx, repo, payload);
    else if (action === 'operation-resolve') data = await resolveOperation(ctx, repo, payload);
    else if (action === 'draft-save') {
      requireValue(payload.number === 'new' || Number.isSafeInteger(payload.number) && payload.number > 0, 'INVALID_ARGUMENT', '草稿所属 Issue 无效。');
      requireValue(typeof payload.kind === 'string' && /^(?:issue|comment(?::[1-9]\d*)?)$/.test(payload.kind), 'INVALID_ARGUMENT', '草稿类型无效。');
      requireValue(payload.value === null || payload.value && typeof payload.value === 'object' && !Array.isArray(payload.value) && Buffer.byteLength(JSON.stringify(payload.value)) <= 512 * 1024, 'INVALID_ARGUMENT', '草稿内容无效或过大。');
      const key = `${repo.id}#${payload.number}:${payload.kind}`;
      await guard(ctx); if (payload.value === null) storage.remove(ctx.scope, 'draft', key); else storage.set(ctx.scope, 'draft', key, { ...payload.value, savedAt: now() }); data = local(ctx, [repo]);
    } else if (action === 'preference-save') {
      checkFields(payload.value, ['query', 'state', 'label', 'assignee', 'scroll']);
      requireValue(JSON.stringify(payload.value).length <= 8192, 'INVALID_ARGUMENT', '浏览设置超过允许大小。');
      await guard(ctx); storage.set(ctx.scope, 'preference', String(repo.id), payload.value); data = local(ctx, [repo]);
    }
    await guard(ctx); return envelope(ctx, data);
  }
  async function execute(action, payload = {}) {
    // 只合并同凭据、同参数的在途读取；不缓存完成结果，也不合并写入。
    const readOnly = ['bootstrap', 'refresh', 'list', 'read', 'read-summary', 'comments', 'activity', 'options', 'local-state'].includes(action);
    if (!readOnly || !github.fingerprint) return executeAction(action, payload);
    const fingerprint = await github.fingerprint(), key = hash({ fingerprint, action, payload });
    if (inflight.has(key)) return clone(await inflight.get(key));
    const pending = executeAction(action, payload); inflight.set(key, pending);
    try { return await pending; } finally { if (inflight.get(key) === pending) inflight.delete(key); }
  }
  return { execute, context };
}
