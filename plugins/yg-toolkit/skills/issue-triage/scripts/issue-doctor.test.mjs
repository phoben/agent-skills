import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { diagnoseProject } from './issue-doctor.mjs';

const contract = () => ({ schema_version: 1, provider: 'github', repository: { host: 'github.com', full_name: 'example/project' },
  workflow: { discovery: 'runtime', summary: 'first-h1-and-h2' }, labels: { stage: { triage: '阶段:待分诊' }, kind: { bug: [] } }, authority: { labels: 'confirm' } });
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-doctor-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function write(root, file, value) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
}
function snapshot(root) {
  const files = {};
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.isFile()) files[path.relative(root, target)] = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    }
  };
  walk(root);
  return files;
}
function probes(options = {}) {
  const calls = [];
  const run = (command, args) => {
    calls.push({ command, args });
    const success = stdout => ({ status: 0, stdout, stderr: '' });
    const missing = () => ({ status: 1, stdout: '', stderr: 'PRIVATE_TOKEN_MUST_NOT_LEAK' });
    if (args[0] === '--version') return options[command] ? success(`${command} 3.14.0`) : missing();
    if (command === 'where.exe') return missing();
    if (command === 'git') {
      if (args[0] === 'rev-parse') return options.gitRepository === false ? missing() : success('/fixture/repo');
      if (args[0] === 'status') return success(options.dirty ? ' M private-file.txt\n' : '');
      if (args[0] === 'config') return options.noIdentity ? missing() : success('PRIVATE_IDENTITY_MUST_NOT_LEAK');
      if (args[0] === 'remote') return options.origin === null ? missing() : success(options.origin || 'https://github.com/example/project.git');
    }
    if (command === 'gh' && args[0] === 'api') {
      if (args.includes('--paginate')) {
        if (options.labelsDenied) return missing();
        return success(JSON.stringify(options.pages || [[{ name: '阶段:待分诊' }]]));
      }
      if (options.accessDenied) return missing();
      return success(JSON.stringify({ full_name: options.remoteFullName || 'example/project', has_issues: options.issuesEnabled !== false,
        permissions: { pull: true, push: false, admin: false }, private: true, irrelevant: 'PRIVATE_BODY_MUST_NOT_LEAK' }));
    }
    throw new Error(`测试发现未声明命令：${command} ${JSON.stringify(args)}`);
  };
  return { run, calls };
}
const check = (report, id) => report.checks.find(item => item.id === id);
function localSetup(root) {
  write(root, '.github/issue-management.json', contract());
  const body = '## Issue 管理\n使用项目流程完成前置处理。';
  const digest = crypto.createHash('sha256').update(body).digest('hex');
  write(root, 'AGENTS.md', `# 项目规则\n<!-- ISSUE-MANAGEMENT:START -->\n<!-- managed-sha256:${digest} -->\n${body}\n<!-- ISSUE-MANAGEMENT:END -->\n`);
}
function trellisSetup(root, platform = 'codex', registered = true, script = true) {
  localSetup(root);
  for (const file of ['workflow.md', 'scripts/common/workflow_selection.py', 'scripts/common/active_task.py', 'scripts/task.py', 'scripts/get_context.py']) write(root, `.trellis/${file}`, '# 原生夹具\n');
  for (const name of ['trellis-start', 'trellis-continue']) write(root, `.agents/skills/${name}/SKILL.md`, '# 原生技能\n');
  const hook = `.${platform}/hooks/inject-workflow-state.py`;
  if (script) write(root, hook, '# 绝不执行此测试hook\n');
  const configuration = platform === 'codex' ? '.codex/hooks.json' : '.claude/settings.json';
  write(root, configuration, { hooks: registered ? { UserPromptSubmit: [{ hooks: [{ type: 'command', command: `python "${hook}"` }] }] } : {} });
}
const discover = root => ({ current: '.trellis/workflow.md', candidates: [{ path: '.trellis/workflow.md', id: null, selected: true, ready: true }], warnings: [] });

