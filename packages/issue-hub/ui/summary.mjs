import { bodyMarkup, icon, labels } from './ui.mjs';

const interactive = 'a[href],button,input,textarea,select,[contenteditable="true"],pre[tabindex]';
const authorText = issue => `${issue.author || ''} · ${issue.created || ''} 创建`;
const values = issue => ({ labels: JSON.stringify(issue.labels || []), assignees: issue.assignees?.join('、') || issue.assignee || '未分配', milestone: issue.milestone || '无里程碑', updated: issue.updated || '' });
const names = { 标签: 'labels', 负责人: 'assignees', 里程碑: 'milestone', 更新: 'updated' };

export function createSummaryPainter() {
  const remembered = new WeakMap();
  function bindings(root) {
    const properties = {};
    for (const node of root.querySelectorAll('.properties .property')) {
      const key = names[node.querySelector('.property-name')?.textContent];
      if (key) properties[key] = node.querySelector('.property-edit,.property-value') || node.lastElementChild;
    }
    return { title: root.querySelector('#detail-title'), author: root.querySelector('.issue-author'), state: root.querySelector('.open-state'), body: root.querySelector('#issue-body-view'), links: root.querySelector('.related-links'), properties };
  }
  function remember(root, issue, { linksMarkup = '' } = {}) {
    const nodes = bindings(root);
    remembered.set(root, { bodyNode: nodes.body, snapshot: { body: String(issue.body || ''), links: linksMarkup, state: issue.state, ...values(issue) } });
  }
  function paint(root, issue, { manage = false, editing = false, linksMarkup = '' } = {}) {
    if (!root || !issue || editing) return { changed: false, deferred: false };
    const nodes = bindings(root), previous = remembered.get(root);
    const snapshot = previous?.bodyNode === nodes.body ? previous.snapshot : {};
    const active = root.ownerDocument?.activeElement;
    const scroll = root.scrollTop;
    let changed = false, deferred = false;
    function writeText(node, value) {
      if (node && node.textContent !== String(value)) { node.textContent = String(value); changed = true; }
    }
    function writeContent(node, key, value, markup, protect = false) {
      if (!node || snapshot[key] === value) return;
      // 只保护正在使用的正文/链接控件；程序聚焦的标题不阻止远端摘要刷新。
      if (protect && node.contains(active) && active?.matches?.(interactive)) { deferred = true; return; }
      node.innerHTML = markup; snapshot[key] = value; changed = true;
    }
    writeText(nodes.title, issue.title || ''); writeText(nodes.author, authorText(issue));
    writeContent(nodes.state, 'state', issue.state, `${icon(issue.state === 'open' ? 'issue' : 'closed')}${issue.state === 'open' ? '打开' : '已关闭'}`);
    const nextValues = values(issue);
    for (const [key, value] of Object.entries(nextValues)) {
      const node = nodes.properties[key];
      if (key === 'labels') writeContent(node, key, value, labels(issue.labels || []) || '无标签');
      else { writeText(node, value); snapshot[key] = value; }
      if (node?.matches?.('button')) node.disabled = !manage;
    }
    writeContent(nodes.body, 'body', String(issue.body || ''), bodyMarkup(issue.body || ''), true);
    writeContent(nodes.links, 'links', linksMarkup, linksMarkup, true);
    remembered.set(root, { bodyNode: nodes.body, snapshot });
    root.scrollTop = scroll;
    return { changed, deferred };
  }
  return { remember, paint };
}
