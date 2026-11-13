from pathlib import Path

root = Path(__file__).resolve().parents[4]
path = root / 'packages/issue-hub/ui/app.mjs'
text = path.read_text(encoding='utf-8')
text = text.replace("attribute('负责人', esc(issue.assignee))", "attribute('负责人', esc(issue.assignees?.join('、') || issue.assignee || '未分配'))")
text = text.replace("<span class=\"sort-label\">最近更新</span>", "<span class=\"sort-label\">最近更新 · 已加载</span>")
text = text.replace("case 'edit-comment': preserveBefore(", "case 'edit-comment': await preserveBefore(")
text = text.replace("if (callback) preserveBefore(callback);", "if (callback) await preserveBefore(callback);")
text = text.replace("closeOverlay(false); callback?.(); break;", "closeOverlay(false); await callback?.(); break;")
path.write_text(text, encoding='utf-8')
