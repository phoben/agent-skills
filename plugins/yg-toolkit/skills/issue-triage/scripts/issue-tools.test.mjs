import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseIssue, issueFromMeta, summarizeWorkflow, discoverWorkflows, findTasks, activeTaskGuard, inspectProject, labelsForKind, planInitialization, applyInitialization } from './issue-tools.mjs';

const repo = { host: 'github.com', full_name: 'example/project' };
const identity = parseIssue('#12', repo);
const metadata = (number = 12, host = 'github.com', name = 'example/project') => ({ source_kind: 'github_issue', github_repo: name, github_issue: String(number), github_issue_url: `https://${host}/${name}/issues/${number}` });
const contract = () => ({ schema_version: 1, provider: 'github', repository: repo, workflow: { discovery: 'runtime', summary: 'first-h1-and-h2' }, labels: { stage: { triage: '阶段:待分诊' }, kind: { bug: [] } }, authority: { labels: 'confirm' } });
const workflow = '# Example\n\n适用小范围需求。\n\n## 适用场景\n调查后按需实施。\n\n## 执行\n不要预读此处的所有步骤。\n\n[workflow-state:no_task]\n原有批准门禁。\n[/workflow-state:no_task]\n\n[workflow-state:in_progress]\n保留质量检查。\n[/workflow-state:in_progress]\n';

function fixture(t, trellis = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-tools-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  if (trellis) write(root, '.trellis/workflow.md', workflow);
  return root;
}
function write(root, rel, text) { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof text === 'object' ? JSON.stringify(text) : text); return file; }
const resolve = root => ({ path: path.join(root, '.trellis/workflow.md'), active_task: null });

function realNativeFixture(t) {
  const root = fixture(t);
  const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['trellis'], { encoding: 'utf8' });
  const executable = found.status === 0 && found.stdout.trim().split(/\r?\n/)[0];
  const options = [process.env.TRELLIS_TEST_COMMON];
  if (executable) {
    options.push(path.join(path.dirname(executable), 'node_modules/@mindfoldhq/trellis/dist/templates/trellis/scripts/common'));
    options.push(path.resolve(path.dirname(fs.realpathSync(executable)), '../dist/templates/trellis/scripts/common'));
  }
  const source = options.find(p => p && fs.existsSync(path.join(p, 'workflow_selection.py')));
  if (!source) { t.skip('需要已安装 Trellis 的真实 common 模块；可用 TRELLIS_TEST_COMMON 指定只读来源'); return null; }
  fs.cpSync(source, path.join(root, '.trellis/scripts/common'), { recursive: true, filter: p => !p.includes('__pycache__') });
  write(root, '.github/issue-management.json', contract());
  return root;
}

test('编号依赖明确仓库，URL 与大小写规范化', () => {
  assert.deepEqual(parseIssue('#12', repo), identity);
  assert.equal(parseIssue('https://GitHub.Com/Example/Project/issues/12#issuecomment-4').url, identity.url);
  assert.throws(() => parseIssue('#12'), /唯一确定/);
});
test('引用、裸数字、PR、凭据和非正整数不被误触发', () => {
  for (const input of ['12', '日志中提到 #12', '#0', '#-1', 'https://github.com/a/b/pull/1', 'https://user:secret@github.com/a/b/issues/1']) assert.throws(() => parseIssue(input, repo));
});
test('同编号的主机和仓库不会混为来源', () => {
  assert.notDeepEqual(parseIssue('#12', repo), parseIssue('https://git.example.org/example/project/issues/12'));
  assert.notDeepEqual(parseIssue('#12', repo), parseIssue('other/project#12', repo));
});
test('关联要求四个字段一致，不能靠标题或者类型猜测', () => {
  assert.deepEqual(issueFromMeta(metadata()), identity);
  assert.equal(issueFromMeta({ ...metadata(), source_kind: 'other' }), null);
  assert.equal(issueFromMeta({ ...metadata(), github_issue: '13' }), null);
  assert.equal(issueFromMeta({ ...metadata(), github_repo: 'other/project' }), null);
});
test('Markdown 只提取首H1导语和首H2章节', () => {
  const summary = summarizeWorkflow(workflow);
  assert.equal(summary.title, 'Example');
  assert.match(summary.intro, /小范围/);
  assert.match(summary.first_section, /调查后/);
  assert.doesNotMatch(summary.first_section, /所有步骤/);
});

