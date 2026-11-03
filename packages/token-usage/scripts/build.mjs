import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(packageDir, '../..');
const out = join(repo, 'plugins/yg-toolkit/dist');
const manifest = JSON.parse(await readFile(join(repo, 'plugins/yg-toolkit/.codex-plugin/plugin.json'), 'utf8'));
const portable = JSON.parse(await readFile(join(repo, 'plugins/yg-toolkit/plugin.json'), 'utf8'));
if (portable.name !== manifest.name || portable.version !== manifest.version) throw new Error('两份插件清单的名称与版本不一致。');
// 先构建目标版本，再切换清单，避免Windows运行中的同版本缓存被覆盖。
const buildVersion=process.env.YG_TOKEN_BUILD_VERSION||manifest.version;
if(!/^\d+\.\d+\.\d+$/.test(buildVersion))throw new Error('目标构建版本无效。');
await mkdir(out, { recursive: true });
const host = await build({ absWorkingDir: packageDir, entryPoints: ['src/main.mjs'], bundle: true, platform: 'node', format: 'cjs', target: 'node24', outfile: join(out, 'token-usage.cjs'), metafile: true, define: { __YG_VERSION__: JSON.stringify(buildVersion) }, minify: true, charset: 'utf8' });
const ui = await build({ absWorkingDir: packageDir, entryPoints: ['ui/app.mjs'], bundle: true, platform: 'browser', format: 'iife', target: 'chrome120', write: false, outdir: 'out', metafile: true, minify: true, charset: 'utf8', define: { __YG_VERSION__: JSON.stringify(buildVersion) } });
const js = ui.outputFiles.find(file => file.path.endsWith('.js'))?.text;
const css = ui.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n');
if (!js) throw new Error('页面构建没有生成脚本。');
let html = await readFile(join(packageDir, 'ui/index.html'), 'utf8');
html = html.replace(/<script\b[^>]*src=["']\.\/app\.mjs["'][^>]*>\s*<\/script>/g, '');
if (!html.includes('<!-- APP_STYLE -->') || !html.includes('<!-- APP_SCRIPT -->')) throw new Error('页面缺少构建插槽。');
// 使用回调插入，避免SDK脚本中的美元替换序列被String.replace解释。
html = html.replace('<!-- APP_STYLE -->', () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`).replace('<!-- APP_SCRIPT -->', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
const embedded = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!embedded) throw new Error('页面没有内联脚本。');
new Script(embedded, { filename: 'token-usage-ui.js' });
if (/\b(?:src|href)=["'](?:\.\.\/|\.\/|https?:)/i.test(html)) throw new Error('构建页面仍引用外部资源。');
await writeFile(join(out, 'token-usage.html'), html, 'utf8');

const licenses = new Map();
for (const input of new Set([...Object.keys(host.metafile.inputs), ...Object.keys(ui.metafile.inputs)])) {
  if (!input.includes('node_modules/')) continue;
  let directory = dirname(resolve(packageDir, input));
  while (directory.includes('node_modules')) {
    let pkg;
    try { pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')); } catch { directory = dirname(directory); continue; }
    if (!pkg.name || !pkg.version) { directory = dirname(directory); continue; }
    const key = `${pkg.name}@${pkg.version}`;
    if (!licenses.has(key)) {
      let text;
      for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE-MIT', 'COPYING']) {
        try { text = await readFile(join(directory, name), 'utf8'); break; } catch { /* 继续查找包内许可文件。 */ }
      }
      if (!text) throw new Error(`依赖缺少可分发许可：${key}`);
      licenses.set(key, text);
    }
    break;
  }
}
await writeFile(join(out, 'THIRD-PARTY-LICENSES.txt'), [...licenses].map(([name, text]) => `${name}\n${text}`).join('\n\n'));
process.stdout.write(`已构建 YG Toolkit ${buildVersion} 用量服务与内联页面。\n`);
