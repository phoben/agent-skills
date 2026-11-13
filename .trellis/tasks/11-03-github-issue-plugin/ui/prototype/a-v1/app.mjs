import { PrototypeStore } from './store.mjs';
import { esc, icon, labels, button, options, taskText, taskAction, taskDestination, bodyMarkup, issueForm } from './ui.mjs';

const params = new URLSearchParams(location.search);
if (['dark', 'light'].includes(params.get('theme'))) document.documentElement.dataset.theme = params.get('theme');
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const fixture = await fetch('./fixture.json').then((response) => {
  if (!response.ok) throw new Error('读取本机内容失败');
  return response.json();
}).catch(() => null);
if (!fixture) {
  $('#queue').innerHTML = '<div class="empty"><h1>无法读取仓库内容</h1><p>请重新打开页面后重试。</p><button class="button" onclick="location.reload()">重试</button></div>';
  throw new Error('无法读取本机原型数据');
}
const store = new PrototypeStore(fixture, { scenario: params.get('scenario'), run: params.get('run') });
const state = {
  repo: store.data.repositories[0]?.fullName || '', selected: null, filters: null, editor: null, comment: '', commentId: null, commentBase: null,
  visibleComments: 2, discussionTab: 'comments', notice: '', globalMessage: '', loading: true, loadError: '', saving: false,
  commentError: '', formError: '', conflict: null, draftSaved: false, refreshing: false, repoQuery: '', queueFocus: null,
};
state.filters = store.preference(state.repo);
let overlayReturn = null;
let draftTimer = null;
let statusTimer = null;
let firstReadyEntered = false;
let pendingNavigation = null;
let taskIntent = null;
let modalOnClose = null;
const overlay = $('#overlay-root');
const repositoryTrigger = $('#repository-drawer');
const repositoryBar = $('.mobile-bar');
const announce = (message) => { $('#announcer').textContent = message; };
const current = () => store.issue(state.repo, state.selected);
const writable = () => !store.readonly;
const action = (name, text, className = '', extra = '') => button(name, text, { className, extra });
const hasEditor = () => Boolean(state.editor || state.commentId || state.comment.trim() || (state.selected && store.draft(state.repo, state.selected, 'comment')));

