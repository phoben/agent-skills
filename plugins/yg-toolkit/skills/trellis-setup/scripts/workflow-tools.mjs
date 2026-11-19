// 只读发现本地流程、原生选择和可选模板目录。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { parseArgs } from 'node:util';

export const relative = (root, file) => path.relative(root, file).split(path.sep).join('/');
const VARIANT = /^[A-Za-z0-9_-]+$/;

export function inside(root, file) {
  const target = path.resolve(root, file);
  const rel = path.relative(root, target);
  if (rel.startsWith(`..${path.sep}`) || rel === '..' || path.isAbsolute(rel)) throw new Error('路径超出目标项目');
  let ancestor = target;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const real = fs.realpathSync(ancestor);
  const realRel = path.relative(fs.realpathSync(root), real);
  if (realRel.startsWith(`..${path.sep}`) || realRel === '..' || path.isAbsolute(realRel)) throw new Error('链接指向项目外部');
  return target;
}

export function summarizeWorkflow(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const intro = [], section = [];
  let firstTitle = false, introOpen = false, firstSection = false, done = false;
  let frontmatter = lines[0]?.trim() === '---', fence = null, comment = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (frontmatter) { if (i > 0 && /^(---|\.\.\.)\s*$/.test(raw)) frontmatter = false; continue; }
    // 围栏中的 HTML 注释和标题都只是示例文字，不改变围栏外的解析状态。
    if (fence) {
      const closing = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`);
      if (closing.test(raw)) fence = null;
      if (firstSection) section.push(raw); else if (introOpen) intro.push(raw);
      continue;
    }
    let clean = raw;
    if (comment) { const end = clean.indexOf('-->'); if (end < 0) continue; clean = clean.slice(end + 3); comment = false; }
    while (clean.includes('<!--')) {
      const start = clean.indexOf('<!--'), end = clean.indexOf('-->', start + 4);
      if (end < 0) { clean = clean.slice(0, start); comment = true; break; }
      clean = clean.slice(0, start) + clean.slice(end + 3);
    }
    const marker = clean.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      fence = marker[1];
      if (firstSection) section.push(raw); else if (introOpen) intro.push(raw);
      continue;
    }
    const heading = !fence && clean.match(/^ {0,3}(#{1,6})[ \t]+(.+?)\s*#*\s*$/);
    const level = heading ? heading[1].length : 0;
    if (firstSection && level && level <= 2) { done = true; break; }
    if (!firstTitle && level === 1) { firstTitle = true; introOpen = true; intro.push(clean); continue; }
    if (firstTitle && !firstSection && level === 2) { firstSection = true; introOpen = false; section.push(clean); continue; }
    if (introOpen && level) introOpen = false;
    if (firstSection) section.push(raw); else if (introOpen) intro.push(raw);
  }
  return { title: intro[0]?.replace(/^#\s+/, '') || null, intro: intro.join('\n').trim(), first_section: section.join('\n').trim(), complete: done, missing: [!firstTitle && 'first-h1', !firstSection && 'first-h2'].filter(Boolean) };
}

function workflowSummary(file) {
  // 限量流式读取；摘要章节结束后不将后续全文载入模型上下文。
  const fd = fs.openSync(file, 'r'), chunk = Buffer.alloc(4096);
  const decoder = new StringDecoder('utf8');
  let text = '', summary;
  try {
    for (let bytes = 0; bytes < 131072;) {
      const n = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (!n) { text += decoder.end(); break; }
      bytes += n;
      text += decoder.write(chunk.subarray(0, n));
      summary = summarizeWorkflow(text);
      if (summary.complete) break;
    }
    summary = summarizeWorkflow(text);
    return { ...summary, excerpt_limited: !summary.complete && fs.fstatSync(fd).size > Buffer.byteLength(text) };
  } finally { fs.closeSync(fd); }
}

export function walkFiles(directory, predicate, skipped = () => {}) {
  const result = [];
  let stat, entries;
  try { stat = fs.lstatSync(directory); }
  catch (error) { if (error.code !== 'ENOENT') skipped(directory, '目录状态不可读'); return result; }
  if (stat.isSymbolicLink()) { skipped(directory, '链接目录未扫描'); return result; }
  if (!stat.isDirectory()) { skipped(directory, '任务目录不是目录'); return result; }
  try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
  catch { skipped(directory, '目录内容不可读'); return result; }
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) { skipped(file, '链接条目未扫描'); continue; }
    if (entry.isDirectory()) result.push(...walkFiles(file, predicate, skipped));
    else if (entry.isFile() && predicate(entry.name)) result.push(file);
  }
  return result;
}

function nativeContext(root, task) {
  if (!fs.existsSync(path.join(root, '.trellis/scripts/common/workflow_selection.py'))) return { error: '缺少原生 workflow 解析模块；需按本机能力核实默认选择' };
  const code = `import sys,json
from pathlib import Path
r=Path(sys.argv[1])
sys.path.insert(0,str(r/".trellis/scripts"))
from common.active_task import resolve_active_task,resolve_task_ref
import common.workflow_selection as w
a=resolve_active_task(r)
t=Path(sys.argv[2]) if sys.argv[2] else resolve_task_ref(a.task_path,r) if a.task_path else None
effective=w.workflow_md_for_task(r,t)
requests=[]
limitations=[]
def record(scope,value):
    if value is None or value=="": return
    fn=getattr(w,"_library_variant",None)
    resolved=fn(r,value) if callable(fn) else None
    if not callable(fn): limitations.append("原生模块未提供变体有效性诊断接口")
    requests.append({"scope":scope,"id":value,"available":resolved is not None,"resolved_path":str(resolved) if resolved is not None else None})
if t and (t/"task.json").is_file():
    data=json.loads((t/"task.json").read_text(encoding="utf-8"))
    if isinstance(data,dict): record("task",data.get("workflow"))
for scope,name in (("personal","_developer_workflow_id"),("team","_config_default_id")):
    fn=getattr(w,name,None)
    if callable(fn): record(scope,fn(r))
    else: limitations.append("原生模块未提供"+scope+"选择诊断接口")
print(json.dumps({"path":str(effective),"active_task":a.task_path,"selection_requests":requests,"diagnostic_limitations":limitations}))`;
  const result = spawnSync('python', ['-B', '-c', code, root, task || ''], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 15000, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  try { if (result.status !== 0) throw new Error(); return { ...JSON.parse(result.stdout.trim()), native_warnings: result.stderr?.trim() ? [result.stderr.trim().slice(0, 2000)] : [] }; }
  catch { return { error: '原生解析不可用；保留候选，不猜测当前默认', detail: result.stderr?.slice(0, 500) || result.error?.message }; }
}

export function listWorkflowTemplates(root) {
  const options = { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 20000 };
  const result = spawnSync('trellis', ['workflow', '--list'], options);
  if (process.platform !== 'win32' || !result.error) return result;
  // Windows 的 npm .cmd shim 不能直接 exec；使用同一安装目录中的正式 Node 入口，不启用 shell。
  const found = spawnSync('where.exe', ['trellis'], options);
  const first = found.status === 0 && found.stdout.trim().split(/\r?\n/)[0];
  if (!first) return result;
  const entry = path.join(path.dirname(first), 'node_modules/@mindfoldhq/trellis/bin/trellis.js');
  return fs.existsSync(entry) ? spawnSync(process.execPath, [entry, 'workflow', '--list'], options) : result;
}

export function discoverWorkflows(root, { task, templates = false, resolveNative = nativeContext, listTemplates } = {}) {
  root = fs.realpathSync(root);
  if (!fs.existsSync(path.join(root, '.trellis'))) return { adapter: 'native', current: null, candidates: [], native_sources: ['AGENTS.md', 'CONTRIBUTING.md', 'README.md', '.github/workflows'].filter(p => fs.existsSync(path.join(root, p))) };
  const selected = resolveNative(root, task ? inside(root, task) : null);
  const candidates = [], warnings = [];
  if (selected.error) warnings.push(selected.error);
  warnings.push(...(selected.native_warnings || []), ...(selected.diagnostic_limitations || []));
  const requests = selected.selection_requests || [];
  for (const request of requests) if (!request.available) warnings.push(`原生 ${request.scope} 选择 ${JSON.stringify(request.id)} 缺失或无效，不能把回落当作原选择已生效`);
  const requested = requests[0] || null;
  const mismatch = Boolean(requested && (!requested.available || !selected.path || path.resolve(requested.resolved_path) !== path.resolve(selected.path)));
  const add = (file, source, id = null) => {
    try {
      const real = inside(root, file);
      if (!fs.existsSync(real)) return;
      const rel = relative(root, real);
      const existing = candidates.find(c => c.path === rel);
      if (existing) { if (id) existing.id = id; return; }
      const isSelected = Boolean(selected.path && path.resolve(selected.path) === real);
      candidates.push({ source, id, path: rel, selected: isSelected, ready: !(isSelected && mismatch), selection_fallback: isSelected && mismatch, ...workflowSummary(real) });
    } catch (e) { warnings.push(`${relative(root, file)}: ${e.message}`); }
  };
  if (selected.path) add(selected.path, 'selected');
  add(path.join(root, '.trellis/workflow.md'), 'global');
  for (const file of walkFiles(path.join(root, '.trellis/workflows'), n => n.endsWith('.md'), (file, reason) => warnings.push(`${relative(root, file)}: ${reason}`))) {
    const id = path.basename(file, '.md');
    if (path.dirname(file) === path.join(root, '.trellis/workflows') && VARIANT.test(id)) add(file, 'variant', id);
  }
  let templateList = null;
  if (templates) {
    const r = listTemplates ? listTemplates(root) : listWorkflowTemplates(root);
    if (r.status === 0) templateList = { metadata_only: true, output: r.stdout };
    else warnings.push('模板目录本轮不可读；未使用静态缓存冒充当前目录');
  }
  return { adapter: 'trellis', current: selected.path ? relative(root, path.resolve(selected.path)) : null, requested, selection_requests: requests, selection_mismatch: mismatch, active_task: selected.active_task || null, candidates, templates: templateList, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { root: { type: 'string' }, task: { type: 'string' }, templates: { type: 'boolean' } },
    });
    if (positionals.length !== 1 || positionals[0] !== 'discover' || !values.root) {
      throw new Error('用法：workflow-tools.mjs discover --root <目标项目> [--task <任务路径>] [--templates]');
    }
    const result = discoverWorkflows(values.root, values);
    console.log(JSON.stringify({ ...result, read_only: true }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exitCode = 1;
  }
}