test('H1前的导航章节不抢占实际流程的首H2', () => {
  const summary = summarizeWorkflow('## 导航\n导航内容\n# 实际流程\n真实导语\n## 适用场景\n真实范围\n## 执行\n后续步骤');
  assert.equal(summary.title, '实际流程');
  assert.match(summary.intro, /真实导语/);
  assert.match(summary.first_section, /真实范围/);
  assert.doesNotMatch(summary.first_section, /导航内容|后续步骤/);
  assert.deepEqual(summary.missing, []);
});
test('忽略 frontmatter、HTML注释和代码块里的伪标题', () => {
  const text = '---\n# YAML comment\n---\n<!--\n# 隐藏\n## 隐藏章节\n-->\n```md\n# 假标题\n## 假章节\n```\n# 真标题\n导语\n## 真章节\n```md\n## 代码示例\n```\n### 章节内部\n内容\n## 下一节\n不读取';
  const summary = summarizeWorkflow(text);
  assert.equal(summary.title, '真标题');
  assert.match(summary.first_section, /章节内部/);
  assert.doesNotMatch(summary.first_section, /不读取/);
});
test('缺少适用章节明确标识，不能编造用途', () => {
  const summary = summarizeWorkflow('# Only title\n');
  assert.deepEqual(summary.missing, ['first-h2']);
  assert.equal(summary.first_section, '');
});
test('围栏内未闭合HTML注释是字面量，不能吞掉首节适用边界', () => {
  const summary = summarizeWorkflow('# 标题\n## 适用\n```html\n<!-- opening example\n```\n仅适用API回归，不适用UI\n## 执行\n后续步骤');
  assert.match(summary.first_section, /仅适用API回归，不适用UI/);
  assert.doesNotMatch(summary.first_section, /后续步骤/);
  assert.equal(summary.complete, true);
});
test('动态新增、删除和改名的变体即时反映', t => {
  const root = fixture(t);
  assert.equal(discoverWorkflows(root, { resolveNative: resolve }).candidates.length, 1);
  const first = write(root, '.trellis/workflows/custom.md', workflow);
  assert.equal(discoverWorkflows(root, { resolveNative: resolve }).candidates.length, 2);
  fs.renameSync(first, path.join(path.dirname(first), 'renamed.md'));
  assert.equal(discoverWorkflows(root, { resolveNative: resolve }).candidates[1].id, 'renamed');
  fs.unlinkSync(path.join(path.dirname(first), 'renamed.md'));
  assert.equal(discoverWorkflows(root, { resolveNative: resolve }).candidates.length, 1);
});
test('任务实际pin优先且保留原生变体ID', t => {
  const root = fixture(t), pin = write(root, '.trellis/workflows/chosen.md', workflow);
  const result = discoverWorkflows(root, { resolveNative: () => ({ path: pin, active_task: '.trellis/tasks/current' }) });
  assert.equal(result.current, '.trellis/workflows/chosen.md');
  assert.equal(result.candidates.filter(c => c.selected).length, 1);
  assert.equal(result.candidates[0].id, 'chosen');
});
test('模板目录动态读取但元数据不冒充已加载正文', t => {
  const root = fixture(t);
  const result = discoverWorkflows(root, { resolveNative: resolve, templates: true, listTemplates: () => ({ status: 0, stdout: 'this-run-only-template' }) });
  assert.equal(result.templates.metadata_only, true);
  assert.match(result.templates.output, /this-run-only/);
  assert.equal(result.candidates.length, 1);
});
test('原生解析和模板失败时报告限制，不用静态默认掩盖', t => {
  const root = fixture(t);
  const result = discoverWorkflows(root, { resolveNative: () => ({ error: '解析缺失' }), templates: true, listTemplates: () => ({ status: 1 }) });
  assert.equal(result.current, null);
  assert.equal(result.warnings.length, 2);
  assert.equal(result.templates, null);
});
test('真实原生resolver的缺失档案pin回落必须可见', t => {
  const root = realNativeFixture(t);
  if (!root) return;
  const task = '.trellis/tasks/archive/2026-01/old';
  write(root, `${task}/task.json`, { meta: metadata(), workflow: 'missing-original' });
  const result = inspectProject(root, '#12', { task });
  assert.ok(result.workflows.warnings.some(w => w.includes('missing-original')));
  assert.equal(result.workflows.selection_mismatch, true);
  assert.equal(result.workflows.requested.id, 'missing-original');
  assert.equal(result.workflows.current, '.trellis/workflow.md');
  assert.equal(result.workflows.candidates.find(c => c.selected).ready, false);
});
test('真实原生resolver静默回落的个人默认缺失仍应诊断', t => {
  const root = realNativeFixture(t);
  if (!root) return;
  write(root, '.trellis/.developer', 'name=fixture\nworkflow=missing-personal\n');
  const result = inspectProject(root, '#12');
  assert.equal(result.workflows.requested.scope, 'personal');
  assert.equal(result.workflows.selection_mismatch, true);
  assert.ok(result.workflows.warnings.some(w => w.includes('missing-personal')));
});
test('真实原生resolver静默回落的团队默认缺失仍应诊断', t => {
  const root = realNativeFixture(t);
  if (!root) return;
  write(root, '.trellis/config.yaml', 'default_workflow: missing-team\n');
  const result = inspectProject(root, '#12');
  assert.equal(result.workflows.requested.scope, 'team');
  assert.equal(result.workflows.selection_mismatch, true);
  assert.ok(result.workflows.warnings.some(w => w.includes('missing-team')));
});
test('大文件的后续全文不进入摘要，中文跨块保持完整', t => {
  const root = fixture(t);
  write(root, '.trellis/workflow.md', '# 中文标题\n\n'+ '字'.repeat(1800) + '\n## 首节\n适用规则。\n## 后续\n' + '秘密后文'.repeat(50000));
  const item = discoverWorkflows(root, { resolveNative: resolve }).candidates[0];
  assert.doesNotMatch(item.intro + item.first_section, /秘密后文|�/);
  assert.match(item.first_section, /适用规则/);
});
test('同一Issue的活跃父子和档案一起发现但不推断阶段', t => {
  const root = fixture(t);
  write(root, '.trellis/tasks/parent/task.json', { id: 'parent', meta: metadata(), children: ['child'], status: 'review' });
  write(root, '.trellis/tasks/child/task.json', { id: 'child', meta: metadata(), parent: 'parent', status: 'planning' });
  write(root, '.trellis/tasks/archive/2026-01/old/task.json', { id: 'old', meta: metadata(), status: 'completed' });
  write(root, '.trellis/tasks/foreign/task.json', { id: 'foreign', meta: metadata(12, 'git.example.org') });
  const tasks = findTasks(root, identity);
  assert.equal(tasks.length, 3);
  assert.equal(tasks.filter(x => x.archived).length, 1);
  assert.ok(tasks.every(x => x.evidence_required && !('stage' in x)));
});
test('损坏记录和来源矛盾不被当成完整排除', t => {
  const root = fixture(t), warnings = [];
  write(root, '.trellis/tasks/bad/task.json', '{broken');
  write(root, '.trellis/tasks/source/task.json', { meta: { ...metadata(), github_issue: '99' } });
  assert.equal(findTasks(root, identity, { warnings }).length, 0);
  assert.equal(warnings.length, 2);
});
test('tasks根链接被安全跳过时不能报告完整排除已有工作', t => {
  const root = fixture(t);
  write(root, '.github/issue-management.json', contract());
  write(root, '.trellis/task-store/existing/task.json', { meta: metadata() });
  fs.symlinkSync(path.join(root, '.trellis/task-store'), path.join(root, '.trellis/tasks'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = inspectProject(root, '#12', { resolveNative: resolve });
  assert.equal(result.task_lookup_complete, false);
  assert.ok(result.task_scan_warnings.some(w => w.includes('链接')));
});
test('tasks嵌套链接也必须留下覆盖不完整诊断', t => {
  const root = fixture(t);
  write(root, '.github/issue-management.json', contract());
  write(root, '.trellis/task-store/existing/task.json', { meta: metadata() });
  fs.mkdirSync(path.join(root, '.trellis/tasks'));
  fs.symlinkSync(path.join(root, '.trellis/task-store'), path.join(root, '.trellis/tasks/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = inspectProject(root, '#12', { resolveNative: resolve });
  assert.equal(result.task_lookup_complete, false);
  assert.ok(result.task_scan_warnings.some(w => w.includes('linked')));
});
test('活动异源Task不能被自动切换或实施', t => {
  const root = fixture(t);
  write(root, '.trellis/tasks/current/task.json', { meta: metadata(13) });
  const result = activeTaskGuard(root, '.trellis/tasks/current', identity);
  assert.equal(result.kind, 'different-source');
  assert.equal(result.may_implement, false);
  assert.match(result.next, /worktree/);
});
test('同源和未知来源仍不赋予实施权限', t => {
  const root = fixture(t);
  write(root, '.trellis/tasks/current/task.json', { meta: metadata() });
  assert.equal(activeTaskGuard(root, '.trellis/tasks/current', identity).kind, 'same-source');
  write(root, '.trellis/tasks/current/task.json', {});
  assert.equal(activeTaskGuard(root, '.trellis/tasks/current', identity).kind, 'source-unconfirmed');
  assert.equal(activeTaskGuard(root, null, identity).may_implement, false);
});
test('无Trellis项目只发现其真实规则入口', t => {
  const root = fixture(t, false);
  write(root, 'AGENTS.md', '# 项目约定');
  const result = discoverWorkflows(root);
  assert.equal(result.adapter, 'native');
  assert.deepEqual(result.native_sources, ['AGENTS.md']);
  assert.equal(fs.existsSync(path.join(root, '.trellis')), false);
});
test('链接指向其他项目时不套用当前任务和授权', t => {
  const root = fixture(t);
  write(root, '.github/issue-management.json', contract());
  write(root, '.trellis/tasks/local/task.json', { meta: metadata() });
  const result = inspectProject(root, 'https://github.com/other/project/issues/12');
  assert.equal(result.project_mismatch, true);
  assert.deepEqual(result.tasks, []);
  assert.equal(result.workflows, null);
});
test('合同与真实origin冲突时停止，而不是信任旧绑定', t => {
  const root = fixture(t);
  assert.equal(spawnSync('git', ['init', '--quiet', root]).status, 0);
  assert.equal(spawnSync('git', ['-C', root, 'remote', 'add', 'origin', 'https://github.com/actual/project.git']).status, 0);
  write(root, '.github/issue-management.json', contract());
  assert.throws(() => inspectProject(root, '#12', { resolveNative: resolve }), /origin 不一致/);
  assert.throws(() => planInitialization(root, contract()), /origin 不一致/);
});
test('显式档案也必须核对来源，不能把另一Issue的任务拿来推荐', t => {
  const root = fixture(t);
  write(root, '.github/issue-management.json', contract());
  write(root, '.trellis/tasks/other/task.json', { meta: metadata(13) });
  assert.throws(() => inspectProject(root, '#12', { task: '.trellis/tasks/other', resolveNative: resolve }), /来源未能/);
});
test('canonical初始标签来自项目合同，不复制旧Matt值', () => {
  assert.deepEqual(labelsForKind(contract(), 'bug'), ['阶段:待分诊']);
  assert.throws(() => labelsForKind({}, 'bug'), /triage/);
});
test('接入先只生成差异，批准后保留用户门禁及托管块', t => {
  const root = fixture(t);
  const original = '<!-- TRELLIS:START -->\n原始托管块\n<!-- TRELLIS:END -->\n\n用户自己的约定\n';
  write(root, 'AGENTS.md', original);
  const plan = planInitialization(root, contract());
  assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), original);
  assert.throws(() => applyInitialization(root, plan), /批准/);
  applyInitialization(root, plan, true);
  assert.ok(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8').startsWith(original.trimEnd()));
  const text = fs.readFileSync(path.join(root, '.trellis/workflow.md'), 'utf8');
  assert.match(text, /原有批准门禁/);
  assert.match(text, /保留质量检查/);
  assert.match(text, /异源/);
});
test('重跑接入及重放已完成计划均幂等', t => {
  const root = fixture(t), plan = planInitialization(root, contract());
  applyInitialization(root, plan, true);
  assert.deepEqual(applyInitialization(root, plan, true).written, []);
  assert.deepEqual(planInitialization(root, contract()).changes, []);
});

test('Windows检出后的CRLF受管块重跑保持原字节', t => {
  const root = fixture(t);
  applyInitialization(root, planInitialization(root, contract()), true);
  const files = ['AGENTS.md', '.trellis/workflow.md'];
  for (const file of files) {
    const absolute = path.join(root, file);
    fs.writeFileSync(absolute, fs.readFileSync(absolute, 'utf8').replace(/\r?\n/g, '\r\n'));
  }
  const before = files.map(file => fs.readFileSync(path.join(root, file)));
  assert.deepEqual(planInitialization(root, contract()).changes, []);
  files.forEach((file, index) => assert.deepEqual(fs.readFileSync(path.join(root, file)), before[index]));
});
test('全量before-SHA预检，最后一文件冲突不造成前面部分写入', t => {
  const root = fixture(t), plan = planInitialization(root, contract());
  write(root, '.trellis/workflow.md', workflow + '\n并行编辑\n');
  assert.throws(() => applyInitialization(root, plan, true), /文件已变化/);
  assert.equal(fs.existsSync(path.join(root, '.github/issue-management.json')), false);
  assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
});
test('手改受管块不被覆盖，非受管内容及未知合同字段保留', t => {
  const root = fixture(t);
  write(root, '.github/issue-management.json', { custom_project_rule: '保留' });
  applyInitialization(root, planInitialization(root, contract()), true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.github/issue-management.json'))).custom_project_rule, '保留');
  const file = path.join(root, 'AGENTS.md');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Issue 管理', '手工修改'));
  assert.throws(() => planInitialization(root, contract()), /手工修改/);
});
test('无Trellis初始化不制造其结构，也不固定候选名称', t => {
  const root = fixture(t, false);
  applyInitialization(root, planInitialization(root, contract()), true);
  assert.equal(fs.existsSync(path.join(root, '.trellis')), false);
  const actual = JSON.parse(fs.readFileSync(path.join(root, '.github/issue-management.json')));
  assert.equal(actual.workflow.discovery, 'runtime');
  assert.equal(actual.routing, undefined);
});
test('目录越界和不允许的计划文件被拒绝', t => {
  const root = fixture(t);
  const plan = { schema_version: 1, root: fs.realpathSync(root), changes: [{ path: '../outside', before_sha256: null, after: 'bad' }] };
  assert.throws(() => applyInitialization(root, plan, true), /非接入文件/);
  assert.throws(() => discoverWorkflows(root, { task: '../outside' }), /超出/);
});
test('旧静态Type-ID映射和重复状态块不静默接入', t => {
  const root = fixture(t);
  assert.throws(() => planInitialization(root, { ...contract(), routing: { by_type: { bug: 'fixed' } } }), /固定表/);
  write(root, '.trellis/workflow.md', workflow + '\n[workflow-state:no_task]\n另一个\n[/workflow-state:no_task]\n');
  assert.throws(() => planInitialization(root, contract()), /重复状态块/);
});

test('升级时已有合同的静态映射不能借合并被静默保留', t => {
  const root = fixture(t, false);
  const file = path.join(root, '.github/issue-management.json');
  for (const stale of [{ routing: { by_type: { bug: 'old-fixed' } } }, { workflow: { candidates: ['old-fixed'] } }]) {
    write(root, '.github/issue-management.json', { ...stale, custom_project_rule: '保留' });
    const before = fs.readFileSync(file, 'utf8');
    assert.throws(() => planInitialization(root, contract()), /已有合同.*固定表/);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.equal(fs.existsSync(path.join(root, 'AGENTS.md')), false);
    assert.equal(fs.existsSync(path.join(root, '.trellis')), false);
  }
});
test('工具CLI inspect不创建或激活Task，错误输入可判定失败', t => {
  const root = fixture(t, false);
  write(root, '.github/issue-management.json', contract());
  const script = fileURLToPath(new URL('./issue-tools.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, 'inspect', '--root', root, '--issue', '#12', '--no-templates'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).activeTaskGuard.kind, 'no-task');
  assert.equal(fs.existsSync(path.join(root, '.trellis')), false);
  assert.notEqual(spawnSync(process.execPath, [script, 'inspect', '--root', root, '--issue', '12'], { encoding: 'utf8' }).status, 0);
});
