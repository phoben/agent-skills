from pathlib import Path

root = Path(__file__).resolve().parents[4]
app = root / 'packages/issue-hub/ui/app.mjs'
text = app.read_text(encoding='utf-8')

def replace(old, new):
    global text
    if old not in text:
        raise RuntimeError(f'未找到替换源：{old[:100]}')
    text = text.replace(old, new)

replace('esc(fixture.appName)', "'Issue Hub'")
replace("<div class=\"nav-bottom\">${esc(fixture.workspace.name)}<strong>⎇ ${esc(fixture.workspace.branch)}</strong></div>", "<div class=\"nav-bottom\">${store.catalog?.status === 'complete' ? '项目已读取' : '项目发现范围不完整'}<strong>${action('discover', '重新发现项目', 'plain')}</strong></div>")
replace("${store.list(repo.fullName).filter((issue) => issue.state === 'open').length}", "${store.pages[repo.fullName] ? `${store.list(repo.fullName).filter((issue) => issue.state === 'open').length}${store.pages[repo.fullName].complete ? '' : '+'}` : '—'}")
replace("fixture.prototype.labels", "editorOptions().prototype.labels")
replace("fixture.prototype.assignees", "editorOptions().prototype.assignees.filter(Boolean)")
replace("issueForm(state.editor, fixture,", "issueForm(state.editor, editorOptions(),")
replace("saved: state.draftSaved });", "saved: state.draftSaved, manage: permission('manage') });")
replace("${writable() ? button('new-issue'", "${store.repository(state.repo)?.permissions?.createIssue ? button('new-issue'")
replace("const attribute = (name, content) =>", "const attribute = (name, content) =>")
replace("${writable() ? `<button class=\"button property-edit\"", "${permission('manage') ? `<button class=\"button property-edit\"")
replace("${writable() ? commentEditor() : ''}", "${permission('comment') ? commentEditor() : ''}")
replace("${writable() && comment.login === store.account.login", "${permission('editOwnComment') && comment.login === store.account.login")
replace("if (error.code === 'conflict')", "if (String(error.code).toLowerCase() === 'conflict')")
replace("function persistPreference() { try { store.savePreference(state.repo, state.filters); } catch (error) { announce(error.message); } }", "async function persistPreference() { try { await store.savePreference(state.repo, state.filters); } catch (error) { announce(error.message); } }")
replace("function flushDrafts() {", "async function flushDrafts() {")
replace("if (state.editor) store.saveDraft", "if (state.editor) await store.saveDraft")
replace("if (state.comment.trim() || state.commentId) store.saveDraft", "if (state.comment.trim() || state.commentId) await store.saveDraft")
replace("else if (store.draft(state.repo, state.selected, kind)) store.saveDraft", "else if (store.draft(state.repo, state.selected, kind)) await store.saveDraft")
replace("function preserveBefore(callback) {", "async function preserveBefore(callback) {")
replace("try { flushDrafts(); persistPreference(); return callback(); }", "try { await flushDrafts(); await persistPreference(); return await callback(); }")
start = text.index('function scheduleDraft() {')
end = text.index('function closeDetail()', start)
text = text[:start] + '''function scheduleDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(async () => {
    try { await flushDrafts(); state.draftSaved = true; if ($('#comment-draft-status')) $('#comment-draft-status').textContent = '本机草稿已保存，尚未发布'; }
    catch (error) { if ($('#comment-draft-status')) $('#comment-draft-status').textContent = error.message; else showFormError(error.message); }
  }, 500);
}
let detailGeneration = 0;
async function openIssue(number) {
  return preserveBefore(async () => {
    const generation = ++detailGeneration;
    const repo = state.repo;
    resetDetail(); state.selected = Number(number); state.queueFocus = state.selected; store.activeNumber = state.selected;
    renderRows(); syncLayout();
    $('#detail').innerHTML = '<div class="initial-load" role="status">正在读取 Issue 详情…</div>';
    try {
      await store.loadIssue(repo, state.selected);
      if (generation !== detailGeneration || repo !== state.repo) return;
      try { await store.loadTask(repo, state.selected); } catch (error) { state.notice = error.message; }
      if (generation !== detailGeneration || repo !== state.repo) return;
      const issueDraft = store.draft(repo, state.selected, 'issue');
      const commentDraft = store.commentDraft(repo, state.selected);
      if (issueDraft && permission('edit')) { state.editor = issueDraft; state.draftSaved = true; }
      if (commentDraft && permission('comment')) { state.comment = commentDraft.text; state.commentId = commentDraft.commentId || null; state.commentBase = commentDraft.baseText ?? current()?.commentItems.find(comment => String(comment.id) === String(state.commentId))?.text ?? null; state.draftSaved = true; }
      renderDetail({ focus: true }); $('#detail').scrollTop = 0;
    } catch (error) {
      if (generation !== detailGeneration || repo !== state.repo || !store.identity) return;
      $('#detail').innerHTML = `<div class="empty"><h1>详情读取失败</h1><p>${esc(error.message)}</p>${action('retry-detail', '重试')}${action('close-detail', '返回列表')}</div>`;
    }
  });
}
''' + text[end:]
replace("resetDetail(); state.selected = null; renderRows(); renderDetail();", "detailGeneration++; resetDetail(); state.selected = null; renderRows(); renderDetail();")
start = text.index('function switchRepository(repo)')
end = text.index('function editIssue', start)
text = text[:start] + '''async function switchRepository(repo) {
  return preserveBefore(async () => {
    detailGeneration++; closeOverlay(false); resetDetail(); state.selected = null; state.queueFocus = null; state.repo = repo; store.activeRepo = repo;
    state.filters = store.preference(repo); state.globalMessage = ''; state.loading = true; state.loadError = ''; renderAll();
    try {
      await store.loadRepository(repo);
      try { await store.loadOptions(repo); } catch (error) { state.globalMessage = `编辑候选尚未读取：${error.message}`; }
    } catch (error) { if (repo === state.repo) state.loadError = error.message; }
    finally { if (repo === state.repo) { state.loading = false; renderAll(); $('#queue-title')?.focus({ preventScroll: true }); } }
  });
}
''' + text[end:]
replace("function editIssue(isNew = false) {\n  preserveBefore(() => {", "function editIssue(isNew = false) {\n  return preserveBefore(async () => {\n    try { await store.loadOptions(state.repo); } catch (error) { throw new StoreError('options', `编辑候选读取失败：${error.message}`); }")
replace("assignee: '未分配'", "assignee: ''")
replace("try { flushDrafts(); state.draftSaved", "try { await flushDrafts(); state.draftSaved")
replace("try { flushDrafts(); $('#comment-draft-status')", "try { await flushDrafts(); $('#comment-draft-status')")
replace("    flushDrafts();\n    lockForm", "    await flushDrafts();\n    lockForm")
replace("    flushDrafts(); lockForm", "    await flushDrafts(); lockForm")
start = text.index('async function refresh(manual = false)')
end = text.index('function focusables', start)
text = text[:start] + '''async function refresh(manual = false) {
  if (state.refreshing || store.closed) return;
  state.refreshing = true; status();
  const repo = state.repo, number = state.selected, generation = detailGeneration;
  try {
    const result = await store.refresh({ manual, repo, number: !hasEditor() ? number : null });
    if (result.accountChanged || !state.repo || !store.repository(state.repo)) {
      state.repo = store.data.repositories[0]?.fullName || ''; state.filters = store.preference(state.repo); state.repoQuery = ''; state.queueFocus = null;
      if (state.repo) await store.loadRepository(state.repo);
      state.loading = false; state.globalMessage = '账号或仓库范围已变化，已重新读取。旧草稿保留在原账号下。'; renderAll();
    } else if (repo === state.repo && generation === detailGeneration) {
      const focusId = document.activeElement?.id;
      renderRows(); renderNav();
      if (manual && !hasEditor() && !$('#detail').contains(document.activeElement)) { const scroll = $('#detail').scrollTop; renderDetail(); $('#detail').scrollTop = scroll; }
      if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
      if (manual) announce('检查完成，未发布输入和阅读位置已保留。');
    }
  } catch (error) {
    if (!store.identity) { state.repo = ''; state.selected = null; state.loading = false; state.loadError = error.message; renderAll(); }
    else { announce(error.message); state.globalMessage = error.message; renderQueue(); }
  } finally { state.refreshing = false; status(true); }
}

''' + text[end:]
start = text.index('function showTask()')
end = text.index('function showDrawer()', start)
text = text[:start] + '''function showTask() {
  const issue = current(); if (!issue) return;
  const record = store.task(state.repo, issue.number), task = record.current;
  if (!task) return createTask(false);
  const description = { draft: '草稿已准备。请在 Codex 中确认工作区并手动发送；插件不会自动发送。', requested: '已发出打开草稿请求，尚未确认会话。请先检查桌面草稿，避免重复创建。', pending: '关联尚待确认，请在发送后检查。', 'open-unconfirmed': '打开请求结果尚未确认，请先检查桌面草稿，再核对关联。', ambiguous: '找到多个包含完整任务引用的会话，未自动选择。请打开 GitHub 核对任务并保留现有关联。', linked: '已确认唯一关联，可返回同一会话。' }[task.status] || '关联尚待确认。';
  const main = task.status === 'linked' ? action('return-task', '返回会话', 'primary') : action('task-check', '检查关联', 'primary');
  openModal(task.status === 'linked' ? '关联会话' : '会话关联状态', `<div class="task-status">${icon(task.status === 'linked' ? 'check' : 'chat')}${esc(taskText(task.status))}</div><h3>${esc(task.title)}</h3><p>${esc(description)}</p><p class="muted">任务引用 ${esc(task.id || task.requestId)}</p>${task.path ? `<p class="workspace-path">${esc(task.path)}</p>` : ''}${task.prompt ? `<h3>预填内容</h3><pre class="prompt">${esc(task.prompt)}</pre>` : ''}${record.history?.length ? `<p class="muted">已保留 ${record.history.length} 条此前请求。</p>` : ''}`, `${action('close-overlay', '关闭')}${main}`, { wide: true });
}
let taskBusy = false;
async function openTask(another, workspaceKey) {
  if (taskBusy || !current()) return;
  const repo = state.repo, number = state.selected, identity = store.identity;
  taskBusy = true;
  try {
    await store.createTask(repo, number, { another, workspaceKey });
    if (repo !== state.repo || number !== state.selected || identity !== store.identity) return;
    closeOverlay(false); renderDetail();
    if (store.task(repo, number).current?.status !== 'linked') showTask();
  } finally { taskBusy = false; }
}
async function createTask(another) {
  return preserveBefore(async () => {
    await store.loadTask(state.repo, state.selected); store.activeNumber = state.selected;
    const valid = store.workspaces(state.repo).filter(workspace => workspace.valid), binding = store.binding(state.repo);
    taskIntent = { repo: state.repo, number: state.selected, another };
    if (binding?.valid || valid.length === 1) return openTask(another, binding?.valid ? binding.id : valid[0].id);
    openModal('选择本地工作区', `${binding && !binding.valid ? '<div class="banner">已记住的目录失效，请重新选择。</div>' : '<p>首次选择后记住，之后直接复用。取消不会生成任务请求。</p>'}<fieldset><legend>可用工作区</legend>${valid.map((workspace, index) => `<label class="workspace-option"><input type="radio" name="workspace" value="${esc(workspace.id)}" ${index === 0 ? 'checked' : ''}>${esc(workspace.name)}<span class="workspace-path">${esc(workspace.path)}</span></label>`).join('') || '<p>没有可用工作区，请重新发现项目。</p>'}</fieldset>`, `${action('close-overlay', '取消')}${valid.length ? action('confirm-workspace', '确认并打开草稿', 'primary') : ''}`);
  });
}
''' + text[end:]
replace("case 'new-issue': if (writable()) editIssue(true);", "case 'new-issue': if (store.repository(state.repo)?.permissions?.createIssue) await editIssue(true);")
replace("case 'edit-issue': closeOverlay(); if (writable()) editIssue();", "case 'edit-issue': closeOverlay(); if (permission('edit') || permission('manage')) await editIssue();")
replace("store.saveDraft(state.repo, number, 'issue', null);", "await store.saveDraft(state.repo, number, 'issue', null);")
replace("case 'use-remote': store.saveDraft(state.repo, state.selected, 'issue', null);", "case 'use-remote': await store.saveDraft(state.repo, state.selected, 'issue', null); if (state.conflict) store.installIssue(state.repo, state.conflict);")
start = text.index("    case 'reconnect':")
end = text.index("    case 'filter-state':", start)
text = text[:start] + "    case 'reconnect': await refresh(true); if (store.online) announce('连接已恢复，草稿仍未发布，请手动提交。'); break;\n" + text[end:]
replace("case 'more-comments': captureInputs(); state.visibleComments += 3; renderDetail();", "case 'more-comments': captureInputs(); if (state.visibleComments >= current().commentItems.length) await store.loadMore(state.repo, state.selected, 'comments'); state.visibleComments += 30; renderDetail();")
replace("case 'discussion-tab': captureInputs();", "case 'more-activity': captureInputs(); await store.loadMore(state.repo, state.selected, 'activity'); renderDetail(); break;\n    case 'more-issues': state.loading = true; renderRows(); try { await store.loadRepository(state.repo, { more: true }); } finally { state.loading = false; renderRows(); } break;\n    case 'retry-detail': await openIssue(state.selected); break;\n    case 'discover': await store.request('query', 'refresh', {}); await load(); break;\n    case 'discussion-tab': captureInputs();")
replace("row.id === target.dataset.commentId", "String(row.id) === String(target.dataset.commentId)")
replace("store.saveDraft(state.repo, state.selected, `comment:${state.commentId}`, null);", "await store.saveDraft(state.repo, state.selected, `comment:${state.commentId}`, null);")
replace("...(writable() ? [{ action: 'edit-issue', text: '编辑标题、正文与属性' }, { action: 'change-state', text: current().state === 'open' ? '关闭 Issue' : '重新打开 Issue' }] : [])", "...((permission('edit') || permission('manage')) ? [{ action: 'edit-issue', text: '编辑标题、正文与属性' }] : []), ...(permission('manage') || permission('edit') ? [{ action: 'change-state', text: current().state === 'open' ? '关闭 Issue' : '重新打开 Issue' }] : [])")
start = text.index("    case 'task':")
end = text.index("    case 'close-overlay':", start)
text = text[:start] + '''    case 'task':
      if (overlay.children.length) closeOverlay();
      if (store.task(state.repo, state.selected).current?.status === 'linked') await openTask(false);
      else if (store.task(state.repo, state.selected).current) showTask();
      else await createTask(false); break;
    case 'return-task': await openTask(false); break;
    case 'another-task': closeOverlay(); await createTask(true); break;
    case 'confirm-workspace': {
      const chosen = $('input[name="workspace"]:checked', overlay)?.value;
      if (!chosen || !taskIntent || taskIntent.repo !== state.repo || taskIntent.number !== state.selected) break;
      await store.bind(taskIntent.repo, chosen); await openTask(taskIntent.another, chosen); break;
    }
    case 'task-check': {
      if (taskBusy) break;
      const repo = state.repo, number = state.selected;
      taskBusy = true;
      try { await store.checkTask(repo, number); if (repo === state.repo && number === state.selected) { showTask(); renderDetail(); } }
      finally { taskBusy = false; } break;
    }
''' + text[end:]
start = text.index("    case 'source-pr':")
end = text.index("    case 'retry-load':", start)
text = text[:start] + '''    case 'source-issue': closeOverlay(); await openExternal(current()?.url); break;
    case 'open-link': await openExternal(target.dataset.url); break;
''' + text[end:]
replace("window.addEventListener('beforeunload', (event) => {\n  if (!hasEditor()) return;\n  try { flushDrafts(); } catch { event.preventDefault(); event.returnValue = ''; }\n});", "window.addEventListener('beforeunload', (event) => {\n  if (!hasEditor() || state.draftSaved) return;\n  event.preventDefault(); event.returnValue = '';\n});")
replace("    await store.load(); state.loading = false; renderAll();", "    await store.load();\n    if (!state.repo || !store.repository(state.repo)) state.repo = store.data.repositories[0]?.fullName || '';\n    store.activeRepo = state.repo; state.filters = store.preference(state.repo);\n    if (state.repo) { await store.loadRepository(state.repo); try { await store.loadOptions(state.repo); } catch (error) { state.globalMessage = error.message; } }\n    state.loading = false; renderAll();")
replace("await load();\nif (!state.loadError && params.has('issue') && store.issue(state.repo, Number(params.get('issue')))) openIssue(params.get('issue'));", '''function applyTheme(context) {
  document.documentElement.dataset.theme = context?.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.style.colorScheme = context?.theme === 'dark' ? 'dark' : 'light';
}
async function openExternal(raw) {
  let url; try { url = new URL(raw); } catch { throw new StoreError('url', '来源链接不可用。'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new StoreError('url', '只允许打开 HTTPS 来源链接。');
  await app.openLink({ url: url.href });
}
app.onhostcontextchanged = applyTheme;
app.ontoolresult = result => {
  if (result.isError || !result.structuredContent?.data?.account) return;
  store.acceptBootstrap(result.structuredContent);
};
app.onclose = () => {
  store.closed = true; detailGeneration++; closeOverlay(false); clearTimeout(draftTimer);
  state.globalMessage = '宿主连接已关闭，请重新打开 Issue Hub。未发布输入仍保留在当前页面。';
  for (const node of $$('button,input,select,textarea')) node.disabled = true;
  announce(state.globalMessage);
};
async function initialize() {
  try { await app.connect(); applyTheme(app.getHostContext()); await load(); }
  catch (error) { state.loading = false; state.loadError = `无法连接宿主：${error.message}`; renderAll(); }
}
void initialize();''')
app.write_text(text, encoding='utf-8')

index = (root / '.trellis/tasks/11-03-github-issue-plugin/ui/prototype/a-v1/index.html').read_text(encoding='utf-8')
index = index.replace('<link rel="stylesheet" href="./styles.css">', '<!-- APP_STYLE -->').replace('<script type="module" src="./app.mjs"></script>', '')
index = index.replace('</body>', '<!-- APP_SCRIPT -->\n</body>')
(root / 'packages/issue-hub/ui/index.html').write_text(index, encoding='utf-8')
test_path = root / 'packages/issue-hub/test/ui.test.mjs'
test_path.write_text(test_path.read_text(encoding='utf-8').replace("../ui/app.mjs", "../ui/proof.mjs"), encoding='utf-8')