function status(updated = false) {
  $('#statusbar').innerHTML = `${icon(store.online ? 'check' : 'issue')}<span>${state.refreshing ? '检查中…' : store.online ? '最近检查' : '离线缓存'}</span><span class="last-success">· 最后成功 ${esc(store.data.lastSuccess)}</span><span class="sync-cadence">· 每 60 秒检查</span><span class="status-account">当前账号 ${esc(store.account.login)}</span>${action('refresh', '手动刷新', 'plain', state.refreshing ? 'disabled' : '')}`;
  if (updated) {
    $('#statusbar').dataset.updated = 'true';
    clearTimeout(statusTimer); statusTimer = setTimeout(() => delete $('#statusbar').dataset.updated, 600);
  }
}
function repoButtons(query = '') {
  const repositories = store.data.repositories.filter((repo) => repo.fullName.toLowerCase().includes(query.toLowerCase()));
  const focusRepo = repositories.some((repo) => repo.fullName === state.repo) ? state.repo : repositories[0]?.fullName;
  return repositories.map((repo) => `<button class="repo ${repo.fullName === state.repo ? 'current' : ''}" data-action="repository" data-repo="${esc(repo.fullName)}" tabindex="${repo.fullName === focusRepo ? 0 : -1}" ${repo.fullName === state.repo ? 'aria-current="page"' : ''}>${icon('repo')}<span class="repo-name">${esc(repo.name)}</span><span class="repo-count">${store.list(repo.fullName).filter((issue) => issue.state === 'open').length}</span></button>`).join('') || '<p class="muted">没有匹配的仓库</p>';
}
function renderNav() {
  $('#navigation').innerHTML = `<div class="brand">${icon('issue')}${esc(fixture.appName)}</div><label class="repo-search-label" for="repository-search">搜索仓库</label><input class="repo-search" id="repository-search" value="${esc(state.repoQuery)}" autocomplete="off"><div class="nav-section">仓库 · ${esc(store.data.repositories.find((repo) => repo.fullName === state.repo)?.owner || '')}</div><div class="repository-list" id="repository-list">${repoButtons(state.repoQuery)}</div><div class="nav-bottom">${esc(fixture.workspace.name)}<strong>⎇ ${esc(fixture.workspace.branch)}</strong></div>`;
  $('#mobile-repository').textContent = state.repo;
}
function syncRepositoryHeader() {
  const detailOnly = matchMedia('(max-width:899px)').matches && Boolean(state.selected || state.editor);
  const merged = matchMedia('(max-width:1050px)').matches && !detailOnly;
  const destination = merged ? $('.queue-context') : repositoryBar;
  const wasFocused = document.activeElement === repositoryTrigger;
  if (destination && repositoryTrigger.parentElement !== destination) destination.prepend(repositoryTrigger);
  $('#app').dataset.repositoryHeader = merged ? 'merged' : 'separate';
  if (wasFocused && repositoryTrigger.isConnected) repositoryTrigger.focus({ preventScroll: true });
}
function filteredIssues() {
  const f = state.filters;
  return store.list(state.repo).filter((issue) => (!f.state || f.state === 'all' || issue.state === f.state) && (!f.query || `${issue.number} ${issue.title} ${issue.body}`.toLowerCase().includes(f.query.toLowerCase())) && (!f.label || issue.labels.includes(f.label)) && (!f.assignee || issue.assignee === f.assignee));
}
function renderQueue() {
  const repositoryWasFocused = document.activeElement === repositoryTrigger;
  const rows = store.list(state.repo);
  const counts = { open: rows.filter((issue) => issue.state === 'open').length, closed: rows.filter((issue) => issue.state === 'closed').length, all: rows.length };
  $('#queue').innerHTML = `<header class="queue-toolbar"><div class="queue-context"><h1 id="queue-title" tabindex="-1">${esc(state.repo)}</h1><div class="quiet-tools">${button('refresh', '', { className: 'plain icon-button', symbol: 'refresh', extra: 'aria-label="刷新 Issue" title="刷新"' })}${writable() ? button('new-issue', '', { className: 'plain icon-button', symbol: 'plus', extra: 'aria-label="新建 Issue" title="新建 Issue"' }) : ''}</div></div><label class="search-label" for="issue-search">搜索 Issue</label><input id="issue-search" class="issue-search" type="search" value="${esc(state.filters.query)}" autocomplete="off"><div class="queue-filters"><label for="filter-label">标签 <select id="filter-label">${options(['', ...fixture.prototype.labels], state.filters.label, '全部')}</select></label><label for="filter-assignee">负责人 <select id="filter-assignee">${options(['', ...fixture.prototype.assignees], state.filters.assignee, '全部')}</select></label></div><div class="queue-tabs">${['open', 'closed', 'all'].map((tab) => `<button class="queue-tab ${state.filters.state === tab ? 'active' : ''}" data-action="filter-state" data-state="${tab}" aria-pressed="${state.filters.state === tab}">${{ open: '打开', closed: '已关闭', all: '全部' }[tab]} ${counts[tab]}</button>`).join('')}<span class="sort-label">最近更新</span></div></header>${state.globalMessage ? `<div class="banner global-message" role="status">${esc(state.globalMessage)}</div>` : ''}${!store.online ? `<div class="banner global-message">离线缓存，可继续保存本机草稿。${action('reconnect', '重新连接', 'plain')}</div>` : ''}${store.readonly ? '<div class="banner global-message">当前账号只有读取权限，无法修改 Issue 或评论。</div>' : ''}<div class="issue-list" id="issue-list" aria-label="Issue 列表"></div><div class="queue-bottom" id="queue-bottom"></div>`;
  renderRows();
  const list = $('#issue-list');
  list.scrollTop = state.filters.scroll || 0;
  list.addEventListener('scroll', () => { state.filters.scroll = list.scrollTop; }, { passive: true });
  syncRepositoryHeader();
  if (repositoryWasFocused) repositoryTrigger.focus({ preventScroll: true });
}
function renderRows() {
  const list = $('#issue-list');
  if (!list) return;
  if (state.loading) {
    list.innerHTML = '<div class="initial-load" role="status">正在读取 Issue…</div>' + '<div class="skeleton-row" aria-hidden="true"></div>'.repeat(8);
    $('#queue-bottom').textContent = '读取中，数量尚未获取'; return;
  }
  if (state.loadError) {
    list.innerHTML = `<div class="empty"><h2>无法读取仓库</h2><p>${esc(state.loadError)}</p>${action('retry-load', '重试')}</div>`;
    $('#queue-bottom').textContent = '内容尚未获取'; return;
  }
  const rows = filteredIssues();
  const focusNumber = rows.some((issue) => issue.number === state.queueFocus) ? state.queueFocus : rows[0]?.number;
  const emptyRepo = store.list(state.repo).length === 0;
  list.innerHTML = rows.length ? rows.map((issue) => `<button class="issue-row ${issue.number === state.selected ? 'selected' : ''}" data-action="open-issue" data-number="${issue.number}" id="issue-row-${issue.number}" tabindex="${issue.number === focusNumber ? 0 : -1}" ${issue.number === state.selected ? 'aria-current="true"' : ''} title="${esc(issue.title)}"><span class="issue-line">${icon(issue.state === 'open' ? 'issue' : 'closed')}<span class="number">#${issue.number}</span><span class="issue-title">${esc(issue.title)}</span></span><span class="issue-meta">${labels(issue.labels.slice(0, 2))}<span>${esc(issue.assignee)}</span><time>${esc(issue.updated)}</time></span></button>`).join('') : `<div class="empty"><h2>${emptyRepo ? '此仓库暂无 Issue' : '没有符合条件的 Issue'}</h2><p>${emptyRepo ? '为仓库记下第一项需要处理的工作。' : '试着调整搜索、状态、标签或负责人。'}</p>${emptyRepo ? (writable() ? action('new-issue', '新建 Issue') : '') : action('clear-filters', '清除筛选')}</div>`;
  $('#queue-bottom').textContent = `${rows.length} 条${rows.length !== store.list(state.repo).length ? '符合当前筛选' : ' Issue'} · 按最近更新排序`;
}
function syncLayout() {
  const opened = Boolean(state.selected || state.editor);
  $('#workspace').classList.toggle('has-detail', opened);
  $('#detail').hidden = !opened;
  syncRepositoryHeader();
}
function renderDetail({ focus = false } = {}) {
  syncLayout();
  if (!state.selected && !state.editor) { $('#detail').innerHTML = ''; return; }
  if (state.editor) {
    $('#detail').innerHTML = issueForm(state.editor, fixture, { isNew: !state.editor.number, offline: !store.online, error: state.formError, conflict: state.conflict, busy: state.saving, saved: state.draftSaved });
  } else {
    const issue = current();
    if (!issue) { state.selected = null; syncLayout(); return; }
    const task = store.task(state.repo, issue.number).current;
    // 标题只来自已确认的会话记录；当前工作区不能代替缺失的历史会话工作区快照。
    const destination = taskDestination(task);
    const attribute = (name, content) => `<div class="property"><span class="property-name">${name}</span>${writable() ? `<button class="button property-edit" data-action="edit-issue" aria-label="编辑${name}">${content}</button>` : `<span class="property-value">${content}</span>`}</div>`;
    $('#detail').innerHTML = `${state.notice ? `<div class="notice" role="status">${esc(state.notice)}</div>` : ''}<header class="detail-header"><div class="detail-eyebrow"><span class="number">#${issue.number}</span><span class="open-state">${icon(issue.state === 'open' ? 'issue' : 'closed')}${issue.state === 'open' ? '打开' : '已关闭'}</span><span>${esc(issue.author)} · ${esc(issue.created)} 创建</span><div class="detail-tools">${button('issue-menu', '更多', { className: 'plain', symbol: 'down', extra: 'id="issue-more" aria-haspopup="menu" aria-expanded="false"' })}${button('close-detail', '', { className: 'plain icon-button close-detail', symbol: 'close', extra: 'id="close-detail" aria-label="返回列表" title="返回列表"' })}</div></div><h1 id="detail-title" tabindex="-1">${esc(issue.title)}</h1><div class="action-row ${task?.status === 'linked' ? 'has-confirmed-destination' : ''}">${button('task', esc(taskAction(task?.status)), { className: state.comment.trim() ? '' : 'primary', symbol: 'chat', extra: 'id="task-primary"' })}${button('task-menu', '', { className: 'plain icon-button', symbol: 'down', extra: 'id="task-more" aria-label="会话操作" aria-haspopup="menu" aria-expanded="false"' })}${destination}</div></header><div class="properties">${attribute('标签', labels(issue.labels) || '无标签')}${attribute('负责人', esc(issue.assignee))}${attribute('里程碑', esc(issue.milestone || '无里程碑'))}<div class="property"><span class="property-name">更新</span><span>${esc(issue.updated)}</span></div></div><article class="doc">${bodyMarkup(issue.body)}<div class="related-links">${issue.relatedPr ? `<a href="https://github.com/${esc(state.repo)}/pull/176" data-action="source-pr">${esc(issue.relatedPr)}</a>` : ''}${issue.attachment ? `<button class="button plain" data-action="download-attachment">${icon('file')}${esc(issue.attachment.name)}</button>` : ''}</div></article><section class="discussion"><div class="discussion-tabs"><button data-action="discussion-tab" data-tab="comments" class="${state.discussionTab === 'comments' ? 'active' : ''}" aria-pressed="${state.discussionTab === 'comments'}">讨论 · ${issue.commentItems.length}</button><button data-action="discussion-tab" data-tab="activities" class="${state.discussionTab === 'activities' ? 'active' : ''}" aria-pressed="${state.discussionTab === 'activities'}">活动</button>${state.discussionTab === 'comments' ? `<span class="loaded-count">已加载 ${Math.min(state.visibleComments, issue.commentItems.length)} / ${issue.commentItems.length}</span>` : ''}</div><div id="discussion-content">${state.discussionTab === 'comments' ? commentMarkup(issue) : `<ol class="activity-list">${issue.activities.map((item) => `<li>${esc(item.text)}<time>${esc(item.time)}</time></li>`).join('')}</ol>`}</div>${writable() ? commentEditor() : ''}</section>`;
  }
  if (focus) requestAnimationFrame(() => $('#detail-title')?.focus({ preventScroll: true }));
}
function commentMarkup(issue) {
  return issue.commentItems.slice(0, state.visibleComments).map((comment) => `<article class="comment" data-comment-id="${esc(comment.id)}"><div class="comment-head"><span class="avatar">${esc(comment.initials)}</span><strong>${esc(comment.author)}</strong><time>${esc(comment.time)}${comment.edited ? ' · 已编辑' : ''}</time>${writable() && comment.login === store.account.login ? button('edit-comment', '编辑', { className: 'plain', extra: `data-comment-id="${esc(comment.id)}" aria-label="编辑 ${esc(comment.author)}的评论"` }) : ''}</div><p>${esc(comment.text)}</p></article>`).join('') + (issue.commentItems.length === 0 ? '<p class="muted">还没有讨论，写下第一条回复。</p>' : '') + (state.visibleComments < issue.commentItems.length ? `<div class="pagination">${action('more-comments', '加载更多评论')}</div>` : '');
}
function commentEditor() {
  return `<form id="comment-form" class="comment-editor" novalidate><label for="comment-body">${state.commentId ? '编辑我的评论' : '回复讨论'}</label><textarea id="comment-body" name="comment" rows="3">${esc(state.comment)}</textarea><div id="comment-error" class="form-error" ${state.commentError ? '' : 'hidden'} role="alert" tabindex="-1">${esc(state.commentError)}</div><div class="form-actions"><span id="comment-draft-status" class="draft-label">${state.draftSaved ? '本机草稿已恢复' : '按 Enter 换行'}</span>${state.commentId ? action('cancel-comment', '取消编辑') : ''}<button type="submit" id="save-comment" class="button ${state.comment.trim() ? 'primary' : ''}" ${state.saving ? 'disabled' : ''}>${state.saving ? '保存中…' : !store.online ? '保存本机草稿' : state.commentId ? '保存评论' : '发表评论'}</button></div></form>`;
}
function renderAll() { renderNav(); renderQueue(); renderDetail(); status(); }
function resetDetail() {
  state.editor = null; state.comment = ''; state.commentId = null; state.commentBase = null; state.commentError = ''; state.formError = ''; state.conflict = null; state.notice = ''; state.draftSaved = false; state.visibleComments = 2; state.discussionTab = 'comments';
}
function persistPreference() { try { store.savePreference(state.repo, state.filters); } catch (error) { announce(error.message); } }
function captureInputs() {
  const form = $('#issue-form');
  if (form && state.editor) {
    state.editor = { ...state.editor, title: $('#issue-title', form).value, body: $('#issue-body', form).value, labels: $$('input[name="labels"]:checked', form).map((field) => field.value), assignee: $('#issue-assignee', form).value, milestone: $('#issue-milestone', form).value };
  }
  if ($('#comment-body')) state.comment = $('#comment-body').value;
}
function flushDrafts() {
  clearTimeout(draftTimer); captureInputs();
  if (state.editor) store.saveDraft(state.repo, state.editor.number || 'new', 'issue', state.editor);
  if (state.selected) {
    const kind = state.commentId ? `comment:${state.commentId}` : 'comment';
    if (state.comment.trim() || state.commentId) store.saveDraft(state.repo, state.selected, kind, { text: state.comment, commentId: state.commentId, baseText: state.commentBase });
    else if (store.draft(state.repo, state.selected, kind)) store.saveDraft(state.repo, state.selected, kind, null);
  }
}
function preserveBefore(callback) {
  if (state.saving) { announce('正在保存，请稍候再切换。'); return; }
  try { flushDrafts(); persistPreference(); return callback(); }
  catch (error) {
    pendingNavigation = callback;
    openModal('草稿尚未保存', `<p class="form-error">${esc(error.message)}</p><p>当前输入仍在页面中。重试保存成功后再离开，或明确放弃当前输入。</p>`, `${action('stay', '继续编辑')}${action('discard-leave', '放弃输入并离开')}${action('retry-leave', '重试保存并离开', 'primary')}`);
  }
}
function scheduleDraft() {
  clearTimeout(draftTimer);
  // 本场景把首次失败留给明确的导航操作，方便重复核对阻止离开的恢复路径。
  if (store.scenario === 'draft-error' && !store.read(`${store.namespace}:fault:${store.identity}:draft`, false)) {
    if ($('#comment-draft-status')) $('#comment-draft-status').textContent = '草稿尚未保存';
    return;
  }
  draftTimer = setTimeout(() => {
    try { flushDrafts(); state.draftSaved = true; if ($('#comment-draft-status')) $('#comment-draft-status').textContent = '本机草稿已保存，尚未发布'; }
    catch (error) { if ($('#comment-draft-status')) $('#comment-draft-status').textContent = error.message; else showFormError(error.message); }
  }, 500);
}
function openIssue(number) {
  preserveBefore(() => {
    resetDetail(); state.selected = Number(number); state.queueFocus = state.selected;
    const issueDraft = store.draft(state.repo, state.selected, 'issue');
    const commentDraft = store.commentDraft(state.repo, state.selected);
    if (issueDraft && writable()) { state.editor = issueDraft; state.draftSaved = true; }
    if (commentDraft && writable()) { state.comment = commentDraft.text; state.commentId = commentDraft.commentId || null; state.commentBase = commentDraft.baseText ?? current()?.commentItems.find((comment) => comment.id === state.commentId)?.text ?? null; state.draftSaved = true; }
    renderRows(); renderDetail({ focus: true }); $('#detail').scrollTop = 0;
  });
}
function closeDetail() {
  const number = state.selected;
  preserveBefore(() => {
    resetDetail(); state.selected = null; renderRows(); renderDetail();
    requestAnimationFrame(() => {
      const row = $(`#issue-row-${number}`);
      if (row) { row.tabIndex = 0; row.focus({ preventScroll: true }); }
      else { $('#queue-title').focus(); announce('原 Issue 不在当前筛选结果中，已返回列表。'); }
    });
  });
}
function switchRepository(repo) {
  preserveBefore(() => {
    closeOverlay(false); resetDetail(); state.selected = null; state.queueFocus = null; state.repo = repo;
    state.filters = store.preference(repo); state.globalMessage = ''; renderAll(); $('#queue-title').focus({ preventScroll: true });
  });
}
function editIssue(isNew = false) {
  preserveBefore(() => {
    const issue = isNew ? { title: '', body: '', labels: [], assignee: '未分配', milestone: '' } : current();
    if (!issue) return;
    state.editor = store.draft(state.repo, isNew ? 'new' : state.selected, 'issue') || issue;
    state.formError = ''; state.conflict = null; state.notice = ''; state.draftSaved = Boolean(store.draft(state.repo, isNew ? 'new' : state.selected, 'issue'));
    if (isNew) state.selected = null;
    renderRows(); renderDetail(); $('#issue-title')?.focus();
  });
}
function showFormError(message) {
  state.formError = message;
  const error = $('#form-error');
  if (error) { error.textContent = message; error.hidden = false; error.focus(); }
}
function lockForm(form, locked) {
  if (form) $$('input,textarea,select', form).forEach((field) => field.disabled = locked);
}
async function saveIssue(force = false) {
  if (state.saving) return;
  captureInputs();
  if (!state.editor.title.trim()) {
    $('#title-error').textContent = '请填写标题。'; $('#issue-title').setAttribute('aria-invalid', 'true'); $('#issue-title').focus(); return;
  }
  if (!store.online) {
    try { flushDrafts(); state.draftSaved = true; showFormError('已保存本机草稿，尚未发布。恢复连接后请手动保存。'); }
    catch (error) { showFormError(error.message); } return;
  }
  state.saving = true; state.formError = '';
  const input = structuredClone(state.editor); const repo = state.repo; const identity = store.identity;
  $('#save-issue').disabled = true; $('#save-issue').textContent = '保存中…';
  try {
    flushDrafts();
    lockForm($('#issue-form'), true);
    const result = await store.saveIssue(repo, input, { force });
    if (identity !== store.identity || repo !== state.repo) return;
    state.saving = false; resetDetail(); state.selected = result.number; state.queueFocus = result.number;
    if (!filteredIssues().some((issue) => issue.number === result.number)) state.filters.state = 'all';
    state.notice = '已保存并重新读取。'; renderNav(); renderQueue(); renderDetail({ focus: true }); status(true);
  } catch (error) {
    if (identity !== store.identity) return;
    if (error.code === 'conflict') { state.conflict = error.remote; state.formError = error.message; renderDetail(); $('#form-error')?.focus(); }
    else showFormError(error.message);
  } finally {
    state.saving = false;
    lockForm($('#issue-form'), false);
    if ($('#save-issue')) { $('#save-issue').disabled = false; $('#save-issue').textContent = '保存'; }
  }
}
async function saveComment() {
  if (state.saving) return;
  captureInputs();
  if (!state.comment.trim()) { $('#comment-error').textContent = '请填写评论内容。'; $('#comment-error').hidden = false; $('#comment-body').focus(); return; }
  if (!store.online) {
    try { flushDrafts(); $('#comment-draft-status').textContent = '已保存本机草稿，尚未发布'; }
    catch (error) { $('#comment-error').textContent = error.message; $('#comment-error').hidden = false; } return;
  }
  state.saving = true; state.commentError = '';
  const identity = store.identity; const repo = state.repo; const number = state.selected;
  $('#save-comment').disabled = true; $('#save-comment').textContent = '保存中…';
  try {
    flushDrafts(); lockForm($('#comment-form'), true); const issue = await store.saveComment(repo, number, state.comment, state.commentId, state.commentBase);
    if (identity !== store.identity || repo !== state.repo || number !== state.selected) return;
    state.comment = ''; state.commentId = null; state.commentBase = null; state.draftSaved = false; state.visibleComments = issue.commentItems.length; state.notice = '评论已保存并重新读取。';
    renderRows(); renderDetail(); status(true); $('#comment-body')?.focus();
  } catch (error) {
    if (identity !== store.identity) return;
    state.commentError = error.message; const node = $('#comment-error'); if (node) { node.textContent = error.message; node.hidden = false; node.focus(); }
  } finally { state.saving = false; lockForm($('#comment-form'), false); if ($('#save-comment')) { $('#save-comment').disabled = false; $('#save-comment').textContent = state.commentId ? '保存评论' : '发表评论'; } }
}
async function refresh(manual = false) {
  if (state.refreshing) return;
  // 外部身份变化必须立即隐藏旧视图；旧草稿尽力保留，但不能因此继续展示旧私有内容。
  const changingAccount = manual && store.scenario === 'account-change' && store.identity === fixture.account.login;
  if (changingAccount) {
    try { flushDrafts(); } catch { /* 账号切换仍须清理旧视图，当前故障由新视图说明。 */ }
    closeOverlay(false); resetDetail(); state.selected = null; state.loading = true;
    $('#detail').innerHTML = ''; $('#navigation').innerHTML = ''; $('#queue').innerHTML = '<div class="initial-load" role="status">账号发生变化，正在读取新账号仓库…</div>'; syncLayout();
  }
  state.refreshing = true; status();
  try {
    const result = await store.refresh({ manual });
    if (result.accountChanged) {
      state.repo = store.data.repositories[0]?.fullName || ''; state.filters = store.preference(state.repo); state.repoQuery = ''; state.queueFocus = null; state.loading = false; state.globalMessage = '账号已变化。已清除旧账号视图；旧草稿仍保留在原账号下。'; renderAll();
    } else {
      const focusId = document.activeElement?.id;
      // 刷新只更新缓存列表；当前编辑器和焦点不重建。
      if (!state.editor && !$('#comment-body')?.matches(':focus')) renderRows();
      if (manual && !state.editor && !state.comment.trim() && !$('#detail').contains(document.activeElement)) {
        const scroll = $('#detail').scrollTop; renderDetail(); $('#detail').scrollTop = scroll;
      }
      if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
      if (manual) announce('检查完成，当前输入与阅读位置已保留。');
    }
  } catch (error) { announce(error.message); state.globalMessage = error.message; if (manual) { const note = document.createElement('div'); note.className = 'banner global-message'; note.textContent = error.message; $('.queue-toolbar')?.after(note); } }
  finally { state.refreshing = false; status(true); }
}

