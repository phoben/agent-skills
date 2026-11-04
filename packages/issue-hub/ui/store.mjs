// 页面只维护当前投影，账号、缓存、草稿和请求最终由服务端 SQLite 保存。
export class StoreError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}
const copy = value => value == null ? value : structuredClone(value);
function relatedPullRequests(activities) {
  const byUrl = new Map();
  for (const item of activities || []) if (item.sourceIsPr && typeof item.sourceUrl === 'string' && item.sourceUrl && !byUrl.has(item.sourceUrl)) byUrl.set(item.sourceUrl, { url: item.sourceUrl, title: item.text || item.sourceUrl });
  return [...byUrl.values()];
}
function missingProjection(result, message) {
  return new StoreError('readback', result.operation?.status === 'confirmed' ? '提交已确认，最新内容尚未重新读取。请仅重新读取，不要再次发布。' : message, { operation: result.operation, projectionFresh: result.projectionFresh });
}
function sameRepository(left, right) {
  if (left.id && right.id && String(left.id) !== String(right.id)) return false;
  return left.key === right.key || left.sourceKeys?.includes(right.key) || right.sourceKeys?.includes(left.key) || left.fullName.toLowerCase() === right.fullName.toLowerCase();
}
function draftContent(kind, value) {
  if (kind !== 'issue' || value == null) return copy(value);
  const fields = ['number', 'title', 'body', 'labels', 'assignee', 'milestone', 'revision'];
  const editable = Object.fromEntries(fields.filter(field => value[field] !== undefined).map(field => [field, copy(value[field])]));
  // 编辑草稿只保存输入与比较基线，不重复保存整条讨论和活动。
  if (value._base) editable._base = Object.fromEntries(fields.filter(field => value._base[field] !== undefined).map(field => [field, copy(value._base[field])]));
  return editable;
}
const defaults = () => ({ repositories: [], issues: {}, tasks: {}, drafts: {}, preferences: {}, lastSuccess: '尚未成功' });
const identityErrors = new Set(['IDENTITY_CHANGED', 'IDENTITY_UNAVAILABLE', 'GH_AUTH_REQUIRED', 'AUTH_REQUIRED', 'GITHUB_AUTH_FAILED', 'GH_IDENTITY_CHANGED']);

