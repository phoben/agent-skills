import { readFile, writeFile } from 'node:fs/promises';

// 只在构建时读取共享内容，交付页面不包含运行脚本。
const fixtureUrl = new URL('../../../11-03-github-issue-plugin/ui/explore/round-01/fixture.json', import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
const detail = fixture.detail;
if (detail.number !== fixture.selectedNumber || detail.relation !== 'linked') {
  throw new Error('当前首屏需要共享数据中已确认关联的选中 Issue。');
}
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = (name, className = '') => {
  const paths = {
    issue: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3m0 2.4v.1"/>',
    search: '<circle cx="6.6" cy="6.6" r="4.1"/><path d="m9.7 9.7 3.4 3.4"/>',
    repo: '<path d="M3 3h9v10H4a1 1 0 0 1-1-1V3Zm0 7h9M5 5h4"/>',
    down: '<path d="m4 6 4 4 4-4"/>',
    chat: '<path d="M2.5 3.5h11v8H7l-3 2v-2H2.5v-8Z"/>',
    refresh: '<path d="M13 6a5 5 0 1 0-.6 5M13 2v4H9"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    close: '<path d="m4 4 8 8M12 4l-8 8"/>',
    check: '<path d="m3 8 3 3 7-7"/>',
    filter: '<path d="M2 4h12M4 8h8M6 12h4"/>',
    arrow: '<path d="M3 8h10m-4-4 4 4-4 4"/>',
    link: '<path d="m6 10 4-4m-5 5-1 1a3 3 0 0 1-4-4l3-3a3 3 0 0 1 4 0m2 0 1-1a3 3 0 0 1 4 4l-3 3a3 3 0 0 1-4 0" transform="translate(1 -1)"/>',
  };
  return `<svg class="icon ${className}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};
const labels = (values) => values.map((value) => `<span class="label">${escape(value)}</span>`).join('');
const repos = fixture.repositories.map((repo) => `<div class="repo ${repo.selected ? 'current' : ''}" ${repo.selected ? 'aria-current="page"' : ''}>${icon('repo')}<span>${escape(repo.name)}</span><span class="repo-count">${repo.open}</span></div>`).join('');
// 窄队列只显示本视口能完整容纳的对象行，不生成屏幕以下区块。
const issues = fixture.issues.filter((issue) => issue.state === 'open').slice(0, 14).map((issue) => `<div class="issue-row ${issue.number === fixture.selectedNumber ? 'selected' : ''}" ${issue.number === fixture.selectedNumber ? 'aria-current="true"' : ''}>
  <div class="issue-line">${icon('issue', 'issue-state')}<span class="number">#${issue.number}</span><span class="issue-title">${escape(issue.title)}</span></div>
  <div class="issue-meta">${labels(issue.labels)}<span>${escape(issue.assignee)}</span><time>${escape(issue.updated)}</time></div>
</div>`).join('');
const comments = detail.previewComments.map((comment) => `<article class="comment"><div class="comment-head"><span class="avatar">${escape(comment.initials)}</span><strong>${escape(comment.author)}</strong><time>${escape(comment.time)}</time></div><p>${escape(comment.text)}</p></article>`).join('');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1120, initial-scale=1">
<meta name="fixture-version" content="${escape(fixture.version)}">
<title>${escape(fixture.appName)} · 连读队列</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:1120px;height:880px;overflow:hidden}body{font:14px/1.5 "Segoe UI Variable Text","Segoe UI","Microsoft YaHei UI",sans-serif;color:#1d2c25;background:#fff}button{font:inherit;color:inherit;appearance:none;border:0;background:none;padding:0}button,.search{border-radius:4px}svg{flex:none}.icon{width:16px;height:16px;vertical-align:middle}.workspace{display:grid;width:1120px;height:856px;grid-template-columns:164px 316px 640px}.nav{background:#eef2f0;border-right:1px solid #cfdad3;display:flex;flex-direction:column;padding:0 8px}.brand{height:56px;display:flex;align-items:center;gap:8px;padding:0 9px;font-weight:600;letter-spacing:-.2px}.brand .icon{color:#236248;width:18px;height:18px}.nav-search{margin:0 4px 23px;padding:6px 7px;border:1px solid #cfdad3;background:#f8faf9;color:#53665a;display:flex;gap:6px;align-items:center;font-size:12px;line-height:18px}.nav-section{font-size:12px;color:#53665a;padding:0 10px 8px}.repo{height:36px;display:flex;align-items:center;gap:6px;padding:0 8px;color:#45594e;font-size:12px;border-radius:4px;white-space:nowrap}.repo.current{background:#dfe9e3;color:#1d4e39;font-weight:600}.repo .icon{width:14px;height:14px}.repo-count{font-size:12px;flex:1;text-align:right;color:#53665a;font-weight:400;font-variant-numeric:tabular-nums}.nav-bottom{margin-top:auto;padding:12px 8px 16px;border-top:1px solid #d9e1dc;color:#53665a;font-size:12px}.nav-bottom strong{display:block;font-size:12px;font-weight:500;color:#3c5145;margin-top:5px}.branch{display:flex;align-items:center;gap:7px}.branch-dot{width:5px;height:5px;border:1px solid #748278;border-radius:50%}.queue{border-right:1px solid #cfdad3;overflow:hidden;display:flex;flex-direction:column}.queue-toolbar{height:104px;flex:none;border-bottom:1px solid #cfdad3;padding:12px 14px 0}.queue-context{display:flex;align-items:center;justify-content:space-between;line-height:20px;margin-bottom:10px}.queue-context strong{font-size:14px;font-weight:600}.quiet-tools{display:flex;gap:12px;color:#53665a}.search{height:28px;border:1px solid #cfdad3;display:flex;align-items:center;gap:6px;padding:0 7px;font-size:12px;color:#5f7166}.search .icon{width:14px;height:14px}.search .filter-icon{margin-left:auto}.tabs{height:33px;display:flex;align-items:center;gap:18px;font-size:12px;color:#53665a}.tab{height:33px;display:flex;align-items:center;gap:5px}.tab.active{border-bottom:2px solid #236248;font-weight:600;color:#236248}.tab-count{font-weight:400;font-variant-numeric:tabular-nums}.sort{margin-left:auto;display:flex;align-items:center;gap:2px}.sort .icon{width:12px;height:12px}.issue-row{height:52px;border-bottom:1px solid #e5ebe7;padding:5px 12px 5px 14px;position:relative}.issue-row.selected{background:#e5f0e9}.issue-row.selected:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:#236248}.issue-line{display:flex;align-items:center;gap:6px;line-height:21px;min-width:0}.issue-state{width:14px;height:14px;color:#62816c}.selected .issue-state{color:#236248}.number{font-size:12px;color:#53665a;font-variant-numeric:tabular-nums;flex:none}.issue-title{white-space:nowrap;text-overflow:ellipsis;overflow:hidden;font-size:14px;font-weight:500;letter-spacing:-.2px}.selected .issue-title{font-weight:600;color:#174b33}.issue-meta{display:flex;align-items:center;gap:6px;margin-left:20px;height:20px;font-size:12px;color:#53665a;white-space:nowrap}.label{font-size:12px;line-height:17px;padding:0 4px;border:1px solid #d5dfd8;border-radius:3px;background:#f4f7f5;color:#53675b;font-weight:400;white-space:nowrap}.issue-meta time{margin-left:auto;font-variant-numeric:tabular-nums}.queue-bottom{height:24px;margin-top:auto;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 14px;color:#53665a;font-size:12px;background:#fafcfb;border-top:1px solid #e5ebe7}.detail{background:#fff;height:856px;overflow:hidden}.detail-header{padding:16px 24px 15px}.detail-eyebrow{display:flex;align-items:center;gap:9px;height:20px;font-size:12px;color:#53665a}.detail-eyebrow .number{font-size:13px;color:#45594e}.open{display:flex;align-items:center;gap:4px;color:#236248}.open .icon{width:14px;height:14px}.detail-tools{margin-left:auto;display:flex;gap:16px;align-items:center}.detail-tools button{font-size:12px}.detail-tools .icon{width:14px;height:14px}h1{margin:10px 0 14px;font-size:18px;font-weight:600;line-height:27px;letter-spacing:-.3px}.action-row{display:flex;align-items:center;gap:10px}.primary{height:30px;background:#236248;color:#fff;display:inline-flex;gap:7px;align-items:center;padding:0 11px;font-size:13px;font-weight:500;border-radius:4px}.primary .icon{width:14px;height:14px}.primary .divider{height:14px;width:1px;background:#8db09c;margin-left:2px}.relation{font-size:12px;color:#53665a;display:flex;align-items:center;gap:4px}.relation .icon{width:13px;height:13px;color:#236248}.properties{border-top:1px solid #e5ebe7;border-bottom:1px solid #dce5df;padding:9px 24px 10px;display:grid;grid-template-columns:1fr 1fr;row-gap:8px;font-size:12px}.property{display:flex;align-items:center;gap:9px;min-height:18px}.property-name{color:#5f7166;min-width:36px}.property-value{color:#3b5144}.properties .label{line-height:17px}.doc{padding:17px 24px 15px;font-size:14px;line-height:22px}.doc p{margin:0}.lead{color:#354a3e}.doc-section{margin-top:13px}.doc h2{font-size:13px;line-height:20px;margin:0 0 6px;font-weight:600;color:#334b3d}.doc ol{margin:0;padding-left:21px}.doc ol li{padding-left:2px;margin:0;font-size:14px;line-height:22px}.checks{list-style:none;margin:0;padding:0}.checks li{display:flex;gap:8px;align-items:center;height:22px}.check-box{width:12px;height:12px;flex:none;border:1px solid #c0cfc5;border-radius:2px;background:#fff}.related{display:flex;align-items:center;gap:7px;margin-top:13px;font-size:12px;color:#53665a}.related .icon{width:13px;height:13px}.pr-title{color:#36674e}.discussion{border-top:1px solid #dce5df;padding:13px 24px 0}.discussion-header{display:flex;align-items:center;gap:17px;height:23px;margin-bottom:9px}.discussion-header h2{margin:0;font-size:13px;font-weight:600;color:#273e30}.discussion-header .inactive{font-size:12px;color:#5f7166}.discussion-header .loaded{margin-left:auto;font-size:12px;color:#5f7166}.comment{padding:9px 0 10px;border-top:1px solid #edf1ee}.comment-head{display:flex;gap:7px;align-items:center;font-size:12px;line-height:20px}.avatar{width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:12px;border:1px solid #d5dfd8;border-radius:4px;color:#53665a;background:#f4f7f5}.comment-head strong{font-weight:600}.comment-head time{color:#5f7166}.comment p{margin:5px 0 0 27px;font-size:13px;line-height:21px;color:#43594b}.discussion-bottom{display:flex;justify-content:space-between;padding-top:8px;font-size:12px;color:#53665a}.text-action{font-size:12px;display:flex;gap:5px;align-items:center;color:#426b54}.text-action .icon{width:13px;height:13px}.statusbar{height:24px;background:#f3f6f4;border-top:1px solid #cfdad3;display:flex;align-items:center;padding:0 14px;gap:8px;font-size:12px;color:#53665a}.statusbar .icon{width:12px;height:12px;color:#236248}.status-separator{color:#a9b8ae}.status-account{margin-left:auto}.footer-action{font-size:12px;margin-left:12px;color:#4b6254}
</style>
</head>
<body>
<main class="workspace">
  <aside class="nav" aria-label="仓库导航">
    <div class="brand">${icon('issue')}${escape(fixture.appName)}</div>
    <div class="nav-search">${icon('search')}<span>搜索仓库</span></div>
    <div class="nav-section">仓库 · ${escape(fixture.repository.owner)}</div>
    ${repos}
    <div class="nav-bottom"><div>${escape(fixture.workspace.name)}</div><strong class="branch"><span class="branch-dot"></span>${escape(fixture.workspace.branch)}</strong></div>
  </aside>
  <section class="queue" aria-label="Issue 队列">
    <header class="queue-toolbar">
      <div class="queue-context"><strong>${escape(fixture.repository.fullName)}</strong><div class="quiet-tools"><button aria-label="刷新">${icon('refresh')}</button><button aria-label="新建 Issue">${icon('plus')}</button></div></div>
      <div class="search">${icon('search')}<span>搜索 Issue</span><span class="filter-icon">${icon('filter')}</span></div>
      <div class="tabs"><span class="tab active">打开 <span class="tab-count">${fixture.counts.open}</span></span><span class="tab">全部 <span class="tab-count">${fixture.counts.all}</span></span><span class="sort">最近更新 ${icon('down')}</span></div>
    </header>
    <div>${issues}</div>
    <div class="queue-bottom"><span>按最近更新排序</span><span>↓ 更多 Issue</span></div>
  </section>
  <section class="detail" aria-label="选中 Issue 详情">
    <header class="detail-header">
      <div class="detail-eyebrow"><span class="number">#${detail.number}</span><span class="open">${icon('issue')}打开</span><span>${escape(detail.author)} · ${escape(detail.created)} 创建</span><div class="detail-tools"><button>更多 ${icon('down')}</button><button aria-label="收起详情">${icon('close')}</button></div></div>
      <h1>${escape(detail.title)}</h1>
      <div class="action-row"><button class="primary">${icon('chat')}${escape(detail.task.action)}<span class="divider"></span>${icon('down')}</button><span class="relation">${icon('check')}${escape(detail.task.status)}</span></div>
    </header>
    <div class="properties">
      <div class="property"><span class="property-name">标签</span>${labels(detail.labels)}</div>
      <div class="property"><span class="property-name">负责人</span><span class="property-value">${escape(detail.assignee)}</span></div>
      <div class="property"><span class="property-name">里程碑</span><span class="property-value">${escape(detail.milestone)}</span></div>
      <div class="property"><span class="property-name">更新</span><span class="property-value">${escape(detail.updated)}</span></div>
    </div>
    <article class="doc">
      <p class="lead">${escape(detail.bodyLead)}</p>
      <section class="doc-section"><h2>复现步骤</h2><ol>${detail.steps.map((step) => `<li>${escape(step)}</li>`).join('')}</ol></section>
      <section class="doc-section"><h2>预期结果</h2><p>${escape(detail.expectation)}</p></section>
      <section class="doc-section"><h2>验收条件</h2><ul class="checks">${detail.acceptance.map((item) => `<li><span class="check-box"></span><span>${escape(item)}</span></li>`).join('')}</ul></section>
      <div class="related">${icon('link')}<span>关联 PR</span><span class="pr-title">${escape(detail.relatedPr)}</span></div>
    </article>
    <section class="discussion" aria-label="讨论">
      <div class="discussion-header"><h2>${escape(detail.commentsLabel)}</h2><span class="inactive">活动</span><span class="loaded">已加载 ${detail.previewComments.length} / ${detail.comments}</span></div>
      ${comments}
      <div class="discussion-bottom"><button class="text-action">加载更多评论 ${icon('down')}</button><button class="text-action">回复讨论 ${icon('arrow')}</button></div>
    </section>
  </section>
</main>
<footer class="statusbar">${icon('check')}<span>${escape(fixture.sync.text)} · 最后成功 ${escape(fixture.sync.time)}</span><span class="status-separator">·</span><span>${escape(fixture.sync.cadence)}</span><span class="status-account">当前账号 ${escape(fixture.account.login)}</span><button class="footer-action">手动刷新</button></footer>
</body>
</html>
`;
await writeFile(new URL('a.html', fixtureUrl), html, 'utf8');
console.log(`已生成方向 A：1120×880，数据版本 ${fixture.version}`);
