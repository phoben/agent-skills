import { App } from '@modelcontextprotocol/ext-apps';
import './style.css';
import { VERSION } from '../src/version.mjs';

const app = new App({ name: 'Issue Hub', version: VERSION });
const $ = selector => document.querySelector(selector);
let selected, request, busy = false, closed = false, contextRevision = 0, requestRevision = 0;
function theme(context) { document.documentElement.style.colorScheme = context?.theme === 'dark' ? 'dark' : 'light'; }
function clearRequest() { requestRevision++; request = undefined; $('#prompt').value = ''; $('#request-state').textContent = ''; $('#open').disabled = true; $('#check').disabled = true; }
async function restoreRequest() {
  if (!selected || !$('#workspace').value) return;
  const revision = contextRevision, generation = requestRevision, repositoryKey = selected.key, workspaceKey = $('#workspace').value;
  try {
    const value = await call('issue-proof-task-latest', { repositoryKey, workspaceKey });
    if (revision !== contextRevision || generation !== requestRevision || selected?.key !== repositoryKey || $('#workspace').value !== workspaceKey) return;
    if (value?.request) showRequest(value.request);
    else $('#request-state').textContent = '当前工作区没有可恢复的验证请求。';
  } catch (error) {
    if (revision === contextRevision && generation === requestRevision) $('#message').textContent = error.message;
  }
}
function display(value) {
  if (value?.schemaVersion !== 1 || !value.catalog) return;
  $('#summary').textContent = JSON.stringify(value.catalog, null, 2);
  const repositoryChanged = selected?.key !== value.repository?.key;
  if (repositoryChanged) clearRequest();
  selected = value.repository;
  $('#repository').hidden = !selected;
  if (selected) {
    $('#repository-name').textContent = selected.fullName;
    const previous = $('#workspace').value;
    $('#workspace').replaceChildren(...selected.workspaces.map(workspace => { const option = document.createElement('option'); option.value = workspace.key; option.textContent = `${workspace.projectName || '项目'} · ${workspace.cwd}`; return option; }));
    if (selected.workspaces.some(workspace => workspace.key === previous)) $('#workspace').value = previous;
    else if (!repositoryChanged && request) clearRequest();
  }
  $('#message').textContent = value.catalog.status === 'unavailable' ? '项目发现不可用，请重新发现并检查 Codex 版本。' : '这里只显示项目诊断状态。原生悬浮仓库导航尚未接入；诊断工具不是原生仓库子项。';
  if (selected && !request) void restoreRequest();
}
async function call(name, args = {}) {
  const result = await app.callServerTool({ name, arguments: args });
  if (result.isError || result.structuredContent?.error) throw new Error(result.structuredContent?.error?.message || '验证操作失败。');
  return result.structuredContent;
}
async function action(callback) {
  if (busy || closed) return; busy = true;
  $('#workspace').disabled = true;
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  try { await callback(); } catch (error) { $('#message').textContent = error.message; }
  finally { busy = false; if (!closed) { $('#workspace').disabled = false; $('#refresh').disabled = false; $('#prepare').disabled = !selected; $('#open').disabled = !request; $('#check').disabled = !request || request.status === 'prepared'; } }
}
function showRequest(value) { requestRevision++; request = value; $('#prompt').value = value.prompt; $('#request-state').textContent = JSON.stringify({ status: value.status, threadId: value.threadId, coverage: value.coverage, checkedCandidates: value.checkedCandidates, navigation: value.navigation }, null, 2); $('#open').disabled = busy; $('#check').disabled = busy || value.status === 'prepared'; }
app.ontoolresult = result => { if (result.isError || !result.structuredContent?.catalog) return; contextRevision++; display(result.structuredContent); };
app.onhostcontextchanged = theme;
app.onclose = () => { closed = true; contextRevision++; clearRequest(); $('#workspace').disabled = true; for (const button of document.querySelectorAll('button')) button.disabled = true; $('#message').textContent = '宿主连接已关闭，请重新打开页面。'; };
$('#refresh').onclick = () => action(async () => { const revision = contextRevision; const value = await call('issue-proof-refresh', selected ? { repositoryKey: selected.key } : {}); if (revision === contextRevision) display(value); });
$('#prepare').onclick = () => action(async () => { const revision = contextRevision; requestRevision++; const value = await call('issue-proof-task-prepare', { repositoryKey: selected.key, workspaceKey: $('#workspace').value, requestId: crypto.randomUUID() }); if (revision === contextRevision) showRequest(value); });
$('#open').onclick = () => action(async () => { const revision = contextRevision; const value = await call('issue-proof-task-open', { requestId: request.requestId }); if (revision === contextRevision) showRequest(value); });
$('#check').onclick = () => action(async () => { const revision = contextRevision; const value = await call('issue-proof-task-check', { requestId: request.requestId }); if (revision === contextRevision) showRequest(value); });
$('#workspace').onchange = () => { contextRevision++; clearRequest(); void restoreRequest(); };
async function initialize() {
  try {
    await app.connect(); const context = app.getHostContext(); theme(context);
    const match = /^issue-proof-open-([a-f0-9]{20})$/.exec(context?.toolInfo?.tool?.name || '');
    const revision = contextRevision;
    if (!selected) { const value = await call('issue-proof-status', match ? { repositoryKey: match[1] } : {}); if (revision === contextRevision) display(value); }
  } catch { $('#message').textContent = '无法连接宿主，请从 Codex 原生侧栏打开此页面。'; }
}
void initialize();