export class LiveStore {
  constructor(call, { onIdentityChange = () => {}, onRepositoryAccessLost = () => {} } = {}) {
    this.call = call;
    this.onIdentityChange = onIdentityChange;
    this.onRepositoryAccessLost = onRepositoryAccessLost;
    this.identity = null;
    this.account = { id: null, login: '', name: '', initials: '' };
    this.data = defaults();
    this.pages = {};
    this.optionSets = {};
    this.taskRecords = {};
    this.operations = new Map();
    this.online = true;
    this.closed = false;
    this.generation = 0;
    this.catalog = null;
    this.activeRepo = '';
    this.loadStarted = false;
    this.localMutationVersion = 0;
    this.retainedDrafts = new Map();
    this.inflight = new Map();
    this.requestSequences = new WeakMap();
    this.resultSequences = new WeakMap();
    this.issueReadSequences = new Map();
    this.requestSequence = 0;
    this.networkEvidenceSequence = 0;
    this.readSignals = new Map();
    this.viewState = {};
    this.refreshNeeded = false;
    this.initialBootstrap = null;
    this.accessVersions = new Map();
    this.taskVersions = new Map();
    this.issueWriteVersions = new Map();
    this.activeIssueWrites = new Map();
  }
  get readonly() { const p = this.repository(this.activeRepo)?.permissions; return p ? !p.createIssue && !p.comment && !p.manage : true; }
  repository(repo) { return this.data.repositories.find(item => item.fullName === repo || item.sourceNames?.some(name => name.toLowerCase() === repo.toLowerCase())); }
  repositoryKey(repo) {
    const key = this.repository(repo)?.key;
    if (!key) throw new StoreError('repository', '仓库目录已变化，请重新发现项目。');
    return key;
  }
  clearIdentity(next = null) {
    this.generation++; this.identity = next; this.data = defaults(); this.pages = {}; this.optionSets = {}; this.taskRecords = {}; this.operations.clear(); this.retainedDrafts.clear(); this.inflight.clear(); this.readSignals.clear(); this.viewState = {}; this.pendingViewState = {}; this.initialBootstrap = null; this.accessVersions.clear(); this.taskVersions.clear(); this.issueWriteVersions.clear(); this.activeIssueWrites.clear();
    this.account = { id: next, login: '', name: '', initials: '' };
    this.networkEvidenceSequence = 0; this.requestSequences = new WeakMap(); this.resultSequences = new WeakMap(); this.issueReadSequences.clear();
    this.onIdentityChange();
  }
  invalidateRepository(repo) {
    const repository = this.repository(repo);
    if (repository) this.accessVersions.set(repository.key, (this.accessVersions.get(repository.key) || 0) + 1);
    if (repository) { repository.access = 'unavailable'; repository.permissions = { read: false, createIssue: false, comment: false, manage: false }; }
    delete this.data.issues[repo]; delete this.pages[repo]; delete this.optionSets[repo];
    for (const key of this.issueReadSequences.keys()) if (key.startsWith(`${repository?.key}:`)) this.issueReadSequences.delete(key);
    for (const key of Object.keys(this.taskRecords)) if (key.startsWith(`${repo}#`)) delete this.taskRecords[key];
    this.onRepositoryAccessLost(repo);
  }
  retainDraft(repo, number, kind, value) {
    const repositoryKey = this.repositoryKey(repo), key = `${repositoryKey}#${number}:${kind}`;
    const saved = { ...draftContent(kind, value), savedTick: Date.now() };
    this.localMutationVersion++; this.retainedDrafts.set(key, saved); this.data.drafts[key] = saved;
    return { repositoryKey, number, kind, value: saved };
  }
  async request(group, action, payload = {}, { bootstrap = false } = {}) {
    if (this.closed) throw new StoreError('closed', '宿主连接已关闭，请重新打开 Issue Hub。');
    const generation = this.generation;
    const accessVersion = this.accessVersions.get(payload.repositoryKey) || 0;
    const writeKey = group === 'mutate' && ['save-issue', 'save-comment', 'change-state'].includes(action) ? `${payload.repositoryKey}:${payload.number || payload.values?.number || 'new'}` : null;
    if (writeKey) { this.issueWriteVersions.set(writeKey, (this.issueWriteVersions.get(writeKey) || 0) + 1); this.activeIssueWrites.set(writeKey, (this.activeIssueWrites.get(writeKey) || 0) + 1); }
    if (group === 'mutate' || group === 'task') {
      if (this.identity == null) throw new StoreError('identity', '请先确认 GitHub 身份，再保存或打开任务。');
      payload = { ...payload, expectedIdentity: String(this.identity) };
    }
    let sequence = 0;
    try {
      const requestKey = JSON.stringify([generation, group, action, payload]);
      const canJoin = group === 'query' || group === 'task' && action === 'latest';
      let request = canJoin && this.inflight.get(requestKey);
      if (!request) {
        request = Promise.resolve().then(() => this.call(group, action, payload));
        this.requestSequences.set(request, ++this.requestSequence);
        if (canJoin) {
          this.inflight.set(requestKey, request);
          void request.finally(() => { if (this.inflight.get(requestKey) === request) this.inflight.delete(requestKey); }).catch(() => {});
        }
      }
      // 合并调用继承同一物理请求的序号，晚加入不能让旧请求重新取得优先级。
      sequence = this.requestSequences.get(request);
      const envelope = await request;
      if (generation !== this.generation) throw new StoreError('stale', '账号已变化，已忽略旧请求结果。');
      if (group === 'query' && payload.repositoryKey && accessVersion !== (this.accessVersions.get(payload.repositoryKey) || 0)) throw new StoreError('stale', '仓库访问范围已变化，已忽略此前读取结果。');
      if (!envelope || envelope.schemaVersion !== 1 || !envelope.identity) throw new StoreError('protocol', '服务返回格式不可识别，请更新插件后重试。');
      const changed = this.identity != null && String(envelope.identity) !== String(this.identity);
      if (changed) this.clearIdentity(envelope.identity);
      else this.identity = envelope.identity;
      if (changed && !bootstrap) throw new StoreError('identity', 'GitHub 账号已变化，已清除旧账号视图。请重新读取。');
      const offline = envelope.offline === true || envelope.data?.offline === true;
      // 在线元数据复用缓存并不等于断网；宿主任务的成功也不能证明GitHub已恢复。
      const checking = envelope.checking || envelope.data?.checking;
      if (sequence >= this.networkEvidenceSequence) {
        const onlineEvidence = group !== 'task' && envelope.networkChecked !== false;
        if (offline || onlineEvidence) { this.networkEvidenceSequence = sequence; this.online = !offline; }
        if (group !== 'task' && envelope.networkChecked !== false && envelope.sampledAt && this.online && envelope.cached !== true && !checking) this.data.lastSuccess = new Date(envelope.sampledAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        else if (group !== 'task' && (envelope.cached === true || checking) && this.data.lastSuccess === '尚未成功') this.data.lastSuccess = '缓存，待后台检查';
      }
      if (group === 'query') this.readSignals.set(`${action}:${payload.repositoryKey || ''}:${payload.number || ''}`, { cached: envelope.cached === true, offline, checking: envelope.checking || envelope.data?.checking, sampledAt: envelope.sampledAt });
      if (envelope.data && typeof envelope.data === 'object') this.resultSequences.set(envelope.data, sequence);
      return envelope.data;
    } catch (error) {
      if (generation !== this.generation) throw new StoreError('stale', '账号已变化，已忽略旧请求错误。');
      if (identityErrors.has(String(error.code).toUpperCase())) this.clearIdentity();
      if (group === 'query' && ['PERMISSION_DENIED', 'NOT_FOUND', 'REPOSITORY_CHANGED'].includes(String(error.code).toUpperCase()) && payload.repositoryKey) {
        const repo = this.data.repositories.find(item => item.key === payload.repositoryKey);
        if (repo) { this.invalidateRepository(repo.fullName); repo.access = 'unavailable'; }
      }
      if (sequence >= this.networkEvidenceSequence && !/^(?:HOST_|CATALOG_)/.test(String(error.code).toUpperCase()) && /OFFLINE|NETWORK|UNAVAILABLE|TIMEOUT|RATE_LIMIT/.test(String(error.code).toUpperCase())) { this.networkEvidenceSequence = sequence; this.online = false; }
      throw error;
    } finally {
      if (writeKey && generation === this.generation) { this.issueWriteVersions.set(writeKey, (this.issueWriteVersions.get(writeKey) || 0) + 1); this.activeIssueWrites.set(writeKey, Math.max(0, (this.activeIssueWrites.get(writeKey) || 1) - 1)); }
    }
  }
  acceptBootstrap(envelope) {
    // 初始工具通知不能覆盖已经开始的显式读取，更不能把页面切回旧账号。
    if (this.loadStarted) return false;
    if (envelope?.schemaVersion !== 1 || !envelope.identity || !envelope.data?.account) return false;
    if (this.identity != null && String(this.identity) !== String(envelope.identity)) this.clearIdentity(envelope.identity);
    this.identity = envelope.identity;
    if (envelope.offline === true || envelope.data?.offline === true) this.online = false;
    else if (envelope.networkChecked !== false) this.online = true;
    if (envelope.cached === true || envelope.checking || envelope.data.checking) this.data.lastSuccess = '缓存，待后台检查';
    this.initialBootstrap = copy(envelope.data);
    this.applyBootstrap(envelope.data); return true;
  }
  applyBootstrap(data, { localVersion = this.localMutationVersion } = {}) {
    this.account = copy(data.account);
    const repositories = copy(data.repositories || []).map(repo => ({ ...repo, name: repo.name || repo.fullName.split('/')[1], owner: repo.owner || repo.fullName.split('/')[0] }));
    const checking = data.refreshNeeded === true || data.catalog?.checking === true || data.catalog?.status === 'loading';
    for (const previous of this.data.repositories) {
      const next = repositories.find(repo => sameRepository(repo, previous));
      if (!next && checking) { repositories.push(previous); continue; }
      if (!next || next.access === 'unavailable') { this.invalidateRepository(previous.fullName); continue; }
      if (next.fullName !== previous.fullName || next.key !== previous.key) this.accessVersions.set(previous.key, (this.accessVersions.get(previous.key) || 0) + 1);
      if (next.fullName !== previous.fullName) {
        next.sourceNames = [...new Set([...(next.sourceNames || []), previous.fullName])];
        const rows = new Map([...(this.data.issues[previous.fullName] || []), ...(this.data.issues[next.fullName] || [])].map(issue => [issue.number, issue]));
        if (rows.size) this.data.issues[next.fullName] = [...rows.values()];
        delete this.data.issues[previous.fullName];
        for (const values of [this.pages, this.optionSets]) { if (values[previous.fullName] && !values[next.fullName]) values[next.fullName] = values[previous.fullName]; delete values[previous.fullName]; }
        for (const key of Object.keys(this.taskRecords)) if (key.startsWith(`${previous.fullName}#`)) { this.taskRecords[`${next.fullName}${key.slice(previous.fullName.length)}`] = this.taskRecords[key]; delete this.taskRecords[key]; }
        if (this.activeRepo === previous.fullName) this.activeRepo = next.fullName;
      }
      if (next.key !== previous.key) {
        for (const [key, value] of this.retainedDrafts) if (key.startsWith(`${previous.key}#`)) { this.retainedDrafts.set(`${next.key}${key.slice(previous.key.length)}`, value); this.retainedDrafts.delete(key); }
      }
    }
    this.data.repositories = repositories;
    this.catalog = copy(data.catalog);
    this.refreshNeeded = data.refreshNeeded === true;
    this.viewState = { ...copy(data.viewState || {}), ...this.pendingViewState };
    const preferred = repositories.find(repo => repo.key === this.viewState.repositoryKey || repo.sourceKeys?.includes(this.viewState.repositoryKey));
    if (preferred) {
      this.viewState.repositoryKey = preferred.key;
      if (this.pendingViewState?.repositoryKey) this.pendingViewState.repositoryKey = preferred.key;
    }
    if (localVersion === this.localMutationVersion) { this.data.drafts = { ...copy(data.drafts || {}), ...Object.fromEntries(this.retainedDrafts) }; this.data.preferences = copy(data.preferences || {}); }
    const allowed = new Set(this.data.repositories.map(repo => repo.fullName));
    for (const repo of Object.keys(this.data.issues)) if (!allowed.has(repo)) delete this.data.issues[repo];
  }
  async load() {
    if (!this.loadStarted && this.initialBootstrap) { this.loadStarted = true; const data = this.initialBootstrap; this.initialBootstrap = null; this.applyBootstrap(data); return this.data; }
    this.loadStarted = true; const localVersion = this.localMutationVersion; const data = await this.request('query', 'bootstrap', {}, { bootstrap: true }); this.applyBootstrap(data, { localVersion }); return this.data;
  }
  async refreshCatalog() {
    const localVersion = this.localMutationVersion;
    const data = await this.request('query', 'refresh', {}, { bootstrap: true });
    this.applyBootstrap(data, { localVersion }); return data;
  }
  readSignal(action, repo, number = '') { return copy(this.readSignals.get(`${action}:${this.repository(repo)?.key || ''}:${number}`) || {}); }
  preferredRepository() { return this.data.repositories.find(repo => repo.key === this.viewState.repositoryKey || repo.sourceKeys?.includes(this.viewState.repositoryKey))?.fullName || ''; }
  async saveViewState(value) {
    const generation = this.generation;
    this.pendingViewState = { ...this.pendingViewState, ...copy(value) }; this.viewState = { ...this.viewState, ...copy(value) };
    const next = copy(this.viewState);
    const previous = this.viewWrite || Promise.resolve();
    this.viewWrite = previous.catch(() => {}).then(async () => {
      if (generation !== this.generation) throw new StoreError('stale', '账号已变化，旧界面偏好不会写入新账号。');
      await this.request('mutate', 'view-state-save', { value: next });
    });
    return this.viewWrite;
  }
  list(repo) { return copy(this.data.issues[this.repository(repo)?.fullName || repo] || []); }
  issue(repo, number) { return copy((this.data.issues[this.repository(repo)?.fullName || repo] || []).find(row => row.number === Number(number))); }
  repositoryWriteVersion(repositoryKey) { return [...this.issueWriteVersions].reduce((total, [key, value]) => key.startsWith(`${repositoryKey}:`) ? total + value : total, 0); }
  installIssue(repo, issue) {
    repo = this.repository(repo)?.fullName || repo;
    const normalized = { labels: [], assignee: '', assignees: [], milestone: '', commentItems: [], activities: [], attachments: [], comments: 0, detailStale: false, ...copy(issue) };
    const rows = this.data.issues[repo] ||= [];
    const index = rows.findIndex(row => row.number === normalized.number);
    if (index < 0) rows.unshift(normalized); else rows[index] = normalized;
    return copy(normalized);
  }
  async loadRepository(repo, { more = false, cacheFirst = false } = {}) {
    this.activeRepo = repo;
    const key = this.repositoryKey(repo);
    const version = this.repositoryWriteVersion(key);
    const cursor = more ? this.pages[repo]?.nextCursor : undefined;
    const data = await this.request('query', 'list', { repositoryKey: key, state: 'all', ...(cursor ? { cursor } : {}), ...(cacheFirst ? { cacheFirst: true } : {}) });
    // 列表在途期间若已提交修改，不能用旧列表覆盖写后读回或删除刚创建的Issue。
    if (version !== this.repositoryWriteVersion(key) || [...this.activeIssueWrites].some(([writeKey, active]) => writeKey.startsWith(`${key}:`) && active > 0)) return data;
    if (data.repository) Object.assign(this.repository(repo), copy(data.repository));
    const previous = new Map((this.data.issues[repo] || []).map(issue => [issue.number, issue]));
    const existing = more ? this.data.issues[repo] || [] : [];
    this.data.issues[repo] = existing;
    for (const issue of data.issues || []) {
      const loaded = previous.get(issue.number);
      // 列表不拥有讨论分页；编辑中也保留已读内容，版本变化则明确标记待更新。
      this.installIssue(repo, loaded ? { ...loaded, ...issue, comments: loaded.comments, commentItems: loaded.commentItems, activities: loaded.activities, relatedPr: loaded.relatedPr, coverage: loaded.coverage, detailStale: Boolean(loaded.detailStale || loaded.revision !== issue.revision) } : issue);
    }
    const active = previous.get(this.activeNumber);
    if (!more && active && !this.data.issues[repo].some(issue => issue.number === active.number)) this.installIssue(repo, { ...active, detailStale: true });
    this.data.issues[repo].sort((left, right) => String(right.updatedAt || right.revision || '').localeCompare(String(left.updatedAt || left.revision || '')) || right.number - left.number);
    this.pages[repo] = copy(data.pageInfo || { complete: false });
    return data;
  }
  async loadOptions(repo) {
    const data = await this.request('query', 'options', { repositoryKey: this.repositoryKey(repo) });
    this.optionSets[repo] = copy(data); return data;
  }
  options(repo) { return copy(this.optionSets[repo] || { labels: [], assignees: [], milestones: [] }); }
  async loadIssue(repo, number, { summary = false, cacheFirst = false } = {}) {
    const writeKey = `${this.repositoryKey(repo)}:${number}`, version = this.issueWriteVersions.get(writeKey) || 0;
    const data = await this.request('query', summary ? 'read-summary' : 'read', { repositoryKey: this.repositoryKey(repo), number: Number(number), ...(cacheFirst ? { cacheFirst: true } : {}) });
    if (version !== (this.issueWriteVersions.get(writeKey) || 0) || this.activeIssueWrites.get(writeKey)) return this.issue(repo, number);
    const sequence = this.resultSequences.get(data);
    // 同一Issue较新摘要已应用时，旧首次读取成功也不能把投影换回旧数据。
    if (sequence < (this.issueReadSequences.get(writeKey) || 0)) return this.issue(repo, number);
    if (sequence !== undefined) this.issueReadSequences.set(writeKey, sequence);
    const previous = this.issue(repo, number);
    const issue = summary && previous?.coverage ? { ...data.issue, commentItems: previous.commentItems, activities: previous.activities, relatedPr: previous.relatedPr, discussionRevision: previous.discussionRevision, detailStale: previous.detailStale || previous.revision !== data.issue.revision, coverage: { ...data.issue.coverage, comments: previous.coverage.comments, activity: previous.coverage.activity } } : data.issue;
    return this.installIssue(repo, issue);
  }
  async loadDiscussion(repo, number, kind) {
    const writeKey = `${this.repositoryKey(repo)}:${number}`, version = this.issueWriteVersions.get(writeKey) || 0, revision = this.issue(repo, number)?.revision;
    const data = await this.request('query', kind, { repositoryKey: this.repositoryKey(repo), number: Number(number) });
    const current = this.issue(repo, number);
    if (!current || revision !== current.revision || version !== (this.issueWriteVersions.get(writeKey) || 0) || this.activeIssueWrites.get(writeKey)) return current;
    const field = kind === 'comments' ? 'commentItems' : 'activities';
    current[field] = copy(data.items || []); current.coverage ||= {}; current.coverage[kind] = { ...copy(data.pageInfo), loaded: current[field].length };
    current.discussionRevision = { ...current.discussionRevision, [kind]: current.revision };
    if (['comments', 'activity'].every(name => current.discussionRevision[name] === current.revision)) current.detailStale = false;
    if (kind === 'activity') current.relatedPr = relatedPullRequests(current[field]);
    return this.installIssue(repo, current);
  }
  async loadMore(repo, number, kind) {
    const issue = this.issue(repo, number);
    const coverage = issue.coverage?.[kind];
    if (!coverage?.nextCursor) return issue;
    const writeKey = `${this.repositoryKey(repo)}:${number}`, version = this.issueWriteVersions.get(writeKey) || 0;
    const data = await this.request('query', kind, { repositoryKey: this.repositoryKey(repo), number: Number(number), cursor: coverage.nextCursor });
    const current = this.issue(repo, number);
    if (!current || issue.revision !== current.revision || version !== (this.issueWriteVersions.get(writeKey) || 0) || this.activeIssueWrites.get(writeKey)) return current;
    const field = kind === 'comments' ? 'commentItems' : 'activities';
    const items = new Map((current[field] || []).map(item => [String(item.id || JSON.stringify(item)), item]));
    for (const item of data.items || []) items.set(String(item.id || JSON.stringify(item)), item);
    current[field] = [...items.values()]; current.coverage ||= {}; current.coverage[kind] = { ...copy(data.pageInfo), loaded: current[field].length };
    if (kind === 'activity') current.relatedPr = relatedPullRequests(current[field]);
    return this.installIssue(repo, current);
  }
  preference(repo) { return copy(this.data.preferences[this.repository(repo)?.key] || { query: '', state: 'open', label: '', assignee: '', scroll: 0 }); }
  async savePreference(repo, value) {
    if (!repo) return;
    const repositoryKey = this.repositoryKey(repo); const next = copy(value);
    this.localMutationVersion++;
    this.preferenceWrites ||= new Map();
    const generation = this.generation;
    const previous = this.preferenceWrites.get(repositoryKey) || Promise.resolve();
    const operation = previous.catch(() => {}).then(() => {
      if (generation !== this.generation) throw new StoreError('stale', '账号已变化，旧浏览设置不会保存到新账号。');
      return this.request('mutate', 'preference-save', { repositoryKey, value: next });
    });
    this.preferenceWrites.set(repositoryKey, operation);
    await operation;
    this.data.preferences[repositoryKey] = next;
  }
  draftKey(repo, number, kind) { return `${this.repositoryKey(repo)}#${number}:${kind}`; }
  draft(repo, number, kind) { return copy(this.data.drafts[this.draftKey(repo, number, kind)] || null); }
  commentDraft(repo, number) {
    const prefix = `${this.repositoryKey(repo)}#${number}:comment`;
    return copy(Object.entries(this.data.drafts).filter(([key]) => key === prefix || key.startsWith(`${prefix}:`)).map(([, value]) => value).sort((a, b) => (b.savedTick || 0) - (a.savedTick || 0))[0] || null);
  }
  async saveDraft(repo, number, kind, value) {
    const key = this.draftKey(repo, number, kind);
    const saved = value == null ? null : { ...draftContent(kind, value), savedTick: Date.now() };
    const retainedAtStart = this.retainedDrafts.get(key);
    this.draftWrites ||= new Map();
    this.localMutationVersion++;
    const generation = this.generation;
    const previous = this.draftWrites.get(key) || Promise.resolve();
    const operation = previous.catch(() => {}).then(() => {
      if (generation !== this.generation) throw new StoreError('stale', '账号已变化，旧草稿不会保存到新账号。');
      return this.request('mutate', 'draft-save', { repositoryKey: this.repositoryKey(repo), number, kind, value: saved });
    });
    this.draftWrites.set(key, operation);
    await operation;
    if (this.retainedDrafts.has(key) && this.retainedDrafts.get(key) !== retainedAtStart) return;
    this.retainedDrafts.delete(key);
    if (saved == null) delete this.data.drafts[key]; else this.data.drafts[key] = saved;
  }
  operation(kind, repo, value) {
    const key = JSON.stringify([kind, this.identity, repo, value]);
    if (!this.operations.has(key)) this.operations.set(key, crypto.randomUUID());
    return this.operations.get(key);
  }
  async saveIssue(repo, values, { force = false } = {}) {
    const canManage = (values.number ? this.issue(repo, values.number)?.permissions?.manage : this.repository(repo)?.permissions?.manage) === true;
    const baseline = values._base || (values.number ? this.issue(repo, values.number) : null);
    const metadata = canManage ? ['labels', 'assignee', 'milestone'].filter(field => !baseline || JSON.stringify(values[field]) !== JSON.stringify(baseline[field])) : [];
    const content = ['title', 'body'].filter(field => !baseline || values[field] !== baseline[field]);
    const fields = ['number', 'revision', ...content, ...metadata];
    const editable = Object.fromEntries(fields.filter(key => values[key] !== undefined).map(key => [key, values[key]]));
    const operationId = values.operationId || this.operation(force ? 'issue-force' : 'issue', repo, editable);
    const result = await this.request('mutate', 'save-issue', { repositoryKey: this.repositoryKey(repo), values: editable, force, operationId });
    if (!result.issue) throw missingProjection(result, '提交结果尚未重新读取，请先刷新核对，勿重复新建。');
    const issue = this.installIssue(repo, result.issue);
    delete this.data.drafts[this.draftKey(repo, values.number || 'new', 'issue')];
    return issue;
  }
  async changeState(repo, number) {
    const issue = this.issue(repo, number);
    const state = issue.state === 'open' ? 'closed' : 'open';
    const result = await this.request('mutate', 'change-state', { repositoryKey: this.repositoryKey(repo), number, state, revision: issue.revision, operationId: this.operation('state', repo, { number, state, revision: issue.revision }) });
    if (!result.issue) throw missingProjection(result, '状态提交结果待重新读取，请先刷新核对。');
    return this.installIssue(repo, result.issue);
  }
  async saveComment(repo, number, text, commentId = null, expectedText = undefined) {
    const payload = { repositoryKey: this.repositoryKey(repo), number, text, ...(commentId ? { commentId, expectedText } : {}) };
    const result = await this.request('mutate', 'save-comment', { ...payload, operationId: this.operation('comment', repo, payload) });
    if (!result.issue) throw missingProjection(result, '评论提交结果待重新读取，请先刷新核对，勿重复发表。');
    const issue = this.installIssue(repo, result.issue);
    delete this.data.drafts[this.draftKey(repo, number, commentId ? `comment:${commentId}` : 'comment')];
    return issue;
  }
  async refresh({ repo, number, manual = false } = {}) {
    const prior = this.identity;
    let detailLoaded = false;
    await this.load();
    const accountChanged = prior != null && String(prior) !== String(this.identity);
    if (repo && this.repository(repo) && !accountChanged) {
      await this.loadRepository(repo);
      if (number) { await this.loadIssue(repo, number, { summary: true }); detailLoaded = true; }
    }
    if (manual && !this.data.repositories.length) await this.refreshCatalog();
    return { accountChanged, detailLoaded };
  }
  task(repo, number) { return copy(this.taskRecords[`${repo}#${number}`] || { current: null, history: [], binding: null, workspaces: [] }); }
  async prepareTask() {
    if (!this.refreshNeeded && !this.catalog?.checking && this.catalog?.status !== 'unavailable') return;
    const generation = this.generation, identity = this.identity;
    // 使用正常query刷新投影与GitHub连接状态，不能靠宿主任务成功宣称网络恢复。
    await this.refreshCatalog();
    if (generation !== this.generation || identity !== this.identity) throw new StoreError('stale', '账号已变化，已停止旧页面的任务操作。');
    if (this.catalog?.checking || this.catalog?.status === 'unavailable') throw new StoreError(this.catalog.error?.code || 'CATALOG_CHECKING', this.catalog.error?.message || '项目和工作区尚未核对成功，请检查连接后重试。');
  }
  async loadTask(repo, number) {
    const key = `${repo}#${number}`, version = this.taskVersions.get(key) || 0;
    this.taskVersions.set(key, version);
    const result = await this.request('task', 'latest', { repositoryKey: this.repositoryKey(repo), number });
    if (version !== (this.taskVersions.get(key) || 0)) return this.task(repo, number);
    this.taskRecords[key] = copy(result); return result;
  }
  workspaces(repo) {
    return (this.task(repo, this.activeNumber).workspaces?.length ? this.task(repo, this.activeNumber).workspaces : this.repository(repo)?.workspaces || []).map(item => ({ ...item, id: item.key || item.workspaceKey || item.id, path: item.cwd || item.path, name: item.projectName || item.name || '工作区', valid: item.valid !== false }));
  }
  binding(repo) {
    const value = this.task(repo, this.activeNumber).binding;
    if (!value) return null;
    return { ...value, id: value.workspaceKey || value.key || value.id, valid: value.valid !== false };
  }
  async bind(repo, workspaceKey) {
    const generation = this.generation, identity = this.identity;
    await this.prepareTask();
    if (generation !== this.generation || identity !== this.identity) throw new StoreError('stale', '账号已变化，已停止旧页面的任务操作。');
    for (const key of new Set([...Object.keys(this.taskRecords), ...this.taskVersions.keys()])) if (key.startsWith(`${repo}#`)) this.taskVersions.set(key, (this.taskVersions.get(key) || 0) + 1);
    const result = await this.request('task', 'bind', { repositoryKey: this.repositoryKey(repo), workspaceKey });
    for (const [key, record] of Object.entries(this.taskRecords)) if (key.startsWith(`${repo}#`)) record.binding = copy(result.binding);
    return result;
  }
  async createTask(repo, number, { another = false, workspaceKey } = {}) {
    const generation = this.generation, identity = this.identity;
    await this.prepareTask();
    if (generation !== this.generation || identity !== this.identity) throw new StoreError('stale', '账号已变化，已停止旧页面的任务操作。');
    const key = `${repo}#${number}`, version = (this.taskVersions.get(key) || 0) + 1; this.taskVersions.set(key, version);
    const record = this.task(repo, number);
    const requestId = !another && record.current?.requestId ? record.current.requestId : this.operation('task', repo, { number, another, existing: record.current?.id });
    const result = await this.request('task', 'open', { repositoryKey: this.repositoryKey(repo), number, requestId, another, reuseOnly: Boolean(record.current && !another), ...(workspaceKey ? { workspaceKey } : {}) });
    if (this.taskVersions.get(key) !== version) return this.task(repo, number).current;
    this.taskRecords[key] = copy(result); return result.current;
  }
  async checkTask(repo, number) {
    const key = `${repo}#${number}`, version = (this.taskVersions.get(key) || 0) + 1; this.taskVersions.set(key, version);
    const requestId = this.task(repo, number).current?.requestId;
    if (!requestId) throw new StoreError('task', '没有可核对的自有任务请求，请重新读取。');
    const result = await this.request('task', 'check', { requestId });
    if (this.taskVersions.get(key) !== version) return this.task(repo, number).current;
    this.taskRecords[key] = copy(result); return result.current;
  }
  async openHistory(repo, number, requestId) {
    const record = this.task(repo, number);
    if (!record.history?.some(task => task.requestId === requestId && task.status === 'linked' && task.threadId)) throw new StoreError('task-history', '此记录不是当前 Issue 的已确认历史会话，请重新读取。');
    const key = `${repo}#${number}`, version = (this.taskVersions.get(key) || 0) + 1; this.taskVersions.set(key, version);
    const result = await this.request('task', 'open-history', { repositoryKey: this.repositoryKey(repo), number, requestId });
    if (this.taskVersions.get(key) === version) this.taskRecords[key] = copy(result);
    return this.task(repo, number);
  }
  async resolveTask(repo, number, threadId, requestId) {
    const record = this.task(repo, number);
    if (!requestId || record.current?.requestId !== requestId || !record.current.candidates?.some(candidate => candidate.threadId === threadId)) throw new StoreError('task-candidate', '候选已变化或不属于当前请求，请重新检查后选择。');
    const key = `${repo}#${number}`, version = (this.taskVersions.get(key) || 0) + 1; this.taskVersions.set(key, version);
    const result = await this.request('task', 'resolve', { requestId, threadId, confirmed: true });
    if (this.taskVersions.get(key) === version) this.taskRecords[key] = copy(result);
    return this.task(repo, number).current;
  }
  async resolveOperation(repo, operation, resolution) {
    const operationId = operation.operationId || operation.id;
    if (!operationId) throw new StoreError('operation', '缺少操作回执，请重新读取后核对。');
    const data = await this.request('mutate', 'operation-resolve', { repositoryKey: this.repositoryKey(repo), operationId, resolution, confirmed: true });
    if (resolution === 'not-created') for (const [key, id] of this.operations) if (id === operationId) this.operations.delete(key);
    if (data.issue) this.installIssue(repo, data.issue);
    return data;
  }
}
