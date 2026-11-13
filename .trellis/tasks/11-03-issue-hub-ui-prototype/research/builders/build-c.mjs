import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// 仅在生成时读取共用内容；候选页面不包含运行脚本。
const fixtureUrl = new URL('../../../11-03-github-issue-plugin/ui/explore/round-01/fixture.json', import.meta.url);
const outputUrl = new URL('../../../11-03-github-issue-plugin/ui/explore/round-01/c.html', import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
const detail = fixture.detail;
const visibleComments = detail.previewComments.slice(0, 1);
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const icon = (name) => {
  const paths = {
    search: '<circle cx="6.5" cy="6.5" r="4.5"/><path d="m10 10 4 4"/>',
    down: '<path d="m4 6 4 4 4-4"/>',
    up: '<path d="m4 10 4-4 4 4"/>',
    arrow: '<path d="M2 8h11m-4-4 4 4-4 4"/>',
    refresh: '<path d="M13 6a5.5 5.5 0 1 0 0 5M13 2v4H9"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    issue: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v4m0 2v.2"/>',
    comments: '<path d="M2 2.5h12v9H7l-4 3v-3H2z"/>',
    repo: '<path d="M3 2h10v12H3zM6 2v12M8 5h3"/>',
  };
  return `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">${paths[name]}</svg>`;
};

const relations = {
  linked: { label: detail.task.status, note: detail.task.title },
  draft: { label: '未发送草稿', note: '仅保存在本机' },
  pending: { label: '请求已发送 · 关联待确认', note: '等待确认关联' },
  none: { label: '未关联', note: '' },
};
function issueRow(issue, selected = false) {
  const relation = relations[issue.relation];
  return `<div class="issue-row${selected ? ' selected' : ''}" ${selected ? 'aria-current="true"' : ''}>
    <div class="issue-identity">
      <span class="issue-state">${icon('issue')}</span>
      <div class="issue-copy"><div class="issue-title"><span class="mono number">#${issue.number}</span><span>${escape(issue.title)}</span>${selected ? '<span class="open-state">打开</span>' : ''}</div>
      <div class="issue-meta">${issue.labels.map((label) => `<span class="label">${escape(label)}</span>`).join('')}<span class="meta-dot">·</span><span>${escape(issue.assignee)}</span><span class="meta-dot">·</span><span>${escape(issue.updated)}</span><span class="comment-count">${icon('comments')}${issue.comments}</span></div></div>
    </div>
    <div class="relation ${issue.relation}"><div class="relation-top"><span class="connection" aria-hidden="true"><i></i><b></b></span><span>${escape(relation.label)}</span></div>${relation.note ? `<div class="relation-note">${escape(relation.note)}</div>` : ''}</div>
  </div>`;
}

const before = fixture.issues.find((issue) => issue.number === 183);
const selected = fixture.issues.find((issue) => issue.number === fixture.selectedNumber);
const after = fixture.issues.filter((issue) => ![183, fixture.selectedNumber].includes(issue.number));
const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="fixture-version" content="${escape(fixture.version)}">
<title>${escape(fixture.appName)} · ${escape(fixture.repository.fullName)}</title>
<style>
:root{color-scheme:light;--ink:#232638;--muted:#62677d;--line:#e0e3ec;--accent:#4b56a3;--selection:#ebedf9;--surface:#f5f6f9}
*{box-sizing:border-box}html,body{margin:0;width:1120px;height:880px;overflow:hidden}body{font:14px/1.5 "Microsoft YaHei UI","Microsoft YaHei",sans-serif;color:var(--ink);background:#fff}button{font:inherit;color:inherit;border:0;background:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 10px;height:30px;white-space:nowrap;border-radius:3px}svg{width:16px;height:16px;flex:none;vertical-align:middle}.mono{font-family:"Cascadia Mono",Consolas,monospace;font-size:13px;font-weight:500}.app{height:880px;display:flex;flex-direction:column}.top{height:48px;flex:none;display:flex;align-items:stretch;border-bottom:1px solid var(--line);background:#f4f5f8;padding:0 20px;gap:18px}.brand{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;padding-right:4px}.brand svg{color:var(--accent)}.repository-tabs{display:flex;align-items:stretch;gap:3px}.repository-tabs button{height:48px;border-radius:0;padding:0 16px;font-size:13px;color:var(--muted)}.repository-tabs .active{color:var(--ink);background:#fff;border-bottom:2px solid var(--accent);font-weight:600}.all-repos{margin-left:auto;align-self:center;color:var(--muted);font-size:12px}.toolbar{height:54px;flex:none;display:flex;align-items:center;gap:10px;padding:0 24px;border-bottom:1px solid var(--line)}.search{height:32px;width:282px;border:1px solid #d7dbe7;border-radius:3px;display:flex;align-items:center;padding:0 10px;gap:9px;color:var(--muted);font-size:13px}.search svg{width:14px;height:14px}.key{margin-left:auto;border:1px solid var(--line);padding:0 5px;line-height:20px;font:12px/20px Consolas,monospace;color:var(--muted)}.filter{font-size:13px;padding:0 8px}.filter .count{color:var(--muted);font:12px Consolas,monospace}.filter svg{width:12px;height:12px}.divider{height:18px;width:1px;background:var(--line);margin:0 1px}.toolbar-spacer{flex:1}.secondary{border:1px solid #d9dce6;background:white;font-size:13px}.refresh{color:var(--muted);padding-right:0;font-size:13px}.column-head{height:30px;flex:none;display:grid;grid-template-columns:744px 1fr;background:#fafbfc;border-bottom:1px solid var(--line);color:var(--muted);font-size:12px;align-items:center}.column-head>span:first-child{padding-left:57px}.column-head>span:last-child{padding-left:22px;display:flex;align-items:center;gap:8px}.local-tag{font-size:12px;color:#62677d}.list{flex:1;min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#cdd1df transparent}.issue-row{height:60px;display:grid;grid-template-columns:744px 1fr;border-bottom:1px solid var(--line);background:#fff}.issue-identity{display:flex;align-items:flex-start;padding:9px 22px;gap:12px;min-width:0}.issue-state{padding-top:2px;color:#62677d}.issue-copy{min-width:0;flex:1}.issue-title{display:flex;gap:11px;align-items:center;white-space:nowrap;font-weight:500;line-height:22px}.number{color:var(--muted)}.issue-meta{display:flex;gap:8px;align-items:center;line-height:18px;font-size:12px;color:var(--muted);margin-top:1px}.label{font-size:12px;color:#4f556d}.meta-dot{color:#9095a5}.comment-count{display:flex;gap:4px;align-items:center;margin-left:6px}.comment-count svg{width:12px;height:12px}.relation{padding:10px 20px 7px 22px;display:flex;flex-direction:column;justify-content:center}.relation-top{display:flex;align-items:center;gap:10px;color:#4d557d;font-size:13px;white-space:nowrap;line-height:20px}.connection{display:flex;align-items:center;width:42px;height:12px;flex:none}.connection i{height:0;flex:1;border-top:1px solid #9ca5ce}.connection b{height:7px;width:7px;border:1.5px solid var(--accent);border-radius:50%;background:white}.linked .connection b{background:var(--accent)}.draft .connection i,.pending .connection i{border-top-style:dashed}.pending .connection:before{content:"";width:7px;height:7px;flex:none;border:1.5px solid var(--accent);border-radius:50%;background:#fff}.relation-note{font-size:12px;color:var(--muted);margin-left:52px;line-height:18px;white-space:nowrap}.none .connection{visibility:hidden}.selected{background:var(--selection);border-left:3px solid var(--accent);grid-template-columns:741px 1fr}.selected .issue-identity{padding-left:19px}.selected .issue-state,.selected .number{color:var(--accent)}.selected .issue-title{font-weight:600}.open-state{font-size:12px;font-weight:400;color:#4f587f;border:1px solid #bbc2df;border-radius:3px;line-height:18px;padding:0 5px;margin-left:1px}.expanded{position:relative;border-bottom:1px solid #cbd0e3;padding:0 44px 14px 57px;background:#fff}.expanded:before{content:"";position:absolute;left:30px;top:0;bottom:18px;border-left:1px solid #b5bbd6}.actionbar{height:46px;display:flex;align-items:center;gap:8px}.primary{color:#fff;background:var(--accent);padding:0 13px;font-size:13px;font-weight:500;height:30px}.session-menu{border:1px solid #d4d8e7;padding:0 8px;color:var(--accent);height:30px;font-size:12px}.session-menu svg{width:12px;height:12px}.session-title{color:var(--muted);font-size:12px;margin-left:6px}.actionbar-spacer{flex:1}.text-button{color:var(--muted);font-size:12px;padding:0 7px}.properties{height:36px;border-top:1px solid #eceef4;border-bottom:1px solid #eceef4;display:flex;align-items:center;gap:24px;font-size:12px;margin-bottom:11px}.property{display:flex;align-items:center;gap:9px}.property-label{color:var(--muted)}.property-value{color:#353b54}.document{max-width:932px}.authorline{color:var(--muted);font-size:12px;display:flex;gap:7px;align-items:center;margin-bottom:7px}.authorline strong{color:#454b63;font-weight:500}.body-lead{margin:0 0 10px;font-size:14px;line-height:23px}.text-section{display:grid;grid-template-columns:72px 1fr;gap:0;margin:8px 0;font-size:14px;line-height:23px}.text-section h2{margin:0;font-size:13px;font-weight:600;color:#4a516c;padding-top:1px}.text-section ol,.text-section ul{margin:0;padding:0;list-style:none;counter-reset:steps}.text-section ol li{counter-increment:steps;display:flex;gap:10px}.text-section ol li:before{content:counter(steps) ".";font:12px/23px Consolas,monospace;color:var(--muted)}.text-section ul li{display:flex;align-items:baseline;gap:9px}.text-section ul li:before{content:"";width:4px;height:4px;background:#939bbd;display:inline-block;flex:none;transform:translateY(-2px)}.text-section p{margin:0}.related{font-size:12px;color:var(--muted);margin:9px 0 0;display:flex;align-items:center;gap:14px}.related span:last-child{color:var(--accent)}.discussion-head{display:flex;align-items:center;margin-top:13px;padding-top:10px;border-top:1px solid var(--line);gap:14px;height:34px}.discussion-head h2{margin:0;font-size:13px;font-weight:600}.discussion-head .activity{color:var(--muted);font-size:12px}.loaded{margin-left:auto;font-size:12px;color:var(--muted)}.comment{display:flex;gap:10px;padding-top:9px}.avatar{height:23px;width:23px;background:#eceef6;color:#53608a;border:1px solid #dbe0ef;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:12px;flex:none}.comment-body{flex:1}.comment-byline{font-size:12px;display:flex;align-items:center;gap:10px;line-height:18px}.comment-byline span{color:var(--muted)}.comment p{margin:3px 0 0;font-size:13px;line-height:21px}.discussion-foot{margin:7px 0 0 33px;display:flex;justify-content:space-between;align-items:center}.discussion-foot button{font-size:12px;color:var(--accent);padding:0;height:22px}.footer{height:30px;flex:none;border-top:1px solid #d8dce8;display:flex;align-items:center;padding:0 22px;gap:8px;background:#f5f6f9;color:var(--muted);font-size:12px}.sync-dot{width:5px;height:5px;border-radius:50%;background:#646f9b}.footer .separator{color:#a4a9ba}.footer-spacer{flex:1}.footer .mono{font-size:12px}
</style>
</head>
<body>
<main class="app" aria-label="${escape(fixture.appName)}">
  <header class="top"><div class="brand">${icon('repo')}${escape(fixture.appName)}</div><nav class="repository-tabs" aria-label="仓库">${fixture.repositories.slice(0, 3).map((repository) => `<button type="button" class="${repository.selected ? 'active' : ''}" ${repository.selected ? 'aria-current="page"' : ''}>${escape(repository.fullName)}</button>`).join('')}</nav><button type="button" class="all-repos">全部仓库${icon('down')}</button></header>
  <section class="toolbar" aria-label="Issue 搜索和筛选"><div class="search" role="search">${icon('search')}<span>搜索 Issue</span><span class="key">/</span></div><button type="button" class="filter">打开 <span class="count">${fixture.counts.open}</span>${icon('down')}</button><span class="divider"></span><button type="button" class="filter">标签${icon('down')}</button><button type="button" class="filter">负责人${icon('down')}</button><span class="toolbar-spacer"></span><button type="button" class="secondary">${icon('plus')}新建 Issue</button><button type="button" class="refresh">${icon('refresh')}刷新</button></section>
  <div class="column-head"><span>Issue</span><span>会话关联<span class="local-tag">· 本机</span></span></div>
  <section class="list" aria-label="Issue 列表">
    ${issueRow(before)}
    ${issueRow(selected, true)}
    <article class="expanded" aria-label="#${detail.number} 正文与讨论">
      <div class="actionbar"><button type="button" class="primary">${icon('arrow')}${escape(detail.task.action)}</button><button type="button" class="session-menu" aria-label="会话操作">会话操作${icon('down')}</button><span class="session-title">${escape(fixture.workspace.name)} <span class="mono">/ ${escape(fixture.workspace.branch)}</span></span><span class="actionbar-spacer"></span><button type="button" class="text-button">编辑</button><button type="button" class="text-button">更多${icon('down')}</button><button type="button" class="text-button">收起${icon('up')}</button></div>
      <div class="properties"><span class="property"><span class="property-label">标签</span><span class="property-value">${detail.labels.map(escape).join(' · ')}</span></span><span class="property"><span class="property-label">负责人</span><span class="property-value">${escape(detail.assignee)}</span></span><span class="property"><span class="property-label">里程碑</span><span class="property-value">${escape(detail.milestone)}</span></span></div>
      <div class="document"><div class="authorline"><strong>${escape(detail.author)}</strong><span>创建于 ${escape(detail.created)}</span><span>·</span><span>${escape(detail.updated)}更新</span></div>
      <p class="body-lead">${escape(detail.bodyLead)}</p>
      <section class="text-section"><h2>复现步骤</h2><ol>${detail.steps.map((step) => `<li>${escape(step)}</li>`).join('')}</ol></section>
      <section class="text-section"><h2>预期结果</h2><p>${escape(detail.expectation)}</p></section>
      <section class="text-section"><h2>验收条件</h2><ul>${detail.acceptance.map((acceptance) => `<li>${escape(acceptance)}</li>`).join('')}</ul></section>
      <div class="related"><span>关联 PR</span><span class="mono">${escape(detail.relatedPr)}</span></div>
      <div class="discussion-head"><h2>${escape(detail.commentsLabel)}</h2><span class="activity">活动</span><span class="loaded">已加载 ${visibleComments.length} / ${detail.comments} 条评论</span></div>
      ${visibleComments.map((comment) => `<section class="comment"><div class="avatar">${escape(comment.initials)}</div><div class="comment-body"><div class="comment-byline"><strong>${escape(comment.author)}</strong><span>${escape(comment.time)}</span></div><p>${escape(comment.text)}</p></div></section>`).join('')}
      <div class="discussion-foot"><button type="button">加载更多评论</button><button type="button">添加评论</button></div></div>
    </article>
    ${after.map((issue) => issueRow(issue)).join('')}
  </section>
  <footer class="footer"><span class="sync-dot"></span><span>${escape(fixture.sync.text)}</span><span class="mono">${escape(fixture.sync.time)}</span><span class="separator">·</span><span>${escape(fixture.sync.cadence)}</span><span class="footer-spacer"></span><span>当前账号</span><span class="mono">${escape(fixture.account.login)}</span></footer>
</main>
</body>
</html>`;
await writeFile(outputUrl, html, 'utf8');
console.log(`已生成方向 C：${fileURLToPath(outputUrl)}（1120×880，${fixture.version}）`);