test('空白目录无需Issue或合同即可诊断，缺项可行动但不自动安装', t => {
  const root = fixture(t), probe = probes();
  const before = snapshot(root);
  const report = diagnoseProject(root, { run: probe.run });
  assert.equal(report.status, 'needs_setup');
  assert.equal(report.selected_workflow, null);
  assert.equal(check(report, 'issue.contract').status, 'missing');
  assert.equal(check(report, 'trellis.project').evidence.state, 'not_installed');
  assert.equal(check(report, 'tools.trellis').required, false);
  assert.equal(report.read_only, true);
  assert.equal(report.complete, false);
  assert.equal(report.readiness.github, 'not_checked');
  assert.ok(report.next_actions.some(action => action.check === 'workflow.selection'));
  assert.deepEqual(snapshot(root), before);
  assert.equal(probe.calls.some(call => call.command === 'gh'), false);
});

test('已有非Trellis流程不会被可选Trellis或Python依赖阻断', t => {
  const root = fixture(t), probe = probes();
  localSetup(root);
  const report = diagnoseProject(root, { workflow: 'existing', run: probe.run });
  assert.equal(report.selected_workflow, 'existing');
  assert.equal(report.readiness.local, 'needs_verification');
  assert.equal(check(report, 'workflow.rules').status, 'unknown');
  assert.equal(check(report, 'tools.trellis').required, false);
  assert.equal(check(report, 'trellis.project').status, 'not_applicable');
  assert.equal(probe.calls.some(call => call.command === 'python'), false);
  assert.equal(report.status, 'needs_verification');
  assert.equal(report.complete, false);
});

test('只有README仍是待调研候选，不会自动宣告完整接入', t => {
  const root = fixture(t);
  write(root, 'README.md', '# 项目介绍');
  const report = diagnoseProject(root, { run: probes().run });
  assert.equal(report.status, 'needs_setup');
  assert.deepEqual(check(report, 'workflow.sources').evidence.candidates, ['README.md']);
  assert.match(check(report, 'workflow.sources').evidence.meaning, /仅证明资料存在/);
  assert.equal(report.complete, false);
});

test('CLI已装但项目未初始化与残缺Trellis分开诊断', t => {
  const root = fixture(t), probe = probes({ trellis: true });
  assert.equal(check(diagnoseProject(root, { workflow: 'trellis', run: probe.run }), 'trellis.project').evidence.state, 'project_uninitialized');
  write(root, '.trellis/workflow.md', '# 本地流程');
  const report = diagnoseProject(root, { workflow: 'trellis', run: probe.run });
  assert.equal(check(report, 'trellis.project').evidence.state, 'incomplete');
  assert.ok(check(report, 'trellis.project').evidence.missing_files.includes('.trellis/scripts/common/workflow_selection.py'));
  assert.equal(check(report, 'trellis.workflows').status, 'unknown');
});

test('hook脚本存在不代表注册，只有其他hook也不冒充状态注入', t => {
  const root = fixture(t);
  trellisSetup(root, 'codex', false, true);
  const report = diagnoseProject(root, { workflow: 'trellis', platform: 'codex', run: probes({ trellis: true, python: true }).run, discoverWorkflows: discover });
  assert.equal(check(report, 'agent.codex.registration').status, 'missing');
  assert.equal(report.status, 'needs_setup');
  write(root, '.codex/hooks.json', { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'echo anything' }] }] } });
  assert.equal(check(diagnoseProject(root, { workflow: 'trellis', platform: 'codex', run: probes({ trellis: true, python: true }).run, discoverWorkflows: discover }), 'agent.codex.registration').status, 'missing');
});

test('已注册但脚本缺失会报告安装缺项，不能通过', t => {
  const root = fixture(t);
  trellisSetup(root, 'claude', true, false);
  const report = diagnoseProject(root, { workflow: 'trellis', platform: 'claude', run: probes({ trellis: true, python: true }).run, discoverWorkflows: discover });
  assert.equal(check(report, 'agent.claude.registration').status, 'missing');
  assert.match(check(report, 'agent.claude.registration').evidence, /脚本缺失/);
});

test('注册完整仍待宿主开关信任及冷启动，未执行hook或伪造其他平台', t => {
  const root = fixture(t), probe = probes({ trellis: true, python: true });
  trellisSetup(root);
  write(root, '.trellis/tasks/current/task.json', { status: 'in_progress' });
  write(root, '.trellis/.runtime/sessions/session.json', { current_task: '.trellis/tasks/current' });
  write(root, '.trellis/.template-hashes.json', { native: 'protected' });
  const before = snapshot(root);
  const report = diagnoseProject(root, { workflow: 'trellis', platform: 'codex', run: probe.run, discoverWorkflows: discover });
  assert.equal(check(report, 'agent.codex.registration').status, 'pass');
  assert.equal(check(report, 'agent.codex.activation').status, 'unknown');
  assert.equal(report.readiness.local, 'needs_verification');
  assert.equal(check(report, 'agent.claude.registration'), undefined);
  assert.deepEqual(snapshot(root), before);
  assert.ok(probe.calls.every(call => !call.args.some(arg => /inject-workflow-state|task\.py/.test(arg))));
});

