import { esc, button, taskText } from './ui.mjs';

const time = value => {
  const instant = typeof value === 'number' ? new Date(value < 1e12 ? value * 1000 : value) : new Date(value);
  return Number.isFinite(instant.getTime()) ? instant.toLocaleString('zh-CN', { hour12: false }) : '时间未知';
};

export function taskDetailsMarkup(record) {
  const task = record.current, binding = record.binding;
  const nextWorkspace = `<section class="task-workspace"><h3>后续新任务工作区</h3><p class="workspace-path">${esc(binding?.path || '尚未选择')}</p>${binding?.valid === false ? '<p class="muted">已记路径失效，请重新选择。</p>' : ''}${button('change-workspace', '修改工作区')}</section>`;
  if (!task) return `<p>此 Issue 暂无任务请求。创建后先在 Codex 中确认草稿，再手动发送。</p>${nextWorkspace}`;
  const description = { draft: '草稿已准备。请在 Codex 中确认工作区并手动发送。', requested: '已发出打开草稿请求，尚未确认会话。请先检查桌面草稿，避免重复创建。', pending: '关联尚待确认，请在发送后检查。', 'open-unconfirmed': '打开请求结果尚未确认，请先检查桌面草稿，再核对关联。', ambiguous: '以下候选已经通过本次任务引用和工作区核验。请明确选择一个；确认时服务会再次核验。', linked: task.associationSource === 'user-confirmed' ? '此关联已由成员选择并再次核验，可返回同一会话。' : '已确认唯一关联，可返回同一会话。' }[task.status] || '关联尚待确认。';
  const candidates = task.status !== 'linked' && task.candidates?.length ? `<fieldset class="task-candidates"><legend>已核验的会话候选</legend>${task.candidates.map(candidate => `<label class="workspace-option"><input type="radio" name="task-candidate" value="${esc(candidate.threadId)}">${esc(candidate.title || '未命名会话')}<span class="workspace-path">${esc(candidate.path || '')}</span><span class="muted">${esc(time(candidate.createdAt))}</span></label>`).join('')}</fieldset>${button('task-resolve', '确认所选会话', { className: 'primary', extra: `data-request-id="${esc(task.requestId)}"` })}` : '';
  return `<div class="task-status">${esc(taskText(task.status))}</div><h3>${esc(task.title)}</h3><p>${esc(description)}</p>${task.reference ? `<h3>任务引用</h3><pre class="task-reference">${esc(task.reference)}</pre>` : '<p class="muted">任务引用尚未取得，请重新读取请求状态。</p>'}<p class="muted">修改预填开发指令时，请保留首行任务引用。</p>${task.path ? `<h3>当前会话原工作区</h3><p class="workspace-path">${esc(task.path)}</p>` : ''}${candidates}${task.prompt ? `<details><summary>预填内容</summary><pre class="prompt">${esc(task.prompt)}</pre></details>` : ''}${nextWorkspace}`;
}

export function taskHistoryMarkup(record) {
  if (!record.history?.length) return '<p>此 Issue 暂无历史任务记录。</p>';
  return `<p>返回历史会话不会更改当前优先任务。</p><ol class="task-history">${record.history.map(task => `<li><h3>${esc(task.title)}</h3><p class="muted">${esc(taskText(task.status))} · ${esc(time(task.createdAt))}</p><p class="workspace-path">${esc(task.path || '原工作区信息未取得')}</p>${task.reference ? `<pre class="task-reference">${esc(task.reference)}</pre>` : ''}${task.status === 'linked' && task.threadId ? button('task-history-open', '返回此会话', { extra: `data-request-id="${esc(task.requestId)}"` }) : '<p class="muted">此记录尚无已确认会话。</p>'}</li>`).join('')}</ol>`;
}

export function workspacePickerMarkup(workspaces, binding, mode = 'create') {
  const valid = workspaces.filter(workspace => workspace.valid);
  const description = mode === 'bind' ? '此选择只用于后续另建任务。现有会话仍返回其原工作区；保存后不会自动创建会话。' : '首次选择后记住，之后直接复用。取消不会生成任务请求。';
  return `<p>${description}</p>${binding?.valid === false ? '<div class="banner">已记住的目录失效，请重新选择。</div>' : ''}<fieldset><legend>可用工作区</legend>${valid.map((workspace, index) => `<label class="workspace-option"><input type="radio" name="workspace" value="${esc(workspace.id)}" ${binding?.id === workspace.id || !binding?.valid && index === 0 ? 'checked' : ''}>${esc(workspace.name)}<span class="workspace-path">${esc(workspace.path)}</span></label>`).join('') || '<p>没有可用工作区，请重新发现项目。</p>'}</fieldset>`;
}
