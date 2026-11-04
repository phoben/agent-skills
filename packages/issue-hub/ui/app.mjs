import { App } from '@modelcontextprotocol/ext-apps';
import { LiveStore, StoreError } from './store.mjs';
import { VERSION } from '../src/version.mjs';
import { createColumnLayout } from './layout.mjs';
import { createLatestSelection } from './selection.mjs';
import { createThemeController } from './theme.mjs';
import { taskDetailsMarkup, taskHistoryMarkup, workspacePickerMarkup } from './task-views.mjs';
import { readDiagnostics, diagnosticsMarkup } from './diagnostics.mjs';
import { createSummaryPainter } from './summary.mjs';
import './style.css';
import { esc, icon, labels, button, options, taskText, taskAction, taskDestination, bodyMarkup, issueForm, safeUrl, issueCountLabels, brandMark } from './ui.mjs';

const app = new App({ name: 'Issue Hub', version: VERSION });
const themeController = createThemeController();
const summaryPainter = createSummaryPainter();
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
async function call(group, action, payload) {
  const result = await app.callServerTool({ name: { query: 'issue-hub-query', mutate: 'issue-hub-mutate', task: 'issue-hub-task' }[group], arguments: { action, payload } });
  if (result.isError || result.structuredContent?.error) {
    const error = result.structuredContent?.error;
    throw new StoreError(error?.code || 'server', error?.message || '操作未完成，请重试。', error || {});
  }
  return result.structuredContent;
}
const store = new LiveStore(call, { onIdentityChange: () => {
  selection.invalidate(); columnLayout.restore({});
  closeOverlay(false); resetDetail(); state.repo = ''; state.selected = null; state.loading = true; state.saving = false;
  state.filters = { query: '', state: 'open', label: '', assignee: '', scroll: 0 };
  $('#navigation').innerHTML = ''; $('#detail').innerHTML = ''; $('#detail').hidden = true;
  $('#queue').innerHTML = '<div class="initial-load" role="status">账号已变化，正在重新读取…</div>';
}, onRepositoryAccessLost: repo => {
  if (repo !== state.repo) return;
  clearTimeout(draftTimer); captureInputs();
  const inputs = [];
  if (state.editor) inputs.push(store.retainDraft(repo, state.editor.number || 'new', 'issue', state.editor));
  if (state.selected && (state.comment.trim() || state.commentId)) inputs.push(store.retainDraft(repo, state.selected, state.commentId ? `comment:${state.commentId}` : 'comment', { text: state.comment, commentId: state.commentId, baseText: state.commentBase }));
  selection.invalidate(); detailGeneration++; closeOverlay(false); resetDetail(); state.selected = null; state.loading = false;
  $('#detail').innerHTML = ''; $('#detail').hidden = true;
  state.loadError = '此仓库当前无法访问，已隐藏此前读取的内容。未发布输入保留在当前账号草稿中。';
  renderAll();
  const identity = store.identity;
  for (const payload of inputs) void store.saveDraft(repo, payload.number, payload.kind, payload.value).catch(() => {
    if (identity !== store.identity) return;
    state.globalMessage = '未发布输入仍保留在当前页面的账号草稿中，本机持久化尚未完成，请保留页面后重试。';
    renderQueue();
  });
} });
const state = {
  repo: store.data.repositories[0]?.fullName || '', selected: null, filters: null, editor: null, comment: '', commentId: null, commentBase: null,
  visibleComments: 2, discussionTab: 'comments', notice: '', globalMessage: '', loading: true, loadError: '', saving: false,
  commentError: '', formError: '', conflict: null, draftSaved: false, refreshing: false, repoQuery: '', queueFocus: null,
  writeOutcome: null,
  detailLoading: false, detailError: '', backgroundMessage: '',
  summaryDeferred: false,
};
state.filters = store.preference(state.repo);
let overlayReturn = null;
let draftTimer = null;
let statusTimer = null;
let firstReadyEntered = false;
let pendingNavigation = null;
let taskIntent = null;
let modalOnClose = null;
let overlayGeneration = 0;
const overlay = $('#overlay-root');
const repositoryTrigger = $('#repository-drawer');
const repositoryBar = $('.mobile-bar');
const selection = createLatestSelection();
const columnLayout = createColumnLayout({ root: $('#workspace'), onCommit: widths => {
  if (store.identity == null) return;
  void store.saveViewState(widths).catch(error => announce(`列宽已调整，本机记忆未保存：${error.message}`));
} });
const announce = (message) => { $('#announcer').textContent = message; };
const current = () => store.issue(state.repo, state.selected);
const writable = () => !store.readonly;
const permission = (name) => current()?.permissions?.[name] ?? store.repository(state.repo)?.permissions?.[name] ?? false;
const editorOptions = () => ({ labels: store.options(state.repo).labels || [], assignees: ['', ...(store.options(state.repo).assignees || [])], milestones: ['', ...(store.options(state.repo).milestones || [])] });
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
  return repositories.map((repo) => `<button class="repo ${repo.fullName === state.repo ? 'current' : ''}" data-action="repository" data-repo="${esc(repo.fullName)}" title="${esc(repo.fullName)}" aria-label="${esc(repo.fullName)}" tabindex="${repo.fullName === focusRepo ? 0 : -1}" ${repo.fullName === state.repo ? 'aria-current="page"' : ''}>${icon('repo')}<span class="repo-name">${esc(repo.fullName)}</span><span class="repo-count">${store.pages[repo.fullName] ? `${store.list(repo.fullName).filter((issue) => issue.state === 'open').length}${store.pages[repo.fullName].complete ? '' : '+'}` : '—'}</span></button>`).join('') || '<p class="muted">没有匹配的仓库</p>';
}
function renderNav() {
  $('#navigation').innerHTML = `<div class="brand">${brandMark()}Issue Hub</div><label class="repo-search-label" for="repository-search">搜索仓库</label><input class="repo-search" id="repository-search" value="${esc(state.repoQuery)}" autocomplete="off"><div class="nav-section">仓库 · ${esc(store.data.repositories.find((repo) => repo.fullName === state.repo)?.owner || '')}</div><div class="repository-list" id="repository-list">${repoButtons(state.repoQuery)}</div><div class="nav-bottom">${store.catalog?.status === 'complete' ? '项目已读取' : '项目发现范围不完整'}<strong>${action('discover', '重新发现项目', 'plain')}</strong></div>`;
  $('#mobile-repository').textContent = state.repo;
  $('.nav-bottom')?.insertAdjacentHTML('beforeend', action('reset-layout', '恢复默认列宽', 'plain'));
  $('.nav-bottom')?.insertAdjacentHTML('beforeend', action('diagnostics', '连接检查', 'plain'));
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
  const counts = issueCountLabels(rows, { known: !state.loading && !state.loadError && Boolean(store.pages[state.repo]) && store.repository(state.repo)?.access !== 'unavailable', complete: store.pages[state.repo]?.complete === true });
  $('#queue').innerHTML = `<header class="queue-toolbar"><div class="queue-context"><h1 id="queue-title" tabindex="-1">${esc(state.repo)}</h1><div class="quiet-tools">${button('refresh', '', { className: 'plain icon-button', symbol: 'refresh', extra: 'aria-label="刷新 Issue" title="刷新"' })}${store.repository(state.repo)?.permissions?.createIssue ? button('new-issue', '', { className: 'plain icon-button', symbol: 'plus', extra: 'aria-label="新建 Issue" title="新建 Issue"' }) : ''}</div></div><label class="search-label" for="issue-search">搜索 Issue</label><input id="issue-search" class="issue-search" type="search" value="${esc(state.filters.query)}" autocomplete="off"><div class="queue-filters"><label for="filter-label">标签 <select id="filter-label">${options(['', ...editorOptions().labels], state.filters.label, '全部')}</select></label><label for="filter-assignee">负责人 <select id="filter-assignee">${options(['', ...editorOptions().assignees.filter(Boolean)], state.filters.assignee, '全部')}</select></label></div><div class="queue-tabs">${['open', 'closed', 'all'].map((tab) => `<button class="queue-tab ${state.filters.state === tab ? 'active' : ''}" data-action="filter-state" data-state="${tab}" aria-pressed="${state.filters.state === tab}">${{ open: '打开', closed: '已关闭', all: '全部' }[tab]} ${counts[tab]}</button>`).join('')}<span class="sort-label">最近更新 · 已加载</span></div></header>${state.globalMessage ? `<div class="banner global-message" role="status">${esc(state.globalMessage)}</div>` : ''}${!store.online ? `<div class="banner global-message">离线缓存，可继续保存本机草稿。${action('reconnect', '重新连接', 'plain')}</div>` : ''}${store.readonly ? '<div class="banner global-message">当前账号只有读取权限，无法修改 Issue 或评论。</div>' : ''}<div class="issue-list" id="issue-list" aria-label="Issue 列表"></div><div class="queue-bottom" id="queue-bottom"></div>`;
  renderRows();
  const list = $('#issue-list');
  list.scrollTop = state.filters.scroll || 0;
  list.addEventListener('scroll', () => { state.filters.scroll = list.scrollTop; }, { passive: true });
  syncRepositoryHeader();
  renderBackgroundStatus();
  if (repositoryWasFocused) repositoryTrigger.focus({ preventScroll: true });
}
function renderBackgroundStatus() {
  $('.background-status')?.remove();
  if (!state.backgroundMessage) return;
  const node = document.createElement('div'); node.className = 'background-status'; node.setAttribute('role', 'status'); node.textContent = state.backgroundMessage;
  $('.queue-toolbar')?.after(node);
}
function renderRows() {
  const list = $('#issue-list');
  if (!list) return;
  if (state.loading) {
    list.innerHTML = '<div class="initial-load" role="status">正在读取 Issue…</div>' + '<div class="skeleton-row" aria-hidden="true"></div>'.repeat(8);
    $('#queue-bottom').textContent = '读取中，数量尚未获取'; return;
  }
  if (state.loadError) {
    list.innerHTML = `<div class="empty"><h2>无法读取仓库</h2><p>${esc(state.loadError)}</p>${action('retry-load', '重试')}${action('diagnostics', '连接检查')}</div>`;
    $('#queue-bottom').textContent = '内容尚未获取'; return;
  }
  if (!state.repo) {
    if (store.catalog?.status === 'unavailable') {
      list.innerHTML = `<div class="empty"><h2>Codex项目暂时无法读取</h2><p>${esc(store.catalog.error?.message || '请稍后重新发现项目，当前结果不代表没有仓库。')}</p>${action('discover', '重新发现项目')}</div>`;
      $('#queue-bottom').textContent = '项目范围尚未核对'; return;
    }
    if (store.catalog?.status === 'loading' || store.refreshNeeded) {
      list.innerHTML = '<div class="initial-load" role="status">正在发现项目，已知仓库将在读取后出现…</div>';
      $('#queue-bottom').textContent = '项目范围正在更新'; return;
    }
    list.innerHTML = `<div class="empty"><h2>尚未发现 GitHub 仓库</h2><p>请检查 Codex 项目工作区和 Git remote 后重新发现。</p>${action('discover', '重新发现项目')}</div>`;
    $('#queue-bottom').textContent = store.catalog?.status === 'complete' ? '当前项目范围没有 GitHub 仓库' : '项目发现尚不完整'; return;
  }
  const rows = filteredIssues();
  const focusNumber = rows.some((issue) => issue.number === state.queueFocus) ? state.queueFocus : rows[0]?.number;
  const complete = store.pages[state.repo]?.complete === true;
  const emptyRepo = store.list(state.repo).length === 0 && complete;
  list.innerHTML = rows.length ? rows.map((issue) => `<button class="issue-row ${issue.number === state.selected ? 'selected' : ''}" data-action="open-issue" data-number="${issue.number}" id="issue-row-${issue.number}" tabindex="${issue.number === focusNumber ? 0 : -1}" ${issue.number === state.selected ? 'aria-current="true"' : ''} title="${esc(issue.title)}"><span class="issue-line">${icon(issue.state === 'open' ? 'issue' : 'closed')}<span class="number">#${issue.number}</span><span class="issue-title">${esc(issue.title)}</span></span><span class="issue-meta">${labels(issue.labels.slice(0, 2))}<span>${esc(issue.assignee)}</span><time>${esc(issue.updated)}</time></span></button>`).join('') : `<div class="empty"><h2>${emptyRepo ? '此仓库暂无 Issue' : '没有符合条件的 Issue'}</h2><p>${emptyRepo ? '为仓库记下第一项需要处理的工作。' : '试着调整搜索、状态、标签或负责人。'}</p>${emptyRepo ? (writable() ? action('new-issue', '新建 Issue') : '') : action('clear-filters', '清除筛选')}</div>`;
  $('#queue-bottom').innerHTML = `<span>已加载 ${store.list(state.repo).length} 条${complete ? '' : '，范围尚不完整'} · 当前筛选 ${rows.length} 条</span>${store.pages[state.repo]?.nextCursor ? action('more-issues', '加载更多', 'plain') : ''}`;
}
function syncLayout() {
  const opened = Boolean(state.selected || state.editor);
  $('#workspace').classList.toggle('has-detail', opened);
  $('#detail').hidden = !opened;
  columnLayout.sync(opened);
  syncRepositoryHeader();
}
function sourceLinks(issue) {
  const pr = Array.isArray(issue.relatedPr) ? issue.relatedPr : issue.relatedPr ? [issue.relatedPr] : [];
  const attachment = Array.isArray(issue.attachments) ? issue.attachments : [];
  const links = (items, field) => {
    const byUrl = new Map();
    for (const item of items) {
      const url = safeUrl(typeof item === 'string' ? item : item?.url);
      if (url && !byUrl.has(url)) byUrl.set(url, `<a href="${esc(url)}" data-action="open-link" data-url="${esc(url)}">${esc(typeof item === 'string' ? item : item[field] || item.title || url)}</a>`);
    }
    return [...byUrl.values()].join('');
  };
  const prLinks = links(pr, 'title'), attachments = links(attachment, 'name'), activity = issue.coverage?.activity;
  const attachmentMarkup = attachments ? `<span>附件：</span>${attachments}` : `<span class="muted">附件：${attachment.length ? '未提供可用链接' : typeof issue.body === 'string' ? '暂无' : '正文尚未读取'}</span>`;
  let prMessage;
  if (activity?.unavailable) prMessage = '活动暂不可用，请在 GitHub 核对关联 PR。';
  else if (activity?.complete !== true) prMessage = Number.isInteger(activity?.page) || activity?.loaded > 0 || issue.activities?.length ? '活动尚未全部读取，关联 PR 可能不完整。' : '尚未读取活动';
  const prMarkup = prLinks ? `<span>关联 PR：</span>${prLinks}${prMessage ? `<span class="muted">${esc(prMessage)}</span>` : ''}` : `<span class="muted">关联 PR：${esc(pr.length ? '未提供可用链接' : prMessage || '暂无')}</span>`;
  return `${attachmentMarkup}${prMarkup}`;
}
function activityMarkup(issue) {
  const items = issue.activities || [];
  if (!items.length && issue.coverage?.activity?.complete === false) return `<p class="muted">活动尚未读取完成。</p>${action('more-activity', '读取活动')}`;
  return `<ol class="activity-list">${items.map(item => `<li>${esc(item.text || item.event || '活动记录')}<time>${esc(item.time || item.createdAt || '')}</time></li>`).join('')}</ol>${!items.length ? '<p class="muted">已读取范围暂无活动记录。</p>' : ''}${issue.coverage?.activity?.nextCursor ? action('more-activity', '加载更多活动') : issue.coverage?.activity?.complete === false ? '<p class="muted">活动范围尚不完整，请在 GitHub 查看。</p>' : ''}`;
}
function renderDetail({ focus = false } = {}) {
  let summaryIssue = null;
  syncLayout();
  if (!state.selected && !state.editor) { $('#detail').innerHTML = ''; return; }
  if (state.editor) {
    $('#detail').innerHTML = issueForm(state.editor, editorOptions(), { isNew: !state.editor.number, offline: !store.online, error: state.formError, conflict: state.conflict, busy: state.saving, saved: state.draftSaved, manage: permission('manage') });
  } else {
    const issue = current();
    if (!issue) { state.selected = null; syncLayout(); return; }
    summaryIssue = issue;
    const task = store.task(state.repo, issue.number).current;
    // 标题只来自已确认的会话记录；当前工作区不能代替缺失的历史会话工作区快照。
    const destination = taskDestination(task);
    const attribute = (name, content) => `<div class="property"><span class="property-name">${name}</span>${permission('manage') ? `<button class="button property-edit" data-action="edit-issue" aria-label="编辑${name}">${content}</button>` : `<span class="property-value">${content}</span>`}</div>`;
    $('#detail').innerHTML = `${state.notice ? `<div class="notice" role="status">${esc(state.notice)}</div>` : ''}<header class="detail-header"><div class="detail-eyebrow"><span class="number">#${issue.number}</span><span class="open-state">${icon(issue.state === 'open' ? 'issue' : 'closed')}${issue.state === 'open' ? '打开' : '已关闭'}</span><span class="issue-author">${esc(issue.author)} · ${esc(issue.created)} 创建</span><div class="detail-tools">${button('issue-menu', '更多', { className: 'plain', symbol: 'down', extra: 'id="issue-more" aria-haspopup="menu" aria-expanded="false"' })}${button('close-detail', '', { className: 'plain icon-button close-detail', symbol: 'close', extra: 'id="close-detail" aria-label="返回列表" title="返回列表"' })}</div></div><h1 id="detail-title" tabindex="-1">${esc(issue.title)}</h1><div class="action-row ${task?.status === 'linked' ? 'has-confirmed-destination' : ''}">${button('task', esc(taskAction(task?.status)), { className: state.comment.trim() ? '' : 'primary', symbol: 'chat', extra: 'id="task-primary"' })}${button('task-menu', '', { className: 'plain icon-button', symbol: 'down', extra: 'id="task-more" aria-label="会话操作" aria-haspopup="menu" aria-expanded="false"' })}${destination}</div></header><div class="properties">${attribute('标签', labels(issue.labels) || '无标签')}${attribute('负责人', esc(issue.assignees?.join('、') || issue.assignee || '未分配'))}${attribute('里程碑', esc(issue.milestone || '无里程碑'))}<div class="property"><span class="property-name">更新</span><span>${esc(issue.updated)}</span></div></div><article class="doc"><div id="issue-body-view">${bodyMarkup(issue.body)}</div><div class="related-links">${sourceLinks(issue)}</div></article><section class="discussion"><div class="discussion-tabs"><button data-action="discussion-tab" data-tab="comments" class="${state.discussionTab === 'comments' ? 'active' : ''}" aria-pressed="${state.discussionTab === 'comments'}">讨论 · ${issue.comments}</button><button data-action="discussion-tab" data-tab="activities" class="${state.discussionTab === 'activities' ? 'active' : ''}" aria-pressed="${state.discussionTab === 'activities'}">活动</button>${state.discussionTab === 'comments' ? `<span class="loaded-count">已加载 ${Math.min(state.visibleComments, issue.commentItems.length)} / ${issue.comments}${issue.coverage?.comments?.complete === false ? ' · 尚未全部获取' : ''}</span>` : ''}</div><div id="discussion-content">${state.discussionTab === 'comments' ? commentMarkup(issue) : activityMarkup(issue)}</div>${permission('comment') ? commentEditor() : ''}<p class="extension-note muted">Projects、子 Issue 和依赖关系可在 GitHub 查看。${button('source-issue', '打开 GitHub', { className: 'plain' })}</p></section>`;
  }
  if (summaryIssue) summaryPainter.remember($('#detail'), summaryIssue, { linksMarkup: sourceLinks(summaryIssue) });
  state.summaryDeferred = false;
  renderDetailStaleness();
  renderWriteOutcome();
  if (focus) requestAnimationFrame(() => $('#detail-title')?.focus({ preventScroll: true }));
}
function renderDetailStaleness() {
  const issue = current(), detail = $('#detail'), scroll = detail.scrollTop, existing = $('#detail-stale-banner');
  const editorStale = state.editor && issue && state.editor.revision !== issue.revision;
  if (!issue?.detailStale && !state.summaryDeferred && !editorStale) { existing?.remove(); detail.scrollTop = scroll; return; }
  const message = editorStale ? '远端已有更新，当前编辑输入已保留。保存前请比较最新内容。' : state.summaryDeferred ? '远端正文或链接已有更新，正在使用的阅读控件已保留。离开该控件后将更新。' : '远端可能已有更新，当前讨论保留已读版本。输入未被覆盖；完成编辑后请手动刷新。';
  if (existing) { existing.textContent = message; return; }
  const node = document.createElement('div'); node.id = 'detail-stale-banner'; node.className = 'notice'; node.setAttribute('role', 'status');
  node.textContent = message;
  detail.prepend(node); detail.scrollTop = scroll;
}
function paintCurrentSummary() {
  const issue = current();
  if (!issue || state.editor || state.detailLoading || state.saving) { renderDetailStaleness(); return; }
  const result = summaryPainter.paint($('#detail'), issue, { manage: permission('manage'), linksMarkup: sourceLinks(issue) });
  state.summaryDeferred = result.deferred; renderDetailStaleness();
}
function renderWriteOutcome() {
  $$('.write-outcome').forEach(node => node.remove());
  const outcome = state.writeOutcome;
  if (!outcome?.operation) return;
  const operation = outcome.operation;
  const isReadback = ['readback-failed', 'confirmed'].includes(operation.status);
  const node = document.createElement('section'); node.className = 'banner write-outcome'; node.setAttribute('aria-label', '提交结果核对');
  const url = safeUrl(operation.url) || `https://github.com/${state.repo}/issues`;
  node.innerHTML = `<p>${operation.status === 'confirmed' ? '提交已确认，最新内容尚未重新读取。请仅重新读取，不要再次发布。' : isReadback ? 'GitHub 已接受提交，重新读取尚未完成。不要重复发布。' : '提交结果尚未确认。输入已保留，请先在 GitHub 核对。'}</p>${button('open-link', '在 GitHub 核对', { extra: `data-url="${esc(url)}"` })}${isReadback ? action('outcome-readback', '仅重新读取') : operation.status === 'unknown' ? action('outcome-release', '已核对未创建，允许重试') : '<span>请求仍待确认，请稍后重新读取。</span>'}`;
  const target = outcome.kind === 'comment' ? $('#comment-error') : $('#form-error');
  (target || $('#detail-title'))?.after(node);
}
function commentMarkup(issue) {
  if (!issue.commentItems.length && issue.coverage?.comments?.complete === false) return `<p class="muted">评论尚未读取完成。</p><div class="pagination">${action('more-comments', '读取评论')}</div>`;
  return issue.commentItems.slice(0, state.visibleComments).map((comment) => `<article class="comment" data-comment-id="${esc(comment.id)}"><div class="comment-head"><span class="avatar">${esc(comment.initials)}</span><strong>${esc(comment.author)}</strong><time>${esc(comment.time)}${comment.edited ? ' · 已编辑' : ''}</time>${permission('editOwnComment') && comment.login === store.account.login ? button('edit-comment', '编辑', { className: 'plain', extra: `data-comment-id="${esc(comment.id)}" aria-label="编辑 ${esc(comment.author)}的评论"` }) : ''}</div><div class="comment-body">${bodyMarkup(comment.text)}</div></article>`).join('') + (issue.commentItems.length === 0 ? '<p class="muted">还没有讨论，写下第一条回复。</p>' : '') + (state.visibleComments < issue.commentItems.length || issue.coverage?.comments?.nextCursor ? `<div class="pagination">${action('more-comments', '加载更多评论')}</div>` : '');
}
function commentEditor() {
  return `<form id="comment-form" class="comment-editor" novalidate><label for="comment-body">${state.commentId ? '编辑我的评论' : '回复讨论'}</label><textarea id="comment-body" name="comment" rows="3">${esc(state.comment)}</textarea><div id="comment-error" class="form-error" ${state.commentError ? '' : 'hidden'} role="alert" tabindex="-1">${esc(state.commentError)}</div><div class="form-actions"><span id="comment-draft-status" class="draft-label">${state.draftSaved ? '本机草稿已恢复' : '按 Enter 换行'}</span>${state.commentId ? action('cancel-comment', '取消编辑') : ''}<button type="submit" id="save-comment" class="button ${state.comment.trim() ? 'primary' : ''}" ${state.saving ? 'disabled' : ''}>${state.saving ? '保存中…' : !store.online ? '保存本机草稿' : state.commentId ? '保存评论' : '发表评论'}</button></div></form>`;
}
function renderAll() { renderNav(); renderQueue(); renderDetail(); status(); }
function resetDetail() {
  state.editor = null; state.comment = ''; state.commentId = null; state.commentBase = null; state.commentError = ''; state.formError = ''; state.conflict = null; state.notice = ''; state.draftSaved = false; state.visibleComments = 2; state.discussionTab = 'comments'; state.writeOutcome = null;
  state.detailLoading = false; state.detailError = '';
  state.summaryDeferred = false;
}
async function persistPreference() { try { await store.savePreference(state.repo, state.filters); } catch (error) { announce(error.message); } }
function captureInputs() {
  const form = $('#issue-form');
  if (form && state.editor) {
    state.editor = { ...state.editor, title: $('#issue-title', form).value, body: $('#issue-body', form).value, labels: $$('input[name="labels"]:checked', form).map((field) => field.value), assignee: $('#issue-assignee', form).value, milestone: $('#issue-milestone', form).value };
  }
  if ($('#comment-body')) state.comment = $('#comment-body').value;
}
async function flushDrafts() {
  clearTimeout(draftTimer); captureInputs();
  const repo = state.repo, editor = state.editor && structuredClone(state.editor), number = state.selected, comment = state.comment, commentId = state.commentId, baseText = state.commentBase;
  if (editor) await store.saveDraft(repo, editor.number || 'new', 'issue', editor);
  if (number) {
    const kind = commentId ? `comment:${commentId}` : 'comment';
    if (comment.trim() || commentId) await store.saveDraft(repo, number, kind, { text: comment, commentId, baseText });
    else if (store.draft(repo, number, kind)) await store.saveDraft(repo, number, kind, null);
  }
  captureInputs();
  if (repo === state.repo && number === state.selected && JSON.stringify(editor) === JSON.stringify(state.editor) && comment === state.comment && commentId === state.commentId) state.draftSaved = true;
}
async function preserveBefore(callback) {
  if (state.saving) { announce('正在保存，请稍候再切换。'); return; }
  void persistPreference();
  if (!hasUnsavedInput()) return callback();
  try { await flushDrafts(); }
  catch (error) {
    pendingNavigation = callback;
    openModal('草稿尚未保存', `<p class="form-error">${esc(error.message)}</p><p>当前输入仍在页面中。重试保存成功后再离开，或明确放弃当前输入。</p>`, `${action('stay', '继续编辑')}${action('discard-leave', '放弃输入并离开')}${action('retry-leave', '重试保存并离开', 'primary')}`);
    return;
  }
  return callback();
}
function hasUnsavedInput() {
  captureInputs();
  if (state.draftSaved) return false;
  if (state.commentId && state.comment !== state.commentBase || !state.commentId && state.comment.trim()) return true;
  if (!state.editor) return false;
  const fields = ['title', 'body', 'labels', 'assignee', 'milestone'];
  const baseline = state.editor._base || { title: '', body: '', labels: [], assignee: '', milestone: '' };
  return fields.some(field => JSON.stringify(state.editor[field]) !== JSON.stringify(baseline[field]));
}
function prepareSelection(retry, isCurrent = () => true) {
  if (state.saving) { announce('正在保存，请稍候再切换。'); return false; }
  void persistPreference();
  if (!hasUnsavedInput()) return;
  const identity = store.identity;
  return flushDrafts().then(() => true).catch(error => {
    if (identity !== store.identity || !isCurrent()) return false;
    pendingNavigation = retry;
    openModal('草稿尚未保存', `<p class="form-error">${esc(error.message)}</p><p>当前输入仍在页面中。保存成功后才切换，或明确放弃输入。</p>`, `${action('stay', '继续编辑')}${action('discard-leave', '放弃输入并离开')}${action('retry-leave', '重试保存并离开', 'primary')}`);
    return false;
  });
}
function scheduleDraft() {
  clearTimeout(draftTimer);
  state.draftSaved = false;
  draftTimer = setTimeout(async () => {
    try { await flushDrafts(); if ($('#comment-draft-status')) $('#comment-draft-status').textContent = state.draftSaved ? '本机草稿已保存，尚未发布' : '正在保存新输入…'; }
    catch (error) { if ($('#comment-draft-status')) $('#comment-draft-status').textContent = error.message; else showFormError(error.message); }
  }, 500);
}
let detailGeneration = 0;
function restoreDetailDrafts(repo, number) {
  const issueDraft = store.draft(repo, number, 'issue'), commentDraft = store.commentDraft(repo, number);
  if (issueDraft && !state.editor && permission('edit')) { state.editor = issueDraft; state.draftSaved = true; }
  if (commentDraft && !state.comment && !state.commentId && permission('comment')) { state.comment = commentDraft.text; state.commentId = commentDraft.commentId || null; state.commentBase = commentDraft.baseText ?? current()?.commentItems.find(comment => String(comment.id) === String(state.commentId))?.text ?? null; state.draftSaved = true; }
}
async function openIssue(number) {
  number = Number(number);
  if (state.selected === number && !state.detailError) { if (selection.isPreparing()) selection.invalidate(); return; }
  const repo = state.repo;
  return selection.select(`issue:${repo}#${number}`, {
    prepare: isCurrent => prepareSelection(() => openIssue(number), isCurrent),
    pendingFeedback: () => announce('正在保留当前输入，保存后切换 Issue。'),
    commit: async isCurrent => {
    const repositoryKey = store.repositoryKey(repo);
    const generation = ++detailGeneration;
    resetDetail(); state.selected = number; state.queueFocus = number; store.activeNumber = number; state.detailLoading = true; state.detailError = '';
    renderRows(); syncLayout();
    $('#detail').innerHTML = '<div class="initial-load" role="status">正在读取 Issue 详情…</div>';
    try {
      await store.loadIssue(repo, number, { summary: true, cacheFirst: true });
      if (!isCurrent() || generation !== detailGeneration || repo !== state.repo) return;
      state.detailLoading = false;
      restoreDetailDrafts(repo, number);
      renderDetail({ focus: true }); $('#detail').scrollTop = 0;
      void hydrateIssue(repo, number, () => isCurrent() && generation === detailGeneration && repo === state.repo && number === state.selected);
    } catch (error) {
      if (!isCurrent() || generation !== detailGeneration || repo !== state.repo || !store.identity) return;
      if (error.code === 'stale' && store.repositoryKey(repo) !== repositoryKey) { selection.invalidate(); state.detailError = '仓库身份已核对，正在继续读取详情。'; void openIssue(number); return; }
      state.detailLoading = false; state.detailError = error.message;
      $('#detail').innerHTML = `<div class="empty"><h1>详情读取失败</h1><p>${esc(error.message)}</p>${action('retry-detail', '重试')}${action('close-detail', '返回列表')}</div>`;
    }
    },
  });
}
function closeDetail() {
  const number = state.selected;
  return preserveBefore(() => {
    selection.invalidate(); detailGeneration++; resetDetail(); state.selected = null; renderRows(); renderDetail();
    requestAnimationFrame(() => {
      const row = $(`#issue-row-${number}`);
      if (row) { row.tabIndex = 0; row.focus({ preventScroll: true }); }
      else { $('#queue-title').focus(); announce('原 Issue 不在当前筛选结果中，已返回列表。'); }
    });
  });
}
async function switchRepository(repo) {
  if (repo === state.repo && !state.loadError) { if (selection.isPreparing()) selection.invalidate(); return; }
  return selection.select(`repository:${repo}`, {
    prepare: isCurrent => prepareSelection(() => switchRepository(repo), isCurrent),
    pendingFeedback: () => announce('正在保留当前输入，保存后切换仓库。'),
    commit: async isCurrent => {
    detailGeneration++; closeOverlay(false); resetDetail(); state.selected = null; state.queueFocus = null; state.repo = repo; store.activeRepo = repo;
    state.filters = store.preference(repo); state.globalMessage = ''; state.loading = true; state.loadError = ''; renderAll();
    void store.saveViewState({ repositoryKey: store.repositoryKey(repo) }).catch(error => announce(`已切换仓库，浏览位置未保存：${error.message}`));
    try {
      await store.loadRepository(repo, { cacheFirst: true });
    } catch (error) { if (repo === state.repo) state.loadError = error.message; }
    finally { if (isCurrent() && repo === state.repo) { state.loading = false; renderNav(); renderQueue(); $('#queue-title')?.focus({ preventScroll: true }); void hydrateRepository(repo); } }
    },
  });
}
function updateFilterOptions(repo) {
  if (repo !== state.repo) return;
  const fields = editorOptions();
  for (const [selector, values, selected] of [['#filter-label', fields.labels, state.filters.label], ['#filter-assignee', fields.assignees, state.filters.assignee]]) {
    const field = $(selector);
    if (field && field !== document.activeElement) field.innerHTML = options([...new Set(['', ...values, selected])], selected, '全部');
  }
}
async function hydrateRepository(repo, isCurrent = () => repo === state.repo) {
  const jobs = [store.loadOptions(repo).then(() => { if (isCurrent() && repo === state.repo) updateFilterOptions(repo); }).catch(error => {
    if (isCurrent() && repo === state.repo) announce(`编辑候选暂不可用：${error.message}`);
  })];
  if (store.readSignal('list', repo).cached && store.online) {
    state.backgroundMessage = '正在显示缓存，后台检查 GitHub 更新…'; renderBackgroundStatus();
    jobs.push(store.loadRepository(repo).then(() => {
      if (!isCurrent() || repo !== state.repo) return;
      state.backgroundMessage = ''; renderBackgroundStatus(); renderRows(); renderNav(); status(true);
    }).catch(error => { if (isCurrent() && repo === state.repo) { state.backgroundMessage = `后台检查尚未完成：${error.message}`; renderBackgroundStatus(); announce(state.backgroundMessage); } }));
  }
  await Promise.allSettled(jobs);
}
function renderDiscussionOnly({ activeControl = null } = {}) {
  const issue = current(), content = $('#discussion-content');
  const focused = document.activeElement;
  if (!issue || !content || state.editor || state.saving || content.contains(focused) && focused !== activeControl) return;
  const detail = $('#detail'), scroll = detail?.scrollTop;
  content.innerHTML = state.discussionTab === 'comments' ? commentMarkup(issue) : activityMarkup(issue);
  const count = $('.loaded-count');
  if (count) count.textContent = `已加载 ${Math.min(state.visibleComments, issue.commentItems.length)} / ${issue.comments}${issue.coverage?.comments?.complete === false ? ' · 尚未全部获取' : ''}`;
  // 显式翻页允许替换当前分页按钮，结束后将焦点交还可见入口；其他阅读控件仍保留。
  if (activeControl && focused === activeControl && activeControl.dataset?.action === 'more-activity') ($('button[data-action="more-activity"]', content) || $('.discussion-tabs [data-tab="activities"]'))?.focus({ preventScroll: true });
  if (detail) detail.scrollTop = scroll;
}
function renderTaskOnly() {
  const task = store.task(state.repo, state.selected).current, row = $('.action-row'), primary = $('#task-primary');
  if (!row || !primary || state.editor) return;
  primary.disabled = taskBusy || taskPreparing;
  primary.setAttribute('aria-busy', String(taskBusy || taskPreparing));
  primary.innerHTML = `${icon('chat')}${esc(taskBusy || taskPreparing ? '正在核对工作区…' : taskAction(task?.status))}`;
  row.classList.toggle('has-confirmed-destination', task?.status === 'linked');
  $('.relation', row)?.remove(); row.insertAdjacentHTML('beforeend', taskDestination(task));
}
async function hydrateIssue(repo, number, isCurrent) {
  const freshSummary = store.readSignal('read-summary', repo, number).cached && store.online ? store.loadIssue(repo, number, { summary: true }).then(() => {
    if (isCurrent()) paintCurrentSummary();
  }).catch(error => { if (isCurrent()) { state.backgroundMessage = `详情后台检查尚未完成：${error.message}`; renderBackgroundStatus(); announce(state.backgroundMessage); } }) : Promise.resolve();
  const discussion = freshSummary.then(() => Promise.allSettled(['comments', 'activity'].map(kind => store.loadDiscussion(repo, number, kind).then(() => {
    if (isCurrent() && !state.saving) { renderDiscussionOnly(); if (kind === 'activity') paintCurrentSummary(); }
  }).catch(error => { if (isCurrent()) announce(`${kind === 'comments' ? '评论' : '活动'}读取尚未完成：${error.message}`); }))));
  const task = store.loadTask(repo, number).then(() => { if (isCurrent()) renderTaskOnly(); }).catch(error => { if (isCurrent()) announce(`会话状态尚未读取：${error.message}`); });
  await Promise.allSettled([discussion, task]);
  if (isCurrent()) { renderDetailStaleness(); status(); }
}
function editIssue(isNew = false) {
  return preserveBefore(async () => {
    try { await store.loadOptions(state.repo); } catch (error) { throw new StoreError('options', `编辑候选读取失败：${error.message}`); }
    const issue = isNew ? { title: '', body: '', labels: [], assignee: '', milestone: '' } : current();
    if (!issue) return;
    state.editor = store.draft(state.repo, isNew ? 'new' : state.selected, 'issue') || { ...issue, _base: structuredClone(issue) };
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
    try { await flushDrafts(); state.draftSaved = true; showFormError('已保存本机草稿，尚未发布。恢复连接后请手动保存。'); }
    catch (error) { showFormError(error.message); } return;
  }
  state.saving = true; state.formError = '';
  const input = structuredClone(state.editor); const repo = state.repo; const identity = store.identity;
  $('#save-issue').disabled = true; $('#save-issue').textContent = '保存中…';
  try {
    await flushDrafts();
    lockForm($('#issue-form'), true);
    const result = await store.saveIssue(repo, input, { force });
    if (identity !== store.identity || repo !== state.repo) return;
    state.saving = false; resetDetail(); state.selected = result.number; state.queueFocus = result.number;
    if (!filteredIssues().some((issue) => issue.number === result.number)) state.filters.state = 'all';
    state.notice = '已保存并重新读取。'; renderNav(); renderQueue(); renderDetail({ focus: true }); status(true);
  } catch (error) {
    if (identity !== store.identity) return;
    if (error.operation) state.writeOutcome = { operation: error.operation, kind: 'issue' };
    if (String(error.code).toLowerCase() === 'conflict') { state.conflict = error.remote; state.formError = error.message; renderDetail(); $('#form-error')?.focus(); }
    else showFormError(error.message);
    renderWriteOutcome();
  } finally {
    if (identity !== store.identity) return;
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
    try { await flushDrafts(); $('#comment-draft-status').textContent = '已保存本机草稿，尚未发布'; }
    catch (error) { $('#comment-error').textContent = error.message; $('#comment-error').hidden = false; } return;
  }
  state.saving = true; state.commentError = '';
  const identity = store.identity; const repo = state.repo; const number = state.selected;
  $('#save-comment').disabled = true; $('#save-comment').textContent = '保存中…';
  try {
    await flushDrafts(); lockForm($('#comment-form'), true); const issue = await store.saveComment(repo, number, state.comment, state.commentId, state.commentBase);
    if (identity !== store.identity || repo !== state.repo || number !== state.selected) return;
    state.comment = ''; state.commentId = null; state.commentBase = null; state.draftSaved = false; state.visibleComments = issue.commentItems.length; state.notice = '评论已保存并重新读取。';
    renderRows(); renderDetail(); status(true); $('#comment-body')?.focus();
  } catch (error) {
    if (identity !== store.identity) return;
    if (error.operation) state.writeOutcome = { operation: error.operation, kind: 'comment' };
    state.commentError = error.message; const node = $('#comment-error'); if (node) { node.textContent = error.message; node.hidden = false; node.focus(); }
    renderWriteOutcome();
  } finally { state.saving = false; lockForm($('#comment-form'), false); if ($('#save-comment')) { $('#save-comment').disabled = false; $('#save-comment').textContent = state.commentId ? '保存评论' : '发表评论'; } }
}
async function refresh(manual = false) {
  if (state.refreshing || state.saving || store.closed) return;
  state.refreshing = true; status();
  const repo = state.repo, number = state.selected, generation = detailGeneration, identity = store.identity;
  try {
    const result = await store.refresh({ manual, repo, number: !state.editor ? number : null });
    if (result.accountChanged || !state.repo || !store.repository(state.repo)) {
      state.repo = store.data.repositories[0]?.fullName || ''; state.filters = store.preference(state.repo); state.repoQuery = ''; state.queueFocus = null;
      if (state.repo) await store.loadRepository(state.repo);
      state.loading = false; state.globalMessage = '账号或仓库范围已变化，已重新读取。旧草稿保留在原账号下。'; renderAll();
    } else if (repo === state.repo && number === state.selected && generation === detailGeneration && identity === store.identity) {
      const focusId = document.activeElement?.id;
      let refreshedGeneration = generation;
      renderRows(); renderNav();
      if (number && result.detailLoaded && !state.editor && !state.saving && typeof current()?.body === 'string') {
        const recover = (state.detailError || state.detailLoading) && !$('#detail-title', $('#detail'));
        state.detailError = '';
        if (recover) {
          // 成功摘要才重建失败/加载页；使旧首次读取的迟到结果不能再画回错误。
          refreshedGeneration = ++detailGeneration; state.detailLoading = false;
          restoreDetailDrafts(repo, number); renderDetail();
        } else paintCurrentSummary();
      } else paintCurrentSummary();
      if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
      if (manual) announce('检查完成，未发布输入和阅读位置已保留。');
      renderDetailStaleness();
      if (number && !state.editor) void hydrateIssue(repo, number, () => repo === state.repo && number === state.selected && refreshedGeneration === detailGeneration);
    }
  } catch (error) {
    if (!store.identity) { state.repo = ''; state.selected = null; state.loading = false; state.loadError = error.message; renderAll(); }
    else if (repo === state.repo && number === state.selected && generation === detailGeneration && identity === store.identity) { announce(error.message); state.globalMessage = error.message; renderQueue(); }
  } finally { state.refreshing = false; status(true); }
}

function focusables(root) { return $$('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]', root).filter((node) => !node.hidden && node.getClientRects().length > 0); }
function closeOverlay(restoreFocus = true) {
  overlayGeneration++;
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
  const issue = current(); if (!issue) return;
  const record = store.task(state.repo, issue.number), task = record.current;
  const main = !task ? action('task', '创建任务', 'primary') : task.status === 'linked' ? action('return-task', '返回会话', 'primary') : action('task-check', '检查关联', 'primary');
  openModal(task?.status === 'linked' ? '关联会话' : '会话关联状态', taskDetailsMarkup(record), `${action('task-history', `历史记录${record.history?.length ? ` · ${record.history.length}` : ''}`)}${action('close-overlay', '关闭')}${main}`, { wide: true });
}
let taskBusy = false;
let taskPreparing = false;
let workspaceSaving = false;
let taskViewGeneration = 0;
async function openTask(another, workspaceKey) {
  if (taskBusy || !current()) return;
  const repo = state.repo, number = state.selected, identity = store.identity;
  const overlayAtStart = overlayGeneration;
  taskBusy = true;
  renderTaskOnly();
  try {
    await flushDrafts();
    if (overlayAtStart !== overlayGeneration || repo !== state.repo || number !== state.selected || identity !== store.identity) return;
    await store.createTask(repo, number, { another, workspaceKey });
    if (repo !== state.repo || number !== state.selected || identity !== store.identity) return;
    renderTaskOnly();
    if (overlayAtStart === overlayGeneration) { closeOverlay(false); if (store.task(repo, number).current?.status !== 'linked') showTask(); }
  } finally { taskBusy = false; renderTaskOnly(); }
}
async function createTask(another) {
  if (taskBusy || taskPreparing || !current()) return;
  const generation = ++taskViewGeneration;
  const repo = state.repo, number = state.selected, identity = store.identity;
  taskPreparing = true; renderTaskOnly();
  try { return await preserveBefore(async () => {
    if (generation !== taskViewGeneration || repo !== state.repo || number !== state.selected || identity !== store.identity) return;
    const overlayAtStart = overlayGeneration;
    await store.prepareTask();
    await store.loadTask(repo, number);
    if (generation !== taskViewGeneration || overlayAtStart !== overlayGeneration || repo !== state.repo || number !== state.selected || identity !== store.identity) return;
    store.activeNumber = number;
    const valid = store.workspaces(repo).filter(workspace => workspace.valid), binding = store.binding(repo);
    if (binding?.valid || valid.length === 1) return openTask(another, binding?.valid ? binding.id : valid[0].id);
    showWorkspacePicker('create', another);
  }); } finally { taskPreparing = false; renderTaskOnly(); }
}
function showWorkspacePicker(mode, another = false) {
  const workspaces = store.workspaces(state.repo), binding = store.binding(state.repo);
  const intent = { repo: state.repo, number: state.selected, identity: store.identity, another, mode };
  openModal(mode === 'bind' ? '修改后续任务工作区' : '选择本地工作区', workspacePickerMarkup(workspaces, binding, mode), `${action('close-overlay', '取消')}${workspaces.some(item => item.valid) ? action('confirm-workspace', mode === 'bind' ? '保存工作区' : '确认并打开草稿', 'primary') : ''}`, { onClose: () => { if (taskIntent === intent) taskIntent = null; } });
  taskIntent = intent;
}
async function changeWorkspace() {
  const generation = ++taskViewGeneration;
  return preserveBefore(async () => {
    const repo = state.repo, number = state.selected, identity = store.identity;
    const overlayAtStart = overlayGeneration;
    await store.loadTask(repo, number);
    if (generation !== taskViewGeneration || overlayAtStart !== overlayGeneration || repo !== state.repo || number !== state.selected || identity !== store.identity) return;
    store.activeNumber = number; showWorkspacePicker('bind');
  });
}
async function showTaskHistory() {
  const generation = ++taskViewGeneration;
  const repo = state.repo, number = state.selected, identity = store.identity;
  const overlayAtStart = overlayGeneration;
  await store.loadTask(repo, number);
  if (generation !== taskViewGeneration || overlayAtStart !== overlayGeneration || repo !== state.repo || number !== state.selected || identity !== store.identity) return;
  captureInputs();
  openModal('历史任务与会话', taskHistoryMarkup(store.task(repo, number)), `${action('task-details', '当前任务')}${action('close-overlay', '关闭')}`, { wide: true });
}
async function openHistory(requestId) {
  if (taskBusy || !current()) return;
  const repo = state.repo, number = state.selected, identity = store.identity;
  const overlayAtStart = overlayGeneration;
  taskBusy = true;
  try {
    await flushDrafts(); await store.openHistory(repo, number, requestId);
    if (repo !== state.repo || number !== state.selected || identity !== store.identity) return;
    if (overlayAtStart === overlayGeneration) closeOverlay();
    renderTaskOnly(); announce('已请求返回历史会话，当前优先关联保持不变。');
  } finally { taskBusy = false; }
}
async function showDiagnostics() {
  captureInputs();
  openModal('连接检查', '<div role="status">正在检查本机环境和连接…</div>', `${action('diagnostics', '重新检查')}${action('close-overlay', '关闭')}`, { wide: true });
  const generation = overlayGeneration;
  try {
    const result = await readDiagnostics(args => app.callServerTool(args));
    if (generation !== overlayGeneration) return;
    $('.modal-body', overlay).innerHTML = diagnosticsMarkup(result);
  } catch (error) { if (generation === overlayGeneration) $('.modal-body', overlay).innerHTML = `<p class="form-error" role="alert">${esc(error.message)}</p>`; }
}
function showDrawer() {
  openModal('仓库', `<label for="drawer-search">搜索仓库</label><input id="drawer-search" class="repo-search" type="search" autocomplete="off"><div class="repository-list" id="drawer-repositories">${repoButtons()}</div>${action('diagnostics', '连接检查', 'plain')}`, '', { drawer: true });
}
function clearFilters() { state.filters = { query: '', state: 'open', label: '', assignee: '', scroll: 0 }; void persistPreference(); renderQueue(); $('#issue-search').focus(); }
function applyFilter(name, value) {
  state.filters[name] = value; state.filters.scroll = 0; void persistPreference(); renderRows(); if (name === 'state') renderQueue();
}
async function handleAction(name, target, event) {
  switch (name) {
    case 'repository': await switchRepository(target.dataset.repo); break;
    case 'open-issue': await openIssue(target.dataset.number); break;
    case 'close-detail': await closeDetail(); break;
    case 'new-issue': if (store.repository(state.repo)?.permissions?.createIssue) await editIssue(true); break;
    case 'edit-issue': closeOverlay(); if (permission('edit') || permission('manage')) await editIssue(); break;
    case 'cancel-edit': {
      if (state.saving) break;
      clearTimeout(draftTimer);
      const number = state.editor.number || 'new';
      await store.saveDraft(state.repo, number, 'issue', null); state.editor = null; state.formError = ''; state.conflict = null;
      renderDetail({ focus: true }); if (!state.selected) $('#queue-title')?.focus(); break;
    }
    case 'force-save': await saveIssue(true); break;
    case 'use-remote': await store.saveDraft(state.repo, state.selected, 'issue', null); if (state.conflict) store.installIssue(state.repo, state.conflict); state.editor = null; state.conflict = null; state.formError = ''; state.notice = '已采用远端版本。'; renderDetail({ focus: true }); break;
    case 'refresh': await refresh(true); break;
    case 'reconnect': await refresh(true); if (store.online) announce('连接已恢复，草稿仍未发布，请手动提交。'); break;
    case 'filter-state': applyFilter('state', target.dataset.state); break;
    case 'clear-filters': clearFilters(); break;
    case 'more-comments': captureInputs(); if (state.visibleComments >= current().commentItems.length) await store.loadMore(state.repo, state.selected, 'comments'); state.visibleComments += 30; renderDetail(); $('button[data-action="more-comments"]')?.focus(); break;
    case 'more-activity': {
      captureInputs();
      const repo = state.repo, number = state.selected, identity = store.identity;
      await store.loadMore(repo, number, 'activity');
      if (repo !== state.repo || number !== state.selected || identity !== store.identity) break;
      renderDiscussionOnly({ activeControl: target }); paintCurrentSummary(); break;
    }
    case 'more-issues': state.loading = true; renderRows(); try { await store.loadRepository(state.repo, { more: true }); } finally { state.loading = false; renderRows(); } break;
    case 'retry-detail': await openIssue(state.selected); break;
    case 'discover': await store.request('query', 'refresh', {}); await load(); break;
    case 'reset-layout': columnLayout.reset(); announce('列宽已恢复默认。'); break;
    case 'diagnostics': await showDiagnostics(); break;
    case 'discussion-tab': captureInputs(); state.discussionTab = target.dataset.tab; renderDetail(); $(`[data-tab="${state.discussionTab}"]`)?.focus(); break;
    case 'edit-comment': await preserveBefore(() => { const comment = current().commentItems.find((row) => String(row.id) === String(target.dataset.commentId)); if (comment?.login !== store.account.login) return; const draft = store.draft(state.repo, state.selected, `comment:${comment.id}`); state.commentId = comment.id; state.comment = draft ? draft.text : comment.text; state.commentBase = draft?.baseText ?? comment.text; state.commentError = ''; renderDetail(); $('#comment-body').focus(); }); break;
    case 'cancel-comment': if (state.saving) break; clearTimeout(draftTimer); await store.saveDraft(state.repo, state.selected, `comment:${state.commentId}`, null); state.commentId = null; state.commentBase = null; state.comment = ''; state.commentError = ''; renderDetail(); $('#comment-body').focus(); break;
    case 'issue-menu': openMenu(target, [...((permission('edit') || permission('manage')) ? [{ action: 'edit-issue', text: '编辑标题、正文与属性' }] : []), ...(permission('manage') || permission('edit') ? [{ action: 'change-state', text: current().state === 'open' ? '关闭 Issue' : '重新打开 Issue' }] : []), { action: 'source-issue', text: '查看来源链接' }]); break;
    case 'task-menu': openMenu(target, [{ action: 'another-task', text: '另建任务' }, { action: 'change-workspace', text: '修改工作区' }, { action: 'task-details', text: '查看当前任务与关联' }, { action: 'task-history', text: '历史任务与会话' }]); break;
    case 'change-state': {
      closeOverlay(); if (!writable() || state.saving) break;
      const repo = state.repo, number = state.selected, identity = store.identity;
      await preserveBefore(async () => {
        state.saving = true;
        try { const issue = await store.changeState(repo, number); if (identity !== store.identity || repo !== state.repo || number !== state.selected) return; state.saving = false; state.notice = issue.state === 'closed' ? 'Issue 已关闭，未自动选择下一条。' : 'Issue 已重新打开。'; renderNav(); renderQueue(); renderDetail({ focus: true }); status(true); }
        catch (error) { if (identity !== store.identity || repo !== state.repo || number !== state.selected) return; state.saving = false; state.notice = ''; if (error.operation) state.writeOutcome = { operation: error.operation, kind: 'state' }; renderDetail(); const note = document.createElement('div'); note.className = 'form-error'; note.setAttribute('role', 'alert'); note.textContent = error.message; $('.detail-header')?.after(note); }
        finally { state.saving = false; }
      }); break;
    }
    case 'task':
      if (overlay.children.length) closeOverlay();
      if (store.task(state.repo, state.selected).current?.status === 'linked') await openTask(false);
      else if (store.task(state.repo, state.selected).current) showTask();
      else await createTask(false); break;
    case 'return-task': await openTask(false); break;
    case 'task-details': showTask(); break;
    case 'another-task': closeOverlay(); await createTask(true); break;
    case 'change-workspace': closeOverlay(); await changeWorkspace(); break;
    case 'task-history': await showTaskHistory(); break;
    case 'task-history-open': await openHistory(target.dataset.requestId); break;
    case 'confirm-workspace': {
      const chosen = $('input[name="workspace"]:checked', overlay)?.value;
      const intent = taskIntent;
      if (!chosen || !intent || workspaceSaving || intent.repo !== state.repo || intent.number !== state.selected || intent.identity !== store.identity) break;
      const overlayAtStart = overlayGeneration;
      workspaceSaving = true; target.disabled = true;
      try {
        await store.bind(intent.repo, chosen);
        if (intent.repo !== state.repo || intent.number !== state.selected || intent.identity !== store.identity || overlayAtStart !== overlayGeneration) break;
        if (intent.mode === 'bind') { closeOverlay(false); renderTaskOnly(); showTask(); announce('后续新任务工作区已保存，现有会话仍使用原工作区。'); }
        else await openTask(intent.another, chosen);
      } finally { workspaceSaving = false; if (target.isConnected) target.disabled = false; }
      break;
    }
    case 'task-check': {
      if (taskBusy) break;
      const repo = state.repo, number = state.selected, identity = store.identity, overlayAtStart = overlayGeneration;
      taskBusy = true; target.disabled = true;
      try { await store.checkTask(repo, number); if (repo === state.repo && number === state.selected && identity === store.identity) { renderTaskOnly(); if (overlayAtStart === overlayGeneration) showTask(); } }
      finally { taskBusy = false; if (target.isConnected) target.disabled = false; } break;
    }
    case 'task-resolve': {
      const threadId = $('input[name="task-candidate"]:checked', overlay)?.value;
      if (!threadId) throw new StoreError('task-candidate', '请选择一条已经核验的会话，再明确确认。');
      if (taskBusy) break;
      const repo = state.repo, number = state.selected, identity = store.identity, overlayAtStart = overlayGeneration;
      taskBusy = true; target.disabled = true;
      try {
        await flushDrafts(); await store.resolveTask(repo, number, threadId, target.dataset.requestId);
        if (repo === state.repo && number === state.selected && identity === store.identity) { renderTaskOnly(); if (overlayAtStart === overlayGeneration) showTask(); }
      } finally { taskBusy = false; if (target.isConnected) target.disabled = false; }
      break;
    }
    case 'close-overlay': closeOverlay(); break;
    case 'stay': pendingNavigation = null; closeOverlay(); break;
    case 'retry-leave': { const callback = pendingNavigation; closeOverlay(false); pendingNavigation = null; if (callback) await preserveBefore(callback); break; }
    case 'discard-leave': { const callback = pendingNavigation; pendingNavigation = null; clearTimeout(draftTimer); state.editor = null; state.comment = ''; state.commentId = null; state.commentBase = null; closeOverlay(false); await callback?.(); break; }
    case 'source-issue': closeOverlay(); await openExternal(current()?.url); break;
    case 'open-link': await openExternal(target.dataset.url); break;
    case 'outcome-release':
    case 'outcome-readback': {
      if (state.saving || !state.writeOutcome) break;
      const outcome = state.writeOutcome, repo = state.repo, identity = store.identity;
      state.saving = true; target.disabled = true;
      try {
        const data = await store.resolveOperation(repo, outcome.operation, name === 'outcome-release' ? 'not-created' : 'readback');
        if (identity !== store.identity || repo !== state.repo) break;
        if (name === 'outcome-readback') {
          if (data.issue) {
            state.writeOutcome = null;
            resetDetail(); state.selected = data.issue.number; state.notice = '提交已重新读取，没有再次发布。'; renderNav(); renderQueue(); renderDetail();
          } else {
            // 已接受的提交没有取得新投影时，保留成功回执和输入；恢复按钮始终只读。
            const operation = ['confirmed', 'readback-failed'].includes(data.operation?.status) ? data.operation : outcome.operation;
            state.writeOutcome = { ...outcome, operation };
            const message = operation.status === 'confirmed' ? '提交已确认，最新内容仍未重新读取。请稍后仅重新读取，不要再次发布。' : 'GitHub 已接受提交，重新读取仍未完成。请稍后重试读取，不要再次发布。';
            if (outcome.kind === 'comment') { state.commentError = message; const node = $('#comment-error'); if (node) { node.textContent = message; node.hidden = false; } }
            else showFormError(message);
            renderWriteOutcome(); announce(message);
          }
        } else {
          state.writeOutcome = null;
          const message = '已记录核对结果。内容仍未再次发布，请确认后手动提交。';
          if (outcome.kind === 'comment') { state.commentError = message; renderDetail(); }
          else { showFormError(message); renderWriteOutcome(); }
        }
      } finally { state.saving = false; if (target.isConnected) target.disabled = false; }
      break;
    }
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
  if (state.summaryDeferred) queueMicrotask(paintCurrentSummary);
});
window.addEventListener('beforeunload', (event) => {
  if (!hasEditor() || state.draftSaved) return;
  event.preventDefault(); event.returnValue = '';
});
window.addEventListener('resize', () => { if ($('.menu', overlay)) closeOverlay(); syncRepositoryHeader(); });
// 后台只检查当前账号缓存，不抢焦点，也不重新挂载当前编辑器。
setInterval(() => { if (!document.hidden && !state.loading && !state.refreshing) refresh(false); }, 60000);

async function load() {
  state.loading = true; state.loadError = ''; renderAll();
  try {
    await store.load();
    if (!state.repo || !store.repository(state.repo)) state.repo = store.preferredRepository() || store.data.repositories[0]?.fullName || '';
    columnLayout.restore(store.viewState);
    store.activeRepo = state.repo; state.filters = store.preference(state.repo);
    renderNav(); renderQueue();
    if (state.repo) await store.loadRepository(state.repo, { cacheFirst: true });
    state.loading = false; renderAll();
    const repo = state.repo;
    if (repo) void hydrateRepository(repo, () => repo === state.repo);
    if (store.refreshNeeded) void refreshCatalogInBackground();
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
async function refreshCatalogInBackground() {
  try {
    await store.refreshCatalog();
    if (store.catalog?.error) { state.backgroundMessage = store.catalog.error.message; renderBackgroundStatus(); }
    const canonical = store.repository(state.repo)?.fullName;
    const normalized = canonical && canonical !== state.repo;
    if (normalized) {
      state.repo = canonical; store.activeRepo = canonical;
      if ($('#queue-title')) $('#queue-title').textContent = canonical;
      $('#mobile-repository').textContent = canonical;
    }
    renderNav();
    if (state.repo && store.repository(state.repo)) void store.saveViewState({ repositoryKey: store.repositoryKey(state.repo) }).catch(error => announce(`仓库已核对，浏览位置未保存：${error.message}`));
    if (!state.repo || !store.repository(state.repo)) {
      const repo = store.preferredRepository() || store.data.repositories[0]?.fullName || '';
      if (repo) await switchRepository(repo);
      else { state.loading = false; renderQueue(); }
    } else if (normalized && state.selected) {
      if (state.detailLoading) { state.detailError = '项目身份已核对，正在继续读取详情。'; void openIssue(state.selected); }
      else if (!hasEditor()) { const repo = state.repo, number = state.selected; void hydrateIssue(repo, number, () => repo === state.repo && number === state.selected); }
    }
  } catch (error) {
    if (!store.identity) { state.loading = false; state.loadError = error.message; renderAll(); }
    else { state.backgroundMessage = `项目后台检查尚未完成：${error.message}`; announce(state.backgroundMessage); }
  }
}
function applyTheme(context) {
  themeController.apply(context);
}
async function openExternal(raw) {
  let url; try { url = new URL(raw); } catch { throw new StoreError('url', '来源链接不可用。'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new StoreError('url', '只允许打开 HTTPS 来源链接。');
  const result = await app.openLink({ url: url.href });
  if (result?.isError) throw new StoreError('link', '宿主未能打开来源链接，请稍后重试。');
}
app.onhostcontextchanged = applyTheme;
app.ontoolresult = result => {
  if (result.isError || !result.structuredContent?.data?.account) return;
  store.acceptBootstrap(result.structuredContent);
};
app.onclose = () => {
  themeController.dispose();
  store.closed = true; detailGeneration++; closeOverlay(false); clearTimeout(draftTimer);
  state.globalMessage = '宿主连接已关闭，请重新打开 Issue Hub。未发布输入仍保留在当前页面。';
  for (const node of $$('button,input,select,textarea')) node.disabled = node.dataset?.action !== 'diagnostics';
  announce(state.globalMessage);
};
async function initialize() {
  try { await app.connect(); applyTheme(app.getHostContext()); await load(); }
  catch (error) { state.loading = false; state.loadError = `无法连接宿主：${error.message}`; renderAll(); }
}
void initialize();