test('未指定平台仅列候选，原生坏绑定保持待核实', t => {
  const root = fixture(t);
  trellisSetup(root);
  const report = diagnoseProject(root, { run: probes({ trellis: true, python: true }).run,
    discoverWorkflows: () => ({ current: '.trellis/workflow.md', candidates: [{ path: '.trellis/workflow.md', selected: true, ready: false }], selection_mismatch: true, warnings: ['PRIVATE_ERROR_NOT_OUTPUT'] }) });
  assert.equal(check(report, 'agent.platform').status, 'unknown');
  assert.deepEqual(check(report, 'agent.platform').evidence.discovered, ['codex']);
  assert.equal(check(report, 'trellis.workflows').status, 'unknown');
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_ERROR_NOT_OUTPUT/);
});

test('合同损坏、结构不全和旧静态映射均可诊断而不写文件', t => {
  const root = fixture(t);
  for (const value of ['{broken', 'null', 'false', '0', '[]', JSON.stringify({ schema_version: 1 }), JSON.stringify({ ...contract(), routing: { by_type: { bug: 'fixed' } } })]) {
    write(root, '.github/issue-management.json', value);
    const before = snapshot(root);
    const report = diagnoseProject(root, { workflow: 'existing', run: probes().run });
    assert.equal(check(report, 'issue.contract').status, 'warn');
    assert.equal(report.status, 'needs_setup');
    assert.deepEqual(snapshot(root), before);
  }
});

test('仓库身份字段类型错误返回待补齐诊断，不隐式转换或回显损坏内容', t => {
  const root = fixture(t);
  for (const field of ['host', 'full_name']) {
    const validString = field === 'host' ? 'github.com' : 'example/project';
    for (const value of [[validString], ['PRIVATE_VALUE'], { secret: 'PRIVATE_VALUE' }, 123, false, null]) {
      const configured = contract();
      configured.repository[field] = value;
      write(root, '.github/issue-management.json', configured);
      const before = snapshot(root);
      const report = diagnoseProject(root, { workflow: 'existing', run: probes().run });
      assert.equal(report.status, 'needs_setup');
      assert.equal(check(report, 'issue.contract').status, 'warn');
      assert.ok(check(report, 'issue.contract').evidence.invalid_fields.includes('repository'));
      assert.equal(check(report, 'issue.repository').status, 'missing');
      assert.doesNotMatch(JSON.stringify(report), /PRIVATE_VALUE/);
      assert.deepEqual(snapshot(root), before);
    }
  }
});

test('带凭据origin只输出规范仓库，不回显凭据或本地身份', t => {
  const root = fixture(t), probe = probes({ git: true, origin: 'https://PRIVATE_USER:PRIVATE_TOKEN@github.com/example/project.git' });
  localSetup(root);
  const report = diagnoseProject(root, { workflow: 'existing', run: probe.run });
  assert.deepEqual(check(report, 'issue.repository').evidence, { host: 'github.com', full_name: 'example/project' });
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_USER|PRIVATE_TOKEN|PRIVATE_IDENTITY|https:\/\//);
});

test('仓库冲突阻止远端API，不把合同旧身份当成功', t => {
  const root = fixture(t), probe = probes({ git: true, gh: true, origin: 'https://github.com/other/project.git' });
  localSetup(root);
  const report = diagnoseProject(root, { remote: true, run: probe.run });
  assert.equal(check(report, 'issue.repository').status, 'warn');
  assert.equal(check(report, 'github.access').status, 'unknown');
  assert.equal(probe.calls.filter(call => call.command === 'gh' && call.args[0] === 'api').length, 0);
});