function focusables(root) { return $$('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]', root).filter((node) => !node.hidden && node.getClientRects().length > 0); }
function closeOverlay(restoreFocus = true) {
  const restore = overlayReturn;
  overlay.innerHTML = ''; overlayReturn = null;
  $('#app').inert = false;
  if (restore?.isConnected) restore.setAttribute('aria-expanded', 'false');
  const destination = restore?.isConnected ? restore : restore?.id ? document.getElementById(restore.id) : null;
  if (restoreFocus) (destination || (state.selected ? $('#task-primary') : $('#queue-title')))?.focus({ preventScroll: true });
  const callback = modalOnClose; modalOnClose = null; if (callback) callback();
}
function openModal(title, body, footer = '', { wide = false, drawer = false, onClose = null } = {}) {
  const priorReturn = overlayReturn || document.activeElement;
  closeOverlay(false); overlayReturn = priorReturn; modalOnClose = onClose;
  overlay.innerHTML = `<div class="modal-backdrop ${drawer ? 'drawer-backdrop' : ''}"><section class="modal ${wide ? 'wide' : ''} ${drawer ? 'drawer-modal' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">${esc(title)}</h2>${button('close-overlay', '', { className: 'plain icon-button', symbol: 'close', extra: 'aria-label="关闭窗口"' })}</header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-footer">${footer}</footer>` : ''}</section></div>`;
  $('#app').inert = true;
  const first = $('input,textarea,.modal-footer .primary', overlay) || $('.modal-header button', overlay);
  first?.focus();
}
function openMenu(trigger, items) {
  closeOverlay(false); overlayReturn = trigger; trigger.setAttribute('aria-expanded', 'true');
  overlay.innerHTML = `<div class="menu" role="menu" aria-label="操作菜单">${items.map((item) => `<button role="menuitem" data-action="${item.action}" ${item.extra || ''}>${esc(item.text)}</button>`).join('')}</div>`;
  const menu = $('.menu', overlay); const rect = trigger.getBoundingClientRect();
  menu.style.left = `${Math.max(10, Math.min(rect.right - 174, innerWidth - 190))}px`;
  menu.style.top = `${Math.max(10, Math.min(rect.bottom + 5, innerHeight - menu.offsetHeight - 10))}px`;
  $('button', menu)?.focus();
}
function showTask() {
  const issue = current(); const taskRecord = store.task(state.repo, issue.number); const task = taskRecord.current;
  if (!task) return createTask(false);
  let description = { draft: '草稿已准备好。发送后才开始分析、实施与验证。', requested: '请求已发送，尚未收到可确认的关联。不要重复创建同一任务。', pending: '正在核对会话关联。确认前不会提供返回会话链接。', ambiguous: '发现多个可能关联，请核对任务引用后明确选择。', linked: '此 Issue 已有确认关联，可继续查看任务上下文。' }[task.status];
  const choices = task.status === 'ambiguous' ? `<fieldset><legend>选择与当前 Issue 对应的任务</legend><label class="workspace-option"><input type="radio" name="task-reference" value="current" checked>${esc(task.title)}<span class="workspace-path">当前请求 · ${esc(task.id)}</span></label><label class="workspace-option"><input type="radio" name="task-reference" value="other">此前的独立处理记录<span class="workspace-path">请保留原关联，核对后再选择。</span></label></fieldset>` : '';
  const main = task.status === 'draft' ? action('task-sent', '标记已发送', 'primary') : ['requested', 'pending'].includes(task.status) ? action('task-check', '检查关联', 'primary') : task.status === 'ambiguous' ? action('task-resolve', '确认关联', 'primary') : '';
  openModal(task.status === 'draft' ? '会话草稿' : task.status === 'linked' ? '关联会话' : '会话关联状态', `<div class="task-status">${icon(task.status === 'linked' ? 'check' : 'chat')}${esc(taskText(task.status))}</div><h3>${esc(task.title)}</h3><p>${esc(description)}</p><p class="muted">任务引用 ${esc(task.reference || task.id)}</p>${choices}<h3>处理内容</h3><pre class="prompt">${esc(task.prompt)}</pre>${taskRecord.history.length ? `<p class="muted">已保留 ${taskRecord.history.length} 条此前任务记录与关联。</p>` : ''}`, `${action('close-overlay', '关闭')}${main}`, { wide: true });
}
function createTask(another) {
  preserveBefore(() => {
    const valid = store.workspaces(state.repo).filter((workspace) => workspace.valid);
    const binding = store.binding(state.repo);
    taskIntent = { repo: state.repo, number: state.selected, another };
    if (binding?.valid || (valid.length === 1 && !binding)) {
      if (!binding) store.bind(state.repo, valid[0].id);
      store.createTask(state.repo, state.selected); renderDetail(); showTask(); return;
    }
    openModal('选择本地工作区', `${binding && !binding.valid ? '<div class="banner">已记住的目录失效，请重新选择。</div>' : '<p>这个仓库有多个本地工作区。首次选择后将记住，之后直接复用。</p>'}<fieldset><legend>可用工作区</legend>${valid.map((workspace, index) => `<label class="workspace-option"><input type="radio" name="workspace" value="${esc(workspace.id)}" ${index === 0 ? 'checked' : ''}>${esc(workspace.name)}<span class="workspace-path">${esc(workspace.path)}</span></label>`).join('')}</fieldset>`, `${action('close-overlay', '取消')}${action('confirm-workspace', '确认绑定', 'primary')}`);
  });
}
function showDrawer() {
  openModal('仓库', `<label for="drawer-search">搜索仓库</label><input id="drawer-search" class="repo-search" type="search" autocomplete="off"><div class="repository-list" id="drawer-repositories">${repoButtons()}</div>`, '', { drawer: true });
}
function clearFilters() { preserveBefore(() => { state.filters = { query: '', state: 'open', label: '', assignee: '', scroll: 0 }; persistPreference(); renderQueue(); $('#issue-search').focus(); }); }
function applyFilter(name, value) {
  preserveBefore(() => { state.filters[name] = value; state.filters.scroll = 0; persistPreference(); renderRows(); if (name === 'state') renderQueue(); });
}
async function handleAction(name, target, event) {
  switch (name) {
    case 'repository': switchRepository(target.dataset.repo); break;
    case 'open-issue': openIssue(target.dataset.number); break;
    case 'close-detail': closeDetail(); break;
    case 'new-issue': if (writable()) editIssue(true); break;
    case 'edit-issue': closeOverlay(); if (writable()) editIssue(); break;
    case 'cancel-edit': {
      if (state.saving) break;
      clearTimeout(draftTimer);
      const number = state.editor.number || 'new';
      store.saveDraft(state.repo, number, 'issue', null); state.editor = null; state.formError = ''; state.conflict = null;
      renderDetail({ focus: true }); if (!state.selected) $('#queue-title')?.focus(); break;
    }
    case 'force-save': await saveIssue(true); break;
    case 'use-remote': store.saveDraft(state.repo, state.selected, 'issue', null); state.editor = null; state.conflict = null; state.formError = ''; state.notice = '已采用远端版本。'; renderDetail({ focus: true }); break;
    case 'refresh': await refresh(true); break;
    case 'reconnect': { captureInputs(); const scroll = $('#detail').scrollTop; store.online = true; state.globalMessage = '连接已恢复。本机草稿仍未发布，请检查后手动提交。'; renderQueue(); renderDetail(); $('#detail').scrollTop = scroll; status(true); break; }
    case 'filter-state': applyFilter('state', target.dataset.state); break;
    case 'clear-filters': clearFilters(); break;
    case 'more-comments': captureInputs(); state.visibleComments += 3; renderDetail(); $('button[data-action="more-comments"]')?.focus(); break;
    case 'discussion-tab': captureInputs(); state.discussionTab = target.dataset.tab; renderDetail(); $(`[data-tab="${state.discussionTab}"]`)?.focus(); break;
    case 'edit-comment': preserveBefore(() => { const comment = current().commentItems.find((row) => row.id === target.dataset.commentId); if (comment?.login !== store.account.login) return; const draft = store.draft(state.repo, state.selected, `comment:${comment.id}`); state.commentId = comment.id; state.comment = draft ? draft.text : comment.text; state.commentBase = draft?.baseText ?? comment.text; state.commentError = ''; renderDetail(); $('#comment-body').focus(); }); break;
    case 'cancel-comment': if (state.saving) break; clearTimeout(draftTimer); store.saveDraft(state.repo, state.selected, `comment:${state.commentId}`, null); state.commentId = null; state.commentBase = null; state.comment = ''; state.commentError = ''; renderDetail(); $('#comment-body').focus(); break;
    case 'issue-menu': openMenu(target, [...(writable() ? [{ action: 'edit-issue', text: '编辑标题、正文与属性' }, { action: 'change-state', text: current().state === 'open' ? '关闭 Issue' : '重新打开 Issue' }] : []), { action: 'source-issue', text: '查看来源链接' }]); break;
    case 'task-menu': openMenu(target, [{ action: 'another-task', text: '另建任务' }, { action: 'task', text: '查看当前任务与关联' }]); break;
    case 'change-state': {
      closeOverlay(); if (!writable() || state.saving) break;
      const repo = state.repo, number = state.selected, identity = store.identity;
      await preserveBefore(async () => {
        state.saving = true;
        try { const issue = await store.changeState(repo, number); if (identity !== store.identity || repo !== state.repo || number !== state.selected) return; state.saving = false; state.notice = issue.state === 'closed' ? 'Issue 已关闭，未自动选择下一条。' : 'Issue 已重新打开。'; renderNav(); renderQueue(); renderDetail({ focus: true }); status(true); }
        catch (error) { if (identity !== store.identity || repo !== state.repo || number !== state.selected) return; state.saving = false; state.notice = ''; renderDetail(); const note = document.createElement('div'); note.className = 'form-error'; note.setAttribute('role', 'alert'); note.textContent = error.message; $('.detail-header')?.after(note); }
        finally { state.saving = false; }
      }); break;
    }
    case 'task': if (overlay.children.length) closeOverlay(); if (store.task(state.repo, state.selected).current) showTask(); else createTask(false); break;
    case 'another-task': closeOverlay(); createTask(true); break;
    case 'confirm-workspace': {
      const chosen = $('input[name="workspace"]:checked', overlay)?.value;
      if (!chosen || !taskIntent) break;
      store.bind(taskIntent.repo, chosen); store.createTask(taskIntent.repo, taskIntent.number); closeOverlay(false); renderDetail(); showTask(); break;
    }
    case 'task-sent': store.advanceTask(state.repo, state.selected, 'sent'); showTask(); renderDetail(); break;
    case 'task-check': store.advanceTask(state.repo, state.selected, 'check'); showTask(); renderDetail(); break;
    case 'task-resolve': if ($('input[name="task-reference"]:checked', overlay)?.value === 'current') { store.advanceTask(state.repo, state.selected, 'resolve'); showTask(); renderDetail(); } else { const p = document.createElement('p'); p.className = 'form-error'; p.textContent = '这条记录不属于当前请求，请选择对应的任务，原关联保持不变。'; $('.modal-body', overlay).prepend(p); } break;
    case 'close-overlay': closeOverlay(); break;
    case 'stay': pendingNavigation = null; closeOverlay(); break;
    case 'retry-leave': { const callback = pendingNavigation; closeOverlay(false); pendingNavigation = null; if (callback) preserveBefore(callback); break; }
    case 'discard-leave': { const callback = pendingNavigation; pendingNavigation = null; clearTimeout(draftTimer); state.editor = null; state.comment = ''; state.commentId = null; state.commentBase = null; closeOverlay(false); callback?.(); break; }
    case 'source-pr': event.preventDefault(); openModal('关联 PR', `<h3>${esc(current().relatedPr)}</h3><p>来源链接</p><p><code>https://github.com/${esc(state.repo)}/pull/176</code></p><p>统一仓库上下文切换，验证迟到响应与未发布输入的隔离。</p>`, action('close-overlay', '关闭')); break;
    case 'source-issue': closeOverlay(false); openModal('Issue 来源', `<p>${esc(state.repo)} #${state.selected}</p><p><code>https://github.com/${esc(state.repo)}/issues/${state.selected}</code></p>`, action('close-overlay', '关闭')); break;
    case 'download-attachment': { const attachment = current().attachment; const url = URL.createObjectURL(new Blob([attachment.content], { type: 'text/plain;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = attachment.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 500); announce(`已下载 ${attachment.name}`); break; }
    case 'retry-load': await load(); break;
  }
}
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (target) {
    event.preventDefault();
    Promise.resolve(handleAction(target.dataset.action, target, event)).catch((error) => {
      announce(error.message); state.globalMessage = error.message;
      const node = document.createElement('div'); node.className = 'form-error'; node.setAttribute('role', 'alert'); node.textContent = error.message;
      if ($('.modal-body', overlay)) $('.modal-body', overlay).prepend(node);
      else if ($('#issue-form')) showFormError(error.message);
      else $('.queue-toolbar')?.after(node);
      status();
    });
  } else if ($('.menu', overlay) && !event.target.closest('.menu')) closeOverlay();
});
$('#repository-drawer').addEventListener('click', showDrawer);
document.addEventListener('submit', (event) => {
  if (event.target.id === 'issue-form') { event.preventDefault(); saveIssue(); }
  if (event.target.id === 'comment-form') { event.preventDefault(); saveComment(); }
});
document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.id === 'repository-search') { state.repoQuery = target.value; $('#repository-list').innerHTML = repoButtons(target.value); }
  else if (target.id === 'drawer-search') $('#drawer-repositories').innerHTML = repoButtons(target.value);
  else if (target.id === 'issue-search') applyFilter('query', target.value);
  else if (target.closest('#issue-form')) { captureInputs(); scheduleDraft(); }
  else if (target.id === 'comment-body') {
    state.comment = target.value; $('#save-comment').classList.toggle('primary', Boolean(target.value.trim())); $('#task-primary')?.classList.toggle('primary', !target.value.trim()); scheduleDraft();
  }
});
document.addEventListener('change', (event) => {
  if (event.target.id === 'filter-label') applyFilter('label', event.target.value);
  if (event.target.id === 'filter-assignee') applyFilter('assignee', event.target.value);
});
document.addEventListener('keydown', (event) => {
  const modal = $('[role="dialog"]', overlay);
  const menu = $('[role="menu"]', overlay);
  if (event.key === 'Escape' && (modal || menu)) { event.preventDefault(); closeOverlay(); return; }
  if (modal && event.key === 'Tab') {
    const nodes = focusables(modal); const first = nodes[0]; const last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } return;
  }
  if (menu) {
    const nodes = $$('[role="menuitem"]', menu); const index = nodes.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); nodes[event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length]?.focus(); }
    else if (event.key === 'Tab') closeOverlay();
    return;
  }
  // 文本编辑中的方向键、Enter 和 Esc 都保留原生输入用途。
  if (event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
  const group = event.target.closest('.repository-list,.issue-list');
  if (group && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault(); const nodes = $$('button', group); const index = nodes.indexOf(document.activeElement);
    const next = nodes[event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1 : Math.max(0, Math.min(nodes.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))];
    nodes.forEach((node) => node.tabIndex = node === next ? 0 : -1); next?.focus();
    if (next?.dataset.number) state.queueFocus = Number(next.dataset.number);
  }
});
document.addEventListener('focusin', (event) => {
  if (event.target.id === 'comment-body') { $('#task-primary')?.classList.remove('primary'); $('#save-comment')?.classList.add('primary'); }
});
document.addEventListener('focusout', (event) => {
  if (event.target.id === 'comment-body' && !state.comment.trim()) { $('#task-primary')?.classList.add('primary'); $('#save-comment')?.classList.remove('primary'); }
});
window.addEventListener('beforeunload', (event) => {
  if (!hasEditor()) return;
  try { flushDrafts(); } catch { event.preventDefault(); event.returnValue = ''; }
});
window.addEventListener('resize', () => { if ($('.menu', overlay)) closeOverlay(); syncRepositoryHeader(); });
// 后台只检查当前账号缓存，不抢焦点，也不重新挂载当前编辑器。
setInterval(() => { if (!document.hidden && !state.loading && !state.refreshing) refresh(false); }, 60000);

async function load() {
  state.loading = true; state.loadError = ''; renderAll();
  try {
    await store.load(); state.loading = false; renderAll();
    // 每次打开页面仅在首次成功读取时出场；容器不随筛选重建，用户操作可立即打断。
    if (!firstReadyEntered) {
      firstReadyEntered = true;
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        $('#app').dataset.entering = 'true';
        const controller = new AbortController();
        const finish = () => { delete $('#app').dataset.entering; controller.abort(); };
        document.addEventListener('pointerdown', finish, { signal: controller.signal });
        document.addEventListener('keydown', finish, { signal: controller.signal });
        setTimeout(finish, 320);
      }
    }
  }
  catch (error) { state.loading = false; state.loadError = error.message; renderAll(); }
}
await load();
if (!state.loadError && params.has('issue') && store.issue(state.repo, Number(params.get('issue')))) openIssue(params.get('issue'));
