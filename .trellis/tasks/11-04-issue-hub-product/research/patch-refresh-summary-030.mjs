// 仅给既有只读区域增加稳定节点，不改变完整详情的布局或编辑器。
import { readFile, writeFile } from 'node:fs/promises';
const path = new URL('../../../../packages/issue-hub/ui/app.mjs', import.meta.url);
let source = await readFile(path, 'utf8');
source = source.replace('<span>${esc(issue.author)} · ${esc(issue.created)} 创建</span>', '<span class="issue-author">${esc(issue.author)} · ${esc(issue.created)} 创建</span>');
source = source.replace('<article class="doc">${bodyMarkup(issue.body)}<div class="related-links">', '<article class="doc"><div id="issue-body-view">${bodyMarkup(issue.body)}</div><div class="related-links">');
await writeFile(path, source);
