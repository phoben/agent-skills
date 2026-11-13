// 所有来自数据与表单的文字在插入模板前统一转义。
export const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const icon = (name) => {
  const paths = {
    issue: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3m0 2.4v.1"/>',
    closed: '<circle cx="8" cy="8" r="5.5"/><path d="m5 8 2 2 4-4"/>',
    search: '<circle cx="6.6" cy="6.6" r="4.1"/><path d="m9.7 9.7 3.4 3.4"/>',
    repo: '<path d="M3 3h9v10H4a1 1 0 0 1-1-1V3Zm0 7h9M5 5h4"/>',
    down: '<path d="m4 6 4 4 4-4"/>', chat: '<path d="M2.5 3.5h11v8H7l-3 2v-2H2.5v-8Z"/>',
    refresh: '<path d="M13 6a5 5 0 1 0-.6 5M13 2v4H9"/>', plus: '<path d="M8 3v10M3 8h10"/>',
    close: '<path d="m4 4 8 8M12 4l-8 8"/>', check: '<path d="m3 8 3 3 7-7"/>',
    back: '<path d="M13 8H3m4-4L3 8l4 4"/>', more: '<circle cx="3" cy="8" r=".7"/><circle cx="8" cy="8" r=".7"/><circle cx="13" cy="8" r=".7"/>',
    filter: '<path d="M2 4h12M4 8h8M6 12h4"/>', file: '<path d="M4 2h5l3 3v9H4V2Zm5 0v4h3M6 9h4M6 11h3"/>',
  };
  return `<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.issue}</svg>`;
};
export const labels = (values = []) => values.map((value) => `<span class="label">${esc(value)}</span>`).join('');
export const button = (action, text, { className = '', extra = '', symbol = '' } = {}) => `<button type="button" class="button ${className}" data-action="${action}" ${extra}>${symbol ? icon(symbol) : ''}${text}</button>`;
export const options = (values, selected, emptyLabel = '') => values.map((value) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(value || emptyLabel)}</option>`).join('');
export const taskText = (status) => ({ draft: '未发送草稿', requested: '请求已发送', pending: '关联待确认', ambiguous: '发现多个可能关联', linked: '已确认关联' })[status] || '尚无已确认会话';
export const taskAction = (status) => ({ draft: '查看未发送草稿', requested: '查看请求状态', pending: '检查会话关联', ambiguous: '核对关联', linked: '返回会话' })[status] || '创建任务';

export function taskDestination(task) {
  if (task?.status !== 'linked') return `<span class="relation">${esc(taskText(task?.status))}</span>`;
  return `<span class="relation relation-linked"><span class="relation-title" title="${esc(task.title)}">${esc(task.title)}</span><span class="relation-context">${icon('check')}<span>已确认关联</span></span></span>`;
}

export function bodyMarkup(body) {
  const parts = String(body).split('```');
  return parts.map((part, index) => {
    if (index % 2) return `<pre tabindex="0"><code>${esc(part.replace(/^\w*\n/, ''))}</code></pre>`;
    return part.split('\n\n').map((block) => {
      const lines = block.split('\n');
      if (lines.length === 1) return `<p>${esc(block)}</p>`;
      const heading = lines[0];
      const content = lines.slice(1);
      if (content.every((line) => /^\d+\. /.test(line))) return `<h2>${esc(heading)}</h2><ol>${content.map((line) => `<li>${esc(line.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`;
      if (content.every((line) => /^- \[ \] /.test(line))) return `<h2>${esc(heading)}</h2><ul class="checks">${content.map((line) => `<li><span class="check-box" aria-hidden="true"></span>${esc(line.replace(/^- \[ \] /, ''))}</li>`).join('')}</ul>`;
      return `<p>${lines.map(esc).join('<br>')}</p>`;
    }).join('');
  }).join('');
}

export function issueForm(values, fixture, { isNew, offline, error = '', conflict = null, busy = false, saved = false }) {
  return `<form id="issue-form" class="editor" novalidate>
    <div class="editor-heading"><h1 id="detail-title" tabindex="-1">${isNew ? '新建 Issue' : `编辑 #${values.number}`}</h1><span class="muted">${saved ? '本机草稿已保存' : '未发布内容'}</span></div>
    <div id="form-error" class="form-error" ${error ? '' : 'hidden'} role="alert" tabindex="-1">${esc(error)}</div>
    ${conflict ? `<section class="conflict" aria-label="远端冲突比较"><h2>远端内容已变化</h2><p>当前输入仍保留在下方。比较后选择采用哪份，不会自动覆盖。</p><div class="compare"><div><h3>远端版本</h3><pre>${esc(conflict.body)}</pre></div><div><h3>本机输入</h3><pre>${esc(values.body)}</pre></div></div><div class="form-actions">${button('use-remote', '采用远端版本')}${button('force-save', '保留本机版本并保存')}</div></section>` : ''}
    <label for="issue-title">标题</label><input id="issue-title" name="title" value="${esc(values.title)}" maxlength="240" required aria-describedby="title-error"><span id="title-error" class="field-error"></span>
    <label for="issue-body">正文</label><textarea id="issue-body" name="body" rows="12">${esc(values.body)}</textarea>
    <fieldset><legend>标签</legend><div class="checkboxes">${fixture.prototype.labels.map((label) => `<label><input type="checkbox" name="labels" value="${esc(label)}" ${values.labels.includes(label) ? 'checked' : ''}>${esc(label)}</label>`).join('')}</div></fieldset>
    <div class="field-grid"><div><label for="issue-assignee">负责人</label><select id="issue-assignee" name="assignee">${options(fixture.prototype.assignees, values.assignee)}</select></div><div><label for="issue-milestone">里程碑</label><select id="issue-milestone" name="milestone">${options(fixture.prototype.milestones, values.milestone, '无里程碑')}</select></div></div>
    <div class="form-actions sticky-actions">${button('cancel-edit', '取消')}<button class="button primary" type="submit" id="save-issue" ${busy ? 'disabled' : ''}>${busy ? '保存中…' : offline ? '保存本机草稿' : '保存'}</button></div>
  </form>`;
}
