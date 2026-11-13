// 数据只存在独立的原型命名空间，不读取任何真实账号、文件或令牌。
export class StoreError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}
const clone = (value) => structuredClone(value);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const timeNow = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

export class PrototypeStore {
  constructor(fixture, options = {}) {
    this.fixture = fixture;
    this.scenario = options.scenario || '';
    this.storage = options.storage || globalThis.localStorage;
    this.namespace = `issue-hub-prototype:a-v1:${encodeURIComponent(options.run || 'default')}`;
    this.identity = this.read(`${this.namespace}:identity`, fixture.account.login);
    this.online = this.scenario !== 'offline';
    this.revision = 0;
    this.hydrate();
  }
  read(key, fallback) {
    try { const value = this.storage.getItem(key); return value ? JSON.parse(value) : clone(fallback); }
    catch { return clone(fallback); }
  }
  write(key, value) {
    try { this.storage.setItem(key, JSON.stringify(value)); }
    catch { throw new StoreError('storage', '本机存储不可用。内容已留在当前页面，请重试或复制后再离开。'); }
  }
  get account() { return this.fixture.prototype.accounts.find((account) => account.login === this.identity) || this.fixture.account; }
  get key() { return `${this.namespace}:account:${this.identity}`; }
  get readonly() { return this.scenario === 'read-only'; }
  hydrate() { this.data = this.read(this.key, this.seed()); }
  seed() {
    const alternate = this.identity !== this.fixture.account.login;
    const catalog = this.fixture.prototype;
    const repositoryNames = alternate ? ['team/support-tools'] : this.fixture.repositories.map((repo) => repo.fullName);
    const repositories = repositoryNames.map((name) => ({ fullName: name, name: name.split('/')[1], owner: name.split('/')[0] }));
    const issues = {};
    for (const repo of repositories) {
      const rows = repo.fullName === this.fixture.repository.fullName ? this.fixture.issues : (catalog.repositoryIssues[repo.fullName] || []);
      issues[repo.fullName] = rows.map((row) => {
        const source = repo.fullName === this.fixture.repository.fullName && row.number === this.fixture.detail.number ? this.fixture.detail : row;
        const body = source.body || (source.bodyLead ? `${source.bodyLead}\n\n复现步骤\n${source.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\n预期结果\n${source.expectation}\n\n验收条件\n${source.acceptance.map((item) => `- [ ] ${item}`).join('\n')}` : `${row.title}\n\n当前行为\n此项在日常仓库处理中影响阅读与后续操作，需要保留当前对象和未提交输入。\n\n预期结果\n操作完成后应显示最新状态，失败时保留内容并提供重试。\n\n验收条件\n- [ ] 正常操作后可重新读取结果。\n- [ ] 失败与重试均保留当前输入。`);
        const commentRows = repo.fullName === this.fixture.repository.fullName && row.number === 184 ? catalog.comments184 : (source.commentItems || Array.from({ length: row.comments || 0 }, (_, index) => ({ id: `c-${row.number}-${index}`, login: index % 2 ? 'chen-yu' : 'team-member', author: index % 2 ? '陈雨' : '林舟', initials: index % 2 ? '陈' : '林', time: '今天', text: catalog.commentNotes[index % catalog.commentNotes.length] })));
        return { ...clone(row), body, author: source.author || '陈雨', authorLogin: source.authorLogin || 'chen-yu', created: source.created || '11 月 3 日', milestone: source.milestone || '', revision: 1, commentItems: clone(commentRows), comments: commentRows.length, activities: source.activities || [{ text: '陈雨 创建了此 Issue', time: '11 月 3 日' }], relatedPr: source.relatedPr || '', attachment: source.attachment || '' };
      });
    }
    const tasks = {};
    if (!alternate) {
      tasks[`${this.fixture.repository.fullName}#184`] = { current: { id: 'IH-184-1', status: 'linked', title: this.fixture.detail.task.title, reference: 'IH-184-1', prompt: '继续修复仓库切换后的评论筛选，验证账号隔离和评论草稿保留。' }, history: [] };
      tasks[`${this.fixture.repository.fullName}#183`] = { current: { id: 'IH-183-1', status: 'draft', title: this.fixture.issues.find((issue) => issue.number === 183).title, prompt: '请分析工作区选择记忆问题，先复现，再提出修复与验证步骤。' }, history: [] };
      tasks[`${this.fixture.repository.fullName}#182`] = { current: { id: 'IH-182-1', status: 'pending', title: this.fixture.issues.find((issue) => issue.number === 182).title, prompt: '请分析断网后评论草稿丢失问题。' }, history: [] };
    }
    return { repositories, issues, tasks, drafts: {}, preferences: {}, bindings: {}, lastSuccess: this.fixture.sync.time };
  }
  commit(next) { this.write(this.key, next); this.data = this.read(this.key, next); }
  consumeFault(name) {
    const key = `${this.namespace}:fault:${this.identity}:${name}`;
    if (this.read(key, false)) return false;
    this.write(key, true);
    return true;
  }
  async load() {
    const revision = this.revision;
    await wait(this.scenario === 'loading' ? 1800 : 90);
    if (revision !== this.revision) throw new StoreError('stale', '账号已变化，已忽略旧账号结果。');
    if (this.scenario === 'unavailable' && this.consumeFault('load')) throw new StoreError('unavailable', '仓库暂时无法读取。请重试，当前筛选不会丢失。');
    return this.data;
  }
  list(repo) { return clone(this.data.issues[repo] || []); }
  issue(repo, number) { return clone((this.data.issues[repo] || []).find((issue) => issue.number === Number(number))); }
  preference(repo) { return clone(this.data.preferences[repo] || { query: '', state: 'open', label: '', assignee: '', scroll: 0 }); }
  savePreference(repo, value) { this.hydrate(); const next = clone(this.data); next.preferences[repo] = clone(value); this.commit(next); }
  draftKey(repo, number, kind) { return `${repo}#${number}:${kind}`; }
  draft(repo, number, kind) { return clone(this.data.drafts[this.draftKey(repo, number, kind)] || null); }
  commentDraft(repo, number) {
    const prefix = `${repo}#${number}:comment`;
    return clone(Object.entries(this.data.drafts).filter(([key]) => key === prefix || key.startsWith(`${prefix}:`)).map(([, value]) => value).sort((a, b) => (b.savedTick || 0) - (a.savedTick || 0))[0] || null);
  }
  saveDraft(repo, number, kind, value) {
    if (this.scenario === 'draft-error' && this.consumeFault('draft')) throw new StoreError('draft', '本机草稿保存失败。请重试，或明确放弃当前输入。');
    this.hydrate();
    const next = clone(this.data);
    const key = this.draftKey(repo, number, kind);
    if (value === null) delete next.drafts[key]; else next.drafts[key] = { ...clone(value), savedAt: timeNow(), savedTick: Date.now() };
    this.commit(next);
  }
  async beforeWrite() {
    if (this.readonly) throw new StoreError('permission', '当前账号只有读取权限。请联系仓库维护者申请写入权限。');
    if (!this.online) throw new StoreError('offline', '当前离线。请保存本机草稿，恢复连接后手动提交。');
    const revision = this.revision;
    await wait(180);
    if (revision !== this.revision) throw new StoreError('stale', '账号已变化，本次保存没有应用到新账号。');
    // 写前读回共享本机状态，用编辑基线发现其他页面已保存的变化。
    this.hydrate();
    if (this.scenario === 'save-error' && this.consumeFault('save')) throw new StoreError('save', '保存失败，输入已保留。请重试。');
  }
  async saveIssue(repo, values, { force = false } = {}) {
    await this.beforeWrite();
    const next = clone(this.data);
    const rows = next.issues[repo];
    const index = rows.findIndex((issue) => issue.number === values.number);
    if (index >= 0 && this.scenario === 'conflict' && !force && this.consumeFault('conflict')) {
      rows[index].body += '\n\n远端补充：请同时验证快速连续切换两个仓库。';
      rows[index].revision += 1;
      this.commit(next);
      throw new StoreError('conflict', '远端已有新修改。你的输入已保留，请比较后决定采用哪份。', { remote: clone(rows[index]) });
    }
    if (index >= 0 && values.revision !== rows[index].revision && !force) throw new StoreError('conflict', '远端内容已变化，请先比较。', { remote: clone(rows[index]) });
    const number = index >= 0 ? values.number : Math.max(0, ...rows.map((issue) => issue.number)) + 1;
    const original = index >= 0 ? rows[index] : { number, state: 'open', author: this.account.name, authorLogin: this.account.login, created: '刚刚', commentItems: [], comments: 0, activities: [] };
    const result = { ...original, number, title: values.title.trim(), updated: '刚刚', revision: (original.revision || 0) + 1, activities: [...original.activities, { text: `${this.account.name} ${index >= 0 ? '更新了内容与属性' : '创建了此 Issue'}`, time: timeNow() }] };
    // 只提交表单可编辑字段，不用旧编辑快照覆盖新评论、作者和活动记录。
    for (const field of ['body', 'labels', 'assignee', 'milestone', 'state']) if (values[field] !== undefined) result[field] = clone(values[field]);
    if (index >= 0) rows[index] = result; else rows.unshift(result);
    delete next.drafts[this.draftKey(repo, index >= 0 ? number : 'new', 'issue')];
    next.lastSuccess = timeNow();
    this.commit(next);
    return this.issue(repo, number);
  }
  async changeState(repo, number) {
    const issue = this.issue(repo, number);
    return this.saveIssue(repo, { ...issue, state: issue.state === 'open' ? 'closed' : 'open' });
  }
  async saveComment(repo, number, text, commentId = null, expectedText = undefined) {
    const baseline = expectedText === undefined && commentId ? this.issue(repo, number)?.commentItems.find((row) => row.id === commentId)?.text : expectedText;
    await this.beforeWrite();
    const next = clone(this.data);
    const issue = next.issues[repo].find((row) => row.number === number);
    if (commentId) {
      const comment = issue.commentItems.find((row) => row.id === commentId);
      if (!comment || comment.login !== this.account.login) throw new StoreError('permission', '只能编辑当前账号发表的评论。');
      if (comment.text !== baseline) throw new StoreError('conflict', '这条评论已有新修改。输入已保留，请重新读取后合并再提交。');
      comment.text = text.trim(); comment.edited = true; comment.time = '刚刚';
    } else issue.commentItems.push({ id: `c-${Date.now()}`, login: this.account.login, author: this.account.name, initials: this.account.initials, time: '刚刚', text: text.trim() });
    issue.comments = issue.commentItems.length;
    issue.updated = '刚刚';
    issue.activities.push({ text: `${this.account.name} ${commentId ? '编辑了评论' : '发表了评论'}`, time: timeNow() });
    delete next.drafts[this.draftKey(repo, number, commentId ? `comment:${commentId}` : 'comment')];
    next.lastSuccess = timeNow(); this.commit(next);
    return this.issue(repo, number);
  }
  async refresh({ manual = false } = {}) {
    if (manual && this.scenario === 'account-change' && this.identity === this.fixture.account.login) {
      this.revision += 1;
      this.identity = this.fixture.prototype.accounts[1].login;
      this.write(`${this.namespace}:identity`, this.identity);
      this.hydrate();
      return { accountChanged: true };
    }
    if (!this.online) throw new StoreError('offline', '仍处于离线状态，正在显示缓存。');
    const revision = this.revision;
    await wait(450);
    if (revision !== this.revision) throw new StoreError('stale', '已忽略旧账号刷新结果。');
    this.hydrate();
    const next = clone(this.data); next.lastSuccess = timeNow(); this.commit(next);
    return { accountChanged: false };
  }
  task(repo, number) { return clone(this.data.tasks[`${repo}#${number}`] || { current: null, history: [] }); }
  workspaces(repo) { return clone(this.fixture.prototype.workspaces[repo] || [{ id: 'main', name: '主工作区', path: `E:/Work/${repo.split('/')[1]}`, valid: true }]); }
  binding(repo) {
    const id = this.data.bindings[repo];
    if (this.scenario === 'invalid-workspace' && !id) return { id: 'missing', valid: false, path: 'E:/Work/已移除的目录' };
    return this.workspaces(repo).find((workspace) => workspace.id === id) || null;
  }
  bind(repo, id) {
    const workspace = this.workspaces(repo).find((row) => row.id === id && row.valid);
    if (!workspace) throw new StoreError('workspace', '这个目录已失效，请选择一个可用工作区。');
    this.hydrate(); const next = clone(this.data); next.bindings[repo] = id; this.commit(next);
    return workspace;
  }
  createTask(repo, number) {
    this.hydrate();
    const issue = this.issue(repo, number);
    const next = clone(this.data);
    const key = `${repo}#${number}`;
    const prior = next.tasks[key] || { current: null, history: [] };
    const id = `IH-${number}-${Date.now()}`;
    const current = { id, title: issue.title, status: 'draft', prompt: `请处理 ${repo} #${number}：${issue.title}\n\n${issue.body}\n\n请先分析和复现，再实施修复并验证；如需澄清，先说明。` };
    next.tasks[key] = { current, history: prior.current ? [...prior.history, prior.current] : prior.history };
    this.commit(next); return clone(current);
  }
  advanceTask(repo, number, action) {
    this.hydrate();
    const next = clone(this.data);
    const task = next.tasks[`${repo}#${number}`]?.current;
    if (!task) throw new StoreError('task', '没有可恢复的任务请求。');
    if (action === 'sent' && task.status === 'draft') task.status = 'requested';
    else if (action === 'check' && task.status === 'requested') task.status = 'pending';
    else if (action === 'check' && task.status === 'pending') {
      task.status = this.scenario === 'ambiguous' ? 'ambiguous' : 'linked';
      if (task.status === 'linked') task.reference = task.id;
    } else if (action === 'resolve' && task.status === 'ambiguous') { task.status = 'linked'; task.reference = task.id; }
    this.commit(next); return clone(task);
  }
}
