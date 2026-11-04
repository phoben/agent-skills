import { build } from 'esbuild';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { Script } from 'node:vm';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plugin = resolve(packageDir, '../../plugins/yg-toolkit');
const manifest = JSON.parse(await readFile(join(plugin, 'plugin.json'), 'utf8'));
const compatibility = JSON.parse(await readFile(join(plugin, '.codex-plugin/plugin.json'), 'utf8'));
if (manifest.name !== 'yg-toolkit' || manifest.name !== compatibility.name || manifest.version !== compatibility.version) throw new Error('YG插件清单名称和版本必须一致。');
const buildVersion = process.env.YG_TOKEN_BUILD_VERSION || manifest.version;
if (!/^\d+\.\d+\.\d+$/.test(buildVersion)) throw new Error('目标构建版本无效。');
const out = join(plugin, 'dist'); await mkdir(out, { recursive: true });
const host = await build({ absWorkingDir: packageDir, entryPoints: ['src/main.mjs'], bundle: true, platform: 'node', format: 'cjs', target: 'node24', outfile: join(out, 'issue-hub.cjs'), metafile: true, minify: true, charset: 'utf8', banner: { js: `// Issue Hub 版本: ${buildVersion}` }, define: { __ISSUE_HUB_VERSION__: JSON.stringify(buildVersion) } });
const ui = await build({ absWorkingDir: packageDir, entryPoints: ['ui/app.mjs'], bundle: true, platform: 'browser', format: 'iife', target: 'chrome120', write: false, outdir: 'out', metafile: true, minify: true, charset: 'utf8', define: { __ISSUE_HUB_VERSION__: JSON.stringify(buildVersion) } });
const js = ui.outputFiles.find(file => file.path.endsWith('.js'))?.text;
const css = ui.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n');
if (!js) throw new Error('没有生成验证页脚本。');
new Script(js);
let html = await readFile(join(packageDir, 'ui/index.html'), 'utf8');
// 回调插入避免第三方脚本中的美元替换序列损坏内联内容。
html = html.replace('<!-- APP_STYLE -->', () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`).replace('<!-- APP_SCRIPT -->', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
if (/\b(?:src|href)=["'](?:\.\.?\/|https?:)/i.test(html)) throw new Error('验证页仍依赖外部资源。');
await writeFile(join(out, 'issue-hub.html'), `<!-- Issue Hub 版本: ${buildVersion} -->\n${html}`);
// 正式页面成功生成后移除已退役的已知P0输出，避免分发过期验证页。
await rm(join(out, 'issue-hub-host-proof.html'), { force: true });
const licenses = new Map();
for (const input of new Set([...Object.keys(host.metafile.inputs), ...Object.keys(ui.metafile.inputs)])) {
  if (!input.includes('node_modules/')) continue;
  let directory = dirname(resolve(packageDir, input));
  while (directory.includes('node_modules')) {
    let pkg; try { pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')); } catch { directory = dirname(directory); continue; }
    if (!pkg.name || !pkg.version) { directory = dirname(directory); continue; }
    const key = `${pkg.name}@${pkg.version}`;
    if (!licenses.has(key)) {
      let license;
      for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE-MIT', 'COPYING']) { try { license = await readFile(join(directory, name), 'utf8'); break; } catch { /* 继续尝试依赖提供的许可文件。 */ } }
      if (!license) throw new Error(`缺少可分发依赖许可：${key}`);
      licenses.set(key, license);
    }
    break;
  }
}
await writeFile(join(out, 'issue-hub-THIRD-PARTY-LICENSES.txt'), [...licenses].map(([name, license]) => `${name}\n${license}`).join('\n\n'));
process.stdout.write(`YG Toolkit ${buildVersion} Issue Hub模块构建完成。\n`);
