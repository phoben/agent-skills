import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const outputUrl = new URL('../../../11-03-github-issue-plugin/ui/explore/round-01/b.html', import.meta.url);
const fixtureUrl = new URL('./fixture.json', outputUrl);
const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
const issue = fixture.detail;
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = (path) => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}"/></svg>`;
const back = icon('M10 3 5 8l5 5M5 8h9');
const down = icon('m4 6 4 4 4-4');
const previous = icon('m10 3-5 5 5 5');
const next = icon('m6 3 5 5-5 5');
const comments = issue.previewComments.map((comment) => `
  <article class="comment">
    <div class="comment-heading"><span class="avatar">${escape(comment.initials)}</span><strong>${escape(comment.author)}</strong><span class="comment-time">${escape(comment.time)}</span><button class="comment-more" aria-label="评论操作">···</button></div>
    <p>${escape(comment.text)}</p>
  </article>`).join('');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1120, initial-scale=1">
<meta name="fixture-version" content="${escape(fixture.version)}">
<title>专注阅读 · ${escape(fixture.appName)}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:1120px;height:880px;overflow:hidden}body{font-family:DengXian,"Microsoft YaHei",sans-serif;font-size:15px;line-height:1.6;color:#2a2420;background:#fff}button{font:inherit;color:inherit;background:none;border:0;padding:0;white-space:nowrap;cursor:default}svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.25;stroke-linecap:butt;stroke-linejoin:miter;flex:none}.mono{font-family:Consolas,monospace}button,.muted,.comment-time{font-size:13px}.muted,.comment-time{color:#71665e}.shell{width:1120px;height:880px;display:grid;grid-template-rows:52px 40px 126px 634px 28px}.toolbar{padding:0 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ddd6d0;background:#f2f1ef}.repo{width:240px;height:30px;display:flex;align-items:center;gap:10px;border:1px solid #d3cbc4;background:#fff;padding:0 10px;border-radius:2px;font-family:Consolas,monospace;font-size:14px}.repo svg:last-child{margin-left:auto}.toolbar-end{display:flex;align-items:center;gap:20px;color:#71665e}.app-name{font-size:12px;letter-spacing:.03em}.text-button{display:inline-flex;align-items:center;gap:7px;height:30px}.navigation{display:flex;align-items:center;justify-content:space-between;padding:0 32px;border-bottom:1px solid #ebe6e2}.back-group{display:flex;align-items:center;gap:17px}.crumb{border-left:1px solid #ddd6d0;padding-left:17px;color:#71665e;font-size:13px}.next-group{display:flex;align-items:center;gap:20px;color:#71665e}.next-group .previous{color:#a59a92}.issue-heading{padding:22px 32px 19px;display:grid;grid-template-columns:800px 224px;gap:32px;border-bottom:1px solid #ddd6d0}.issue-heading h1{font-size:22px;line-height:1.4;font-weight:600;margin:0 0 13px;letter-spacing:.01em}.issue-meta{display:flex;align-items:center;gap:11px;font-size:13px;color:#71665e}.state{display:inline-flex;gap:6px;align-items:center;color:#4f5d40;background:#eef0e8;border:1px solid #d7ddcc;border-radius:2px;padding:0 7px;height:23px;font-size:12px}.state-mark{height:10px;width:10px;border:1.5px solid currentColor;border-radius:50%;display:inline-block}.dot{color:#b3a79f}.heading-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;align-content:flex-start;gap:8px;padding-top:1px}.primary{height:32px;background:#9a432a;color:white;border:1px solid #9a432a;padding:0 14px;border-radius:2px;display:inline-flex;align-items:center;gap:9px;font-size:14px}.primary-menu{border-left:1px solid #c28674;padding-left:10px;margin-left:3px;height:18px;display:inline-flex;align-items:center}.more{border:1px solid #d3cbc4;padding:0 11px;height:32px;border-radius:2px}.confirmed{font-size:12px;color:#71665e;flex-basis:100%;text-align:right;margin-top:1px}.confirmed::before{content:"";display:inline-block;width:5px;height:5px;background:#687456;margin-right:6px;vertical-align:2px}.reading-layout{padding:0 32px;display:grid;grid-template-columns:800px 224px;gap:32px;overflow:hidden}.document{padding:20px 0 0}.body-text{padding-right:18px}.body-text p{margin:0;font-size:15px;line-height:24px}.body-text h2{font-size:15px;font-weight:600;margin:12px 0 4px;line-height:24px}.body-text ol{margin:0;padding-left:23px;line-height:24px}.body-text ul{list-style:none;margin:0;padding:0}.body-text ul li{line-height:24px;display:flex;align-items:center;gap:8px}.check-box{width:11px;height:11px;border:1px solid #bcb1a7;border-radius:1px;display:inline-block;flex:none}.discussion{margin-top:20px;border-top:1px solid #ddd6d0;padding-top:12px}.discussion-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.discussion-heading h2{font-size:16px;font-weight:600;line-height:26px;margin:0}.discussion-heading span{font-size:12px;color:#71665e}.comment{padding:9px 0 10px;border-bottom:1px solid #ebe6e2}.comment-heading{display:flex;align-items:center;gap:8px;line-height:24px}.avatar{width:23px;height:23px;background:#eeeae5;color:#71665e;display:inline-flex;align-items:center;justify-content:center;font-size:12px;border-radius:2px}.comment-heading strong{font-size:13px;font-weight:600}.comment-time{font-size:12px}.comment-more{margin-left:auto;color:#71665e;padding:0 3px;letter-spacing:2px}.comment p{margin:5px 0 0 31px;font-size:14px;line-height:22px}.discussion-foot{display:flex;align-items:center;justify-content:space-between;padding-top:10px;color:#71665e;font-size:12px}.read-more{font-size:12px;color:#9a432a}.properties{padding:22px 0 0 22px;border-left:1px solid #ebe6e2;background:linear-gradient(90deg,#fcfbfa,white 48px)}.rail-label{font-size:12px;font-weight:600;color:#71665e;letter-spacing:.04em;margin-bottom:8px}.page-anchor{font-size:13px;display:flex;flex-direction:column;align-items:stretch;margin-bottom:24px}.page-anchor span{padding:3px 0 3px 11px;border-left:1px solid #ddd6d0;color:#71665e;line-height:23px}.page-anchor .current{border-left:2px solid #9a432a;color:#9a432a;padding-left:10px}.field{margin:0 0 16px}.field-title{font-size:12px;color:#71665e;margin-bottom:4px}.field-value{font-size:13px;line-height:22px}.labels{display:flex;gap:14px}.label{font-size:13px;display:inline-flex;align-items:center;gap:6px}.label::before{content:"";width:4px;height:4px;background:#a8755d}.label:last-child::before{background:#8a8b76}.assignee{display:flex;align-items:center;gap:7px}.assignee .avatar{height:20px;width:20px;font-size:12px}.rail-section{border-top:1px solid #ddd6d0;padding-top:16px;margin-top:19px}.linked-title{font-size:13px;line-height:22px;margin:4px 0 8px}.relation{font-size:12px;display:flex;align-items:center;gap:6px;color:#71665e}.relation-mark{height:6px;width:6px;background:#687456;border-radius:50%}.related-pr{font-size:13px;color:#9a432a;line-height:22px}.workspace{font-size:12px;color:#71665e;line-height:22px;margin-top:13px}.footer{border-top:1px solid #ddd6d0;background:#f2f1ef;color:#71665e;font-size:12px;display:flex;align-items:center;justify-content:space-between;padding:0 32px}.footer-group{display:flex;gap:13px;align-items:center}.sync-dot{height:5px;width:5px;border-radius:50%;background:#687456;margin-right:5px;display:inline-block}.footer .mono{font-size:12px}.refresh{font-size:12px;color:#71665e}
</style>
</head>
<body>
<main class="shell">
  <header class="toolbar">
    <button class="repo" aria-label="选择仓库">${icon('M3 2.5h9v11H3zM5 2.5v11M7 5h3M7 8h3')}${escape(fixture.repository.fullName)}${down}</button>
    <div class="toolbar-end"><span class="app-name">${escape(fixture.appName)}</span><button class="text-button">刷新</button></div>
  </header>
  <nav class="navigation" aria-label="Issue 导航">
    <div class="back-group"><button class="text-button">${back}返回列表</button><span class="crumb mono">#${issue.number}</span></div>
    <div class="next-group"><button class="text-button previous" disabled>${previous}上一条</button><button class="text-button">下一条${next}</button></div>
  </nav>
  <section class="issue-heading">
    <div><h1>${escape(issue.title)}</h1><div class="issue-meta"><span class="state"><span class="state-mark"></span>${issue.state === 'open' ? '打开' : '已关闭'}</span><span>${escape(issue.author)} 于 ${escape(issue.created)} 创建</span><span class="dot">·</span><span>${escape(issue.updated)}更新</span></div></div>
    <div class="heading-actions"><button class="primary">${escape(issue.task.action)}<span class="primary-menu">${down}</span></button><button class="more">更多</button><div class="confirmed">${escape(issue.task.status)}</div></div>
  </section>
  <div class="reading-layout">
    <div class="document">
      <section class="body-text" aria-label="正文">
        <p>${escape(issue.bodyLead)}</p>
        <h2>复现步骤</h2><ol>${issue.steps.map((step) => `<li>${escape(step)}</li>`).join('')}</ol>
        <h2>预期行为</h2><p>${escape(issue.expectation)}</p>
        <h2>验收条件</h2><ul>${issue.acceptance.map((item) => `<li><span class="check-box"></span>${escape(item)}</li>`).join('')}</ul>
      </section>
      <section class="discussion" aria-label="讨论">
        <div class="discussion-heading"><h2>${escape(issue.commentsLabel)}</h2><span>按时间顺序</span></div>
        ${comments}
        <div class="discussion-foot"><span>已加载 ${issue.previewComments.length} / ${issue.comments} 条评论</span><button class="read-more">加载更多评论 ↓</button></div>
      </section>
    </div>
    <aside class="properties" aria-label="属性与本页导航">
      <div class="rail-label">本页</div>
      <div class="page-anchor"><span class="current">正文</span><span>讨论 · ${issue.comments}</span><span>活动</span></div>
      <div class="field"><div class="field-title">标签</div><div class="labels">${issue.labels.map((label) => `<span class="label">${escape(label)}</span>`).join('')}</div></div>
      <div class="field"><div class="field-title">负责人</div><div class="field-value assignee"><span class="avatar">${escape(fixture.account.initials)}</span>${escape(issue.assignee)}</div></div>
      <div class="field"><div class="field-title">里程碑</div><div class="field-value">${escape(issue.milestone)}</div></div>
      <div class="rail-section"><div class="rail-label">关联会话</div><div class="linked-title">${escape(issue.task.title)}</div><div class="relation"><span class="relation-mark"></span>${escape(issue.task.status)}</div><div class="workspace">${escape(fixture.workspace.name)}<br>分支 <span class="mono">${escape(fixture.workspace.branch)}</span></div></div>
      <div class="rail-section"><div class="rail-label">关联 PR</div><div class="related-pr">${escape(issue.relatedPr)}</div></div>
    </aside>
  </div>
  <footer class="footer"><div class="footer-group"><span><i class="sync-dot"></i>${escape(fixture.sync.text)} <span class="mono">${escape(fixture.sync.time)}</span></span><span>${escape(fixture.sync.cadence)}</span><button class="refresh">手动刷新</button></div><span>当前账号 <span class="mono">${escape(fixture.account.login)}</span></span></footer>
</main>
</body>
</html>`;

await writeFile(outputUrl, html, 'utf8');
console.log(`已生成 ${fileURLToPath(outputUrl)}（${fixture.version}）`);