test('远端分页核对标签缺项，未知写权限和Type不被当作通过', t => {
  const root = fixture(t), probe = probes({ gh: true, pages: [[{ name: '其他标签' }], [{ name: '模块:业务' }]] });
  localSetup(root);
  const before = snapshot(root);
  const report = diagnoseProject(root, { workflow: 'existing', remote: true, run: probe.run });
  assert.equal(check(report, 'github.access').status, 'pass');
  assert.equal(check(report, 'github.labels').status, 'missing');
  assert.deepEqual(check(report, 'github.labels').evidence.missing, ['阶段:待分诊']);
  assert.equal(check(report, 'github.types_fields').status, 'unknown');
  assert.equal(report.readiness.github, 'needs_setup');
  assert.equal(report.readiness.local, 'needs_verification');
  assert.equal(report.complete, false);
  assert.ok(probe.calls.some(call => call.command === 'gh' && call.args.includes('--paginate') && call.args.includes('--slurp')));
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_BODY|PRIVATE_TOKEN/);
  assert.deepEqual(snapshot(root), before);
});

test('完整分页中第二页存在的标签不被误报缺失，企业host不丢失', t => {
  const root = fixture(t), probe = probes({ gh: true, pages: [[{ name: '其他标签' }], [{ name: '阶段:待分诊' }]] });
  const configured = contract();
  configured.repository.host = 'github.example.org';
  localSetup(root);
  write(root, '.github/issue-management.json', configured);
  const report = diagnoseProject(root, { workflow: 'existing', remote: true, run: probe.run });
  assert.equal(check(report, 'github.labels').status, 'pass');
  assert.equal(report.status, 'needs_verification');
  assert.equal(report.complete, false);
  assert.ok(probe.calls.filter(call => call.command === 'gh' && call.args[0] === 'api').every(call => call.args.includes('github.example.org')));
});

test('权限不足与畸形分页不产生空标签成功，错误载荷不会泄漏', t => {
  const root = fixture(t);
  localSetup(root);
  for (const options of [{ accessDenied: true }, { labelsDenied: true }, { pages: [{ name: '阶段:待分诊' }] }]) {
    const probe = probes({ gh: true, ...options });
    const report = diagnoseProject(root, { remote: true, run: probe.run });
    assert.ok(check(report, 'github.access').status === 'unknown' || check(report, 'github.labels').status === 'unknown');
    assert.equal(report.complete, false);
    assert.doesNotMatch(JSON.stringify(report), /PRIVATE_TOKEN/);
  }
});

test('缺少gh允许用连接器核实，不把gh缺失列为硬安装要求', t => {
  const root = fixture(t);
  localSetup(root);
  const report = diagnoseProject(root, { workflow: 'existing', remote: true, run: probes().run });
  assert.equal(check(report, 'github.transport').required, false);
  assert.match(check(report, 'github.transport').evidence, /连接器可作为替代/);
  assert.equal(check(report, 'github.access').status, 'unknown');
});

test('CLI空目录有效报告退出0，非法参数或root退出非0', t => {
  const root = fixture(t);
  const script = fileURLToPath(new URL('./issue-tools.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, 'doctor', '--root', root, '--workflow', 'existing'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).read_only, true);
  assert.equal(JSON.parse(result.stdout).status, 'needs_setup');
  assert.deepEqual(snapshot(root), {});
  for (const args of [['--workflow', 'wrong'], ['--workflow'], ['--platform'], ['--platform', 'unknown'], ['--surprise'], ['--root', path.join(root, 'absent')]]) {
    const bad = spawnSync(process.execPath, [script, 'doctor', '--root', root, ...args], { encoding: 'utf8', timeout: 30000 });
    assert.notEqual(bad.status, 0);
  }
});

test('真实Git仓库的诊断不会刷新索引或修改任何项目文件', t => {
  const root = fixture(t);
  const git = args => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  if (git(['init', '--quiet']).status !== 0) { t.skip('本机缺少 Git，真实只读索引用例不伪造通过'); return; }
  write(root, 'tracked.txt', '本轮临时仓库文件\n');
  assert.equal(git(['add', '--', 'tracked.txt']).status, 0);
  // 变更文件时间使普通 git status 可能尝试刷新缓存，诊断必须关闭可选锁。
  const changed = new Date(Date.now() + 2000);
  fs.utimesSync(path.join(root, 'tracked.txt'), changed, changed);
  const before = snapshot(root);
  const script = fileURLToPath(new URL('./issue-tools.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, 'doctor', '--root', root, '--workflow', 'existing'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(snapshot(root), before);
});
