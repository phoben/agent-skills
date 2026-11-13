from pathlib import Path

root = Path(__file__).resolve().parents[4]
path = root / 'packages/issue-hub/ui/app.mjs'
text = path.read_text(encoding='utf-8')
start = text.index('<div class="related-links">', text.index('function renderDetail'))
end = text.index('</div></article>', start)
text = text[:start] + '<div class="related-links">${sourceLinks(issue)}' + text[end:]
text = text.replace('讨论 · ${issue.commentItems.length}', '讨论 · ${issue.comments}')
text = text.replace('/ ${issue.commentItems.length}</span>', "/ ${issue.comments}${issue.coverage?.comments?.complete === false ? ' · 尚未全部获取' : ''}</span>")
start = text.index(': `<ol class="activity-list">', text.index('function renderDetail'))
end = text.index('</ol>`}', start)
text = text[:start] + ': activityMarkup(issue)' + text[end + 7:]
text = text.replace("${permission('comment') ? commentEditor() : ''}</section>", "${permission('comment') ? commentEditor() : ''}<p class=\"extension-note muted\">Projects、子 Issue 和依赖关系可在 GitHub 查看。${button('source-issue', '打开 GitHub', { className: 'plain' })}</p></section>")
text = text.replace('<p>${esc(comment.text)}</p>', '<div class="comment-body">${bodyMarkup(comment.text)}</div>')
text = text.replace('(state.visibleComments < issue.commentItems.length ?', '(state.visibleComments < issue.commentItems.length || issue.coverage?.comments?.nextCursor ?')
path.write_text(text, encoding='utf-8')
