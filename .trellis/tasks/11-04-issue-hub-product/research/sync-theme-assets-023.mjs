// 在源文件中同步同一矢量标记与中性遮罩，不进入正式构建依赖。
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../../../../', import.meta.url);
const appPath = new URL('packages/issue-hub/ui/app.mjs', root);
let app = await readFile(appPath, 'utf8');
app = app.replace('safeUrl, issueCountLabels }', 'safeUrl, issueCountLabels, brandMark }');
app = app.replace("<div class=\"brand\">${icon('issue')}${'Issue Hub'}</div>", '<div class="brand">${brandMark()}Issue Hub</div>');
await writeFile(appPath, app);
const cssPath = new URL('packages/issue-hub/ui/style.css', root);
await writeFile(cssPath, (await readFile(cssPath, 'utf8')).replace('#10261b55', 'var(--backdrop)'));
const asset = (await readFile(new URL('plugins/issue-hub/assets/icon.svg', root), 'utf8')).trim();
const htmlPath = new URL('packages/issue-hub/ui/index.html', root);
let html = await readFile(htmlPath, 'utf8');
html = html.replace(/<link rel="icon"[^>]+>/, `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(asset)}">`);
await writeFile(htmlPath, html);
