// 仅做本地发现、关联和可审核接入，不创建任务，不调用 GitHub 写接口。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { discoverWorkflows, inside, relative, walkFiles } from '../../trellis-setup/scripts/workflow-tools.mjs';
export { discoverWorkflows, listWorkflowTemplates, summarizeWorkflow } from '../../trellis-setup/scripts/workflow-tools.mjs';
import { diagnoseProject } from './issue-doctor.mjs';

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '') : null;
const json = file => { const text = read(file); return text === null ? null : JSON.parse(text); };
export function parseIssue(input, repository) {
  const value = String(input || '').trim();
  let host, fullName, number;
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    if (url.username || url.password || url.port) throw new Error('Issue URL 不得包含凭据或自定义端口');
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/issues\/([1-9]\d*)\/?$/);
    if (!match) throw new Error('需要明确的 Issue URL，不能把 PR 或普通网页当成 Issue');
    [, , , number] = match;
    host = url.hostname;
    fullName = `${match[1]}/${match[2]}`;
  } else {
    const match = value.match(/^(?:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+))?#([1-9]\d*)$/);
    if (!match) throw new Error('仅接受独立 #编号、owner/repo#编号或 Issue URL');
    fullName = match[1] || repository?.full_name;
    host = repository?.host;
    number = match[2];
  }
  if (!host || !/^[A-Za-z0-9.-]+$/.test(host) || !fullName || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)
      || fullName.split('/').some(p => ['.', '..'].includes(p)) || !Number.isSafeInteger(Number(number))) {
    throw new Error('Issue 仓库或编号无法唯一确定');
  }
  host = host.toLowerCase();
  fullName = fullName.toLowerCase();
  return { host, full_name: fullName, number: String(Number(number)), url: `https://${host}/${fullName}/issues/${Number(number)}` };
}

export function issueFromMeta(meta) {
  if (meta?.source_kind !== 'github_issue') return null;
  try {
    const issue = parseIssue(meta.github_issue_url);
    return issue.full_name === String(meta.github_repo).toLowerCase()
      && issue.number === String(meta.github_issue) ? issue : null;
  } catch { return null; }
}
const sameIssue = (a, b) => Boolean(a && b && a.host === b.host && a.full_name === b.full_name && a.number === b.number);

function repositoryFor(root, contract) {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8', windowsHide: true });
  const match = r.stdout?.trim().match(/^(?:https?:\/\/|ssh:\/\/git@|git@)([^/:]+)[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/);
  const actual = match ? { host: match[1].toLowerCase(), full_name: match[2].toLowerCase() } : null;
  if (contract?.repository) {
    const declared = parseIssue('#1', contract.repository);
    if (actual && (declared.host !== actual.host || declared.full_name !== actual.full_name)) throw new Error('合同仓库与当前 origin 不一致，先核实目标项目');
    return { host: declared.host, full_name: declared.full_name };
  }
  return actual;
}

export function findTasks(root, issue, { warnings = [] } = {}) {
  return walkFiles(path.join(root, '.trellis/tasks'), n => n === 'task.json', (file, reason) => warnings.push(`${relative(root, file)}: ${reason}`)).flatMap(file => {
    try {
      const task = json(file);
      const source = issueFromMeta(task?.meta);
      if (task?.meta?.source_kind === 'github_issue' && !source) warnings.push(`${relative(root, file)}: 来源字段缺失或不一致`);
      if (!sameIssue(source, issue)) return [];
      return [{ path: relative(root, path.dirname(file)), id: task.id, status: task.status, workflow: task.workflow || null, parent: task.parent || null, children: task.children || [], branch: task.branch || null, pr_url: task.pr_url || null, archived: relative(root, file).startsWith('.trellis/tasks/archive/'), evidence_required: true, artifacts: ['prd.md', 'design.md', 'implement.md', 'check.jsonl'].filter(n => fs.existsSync(path.join(path.dirname(file), n))) }];
    } catch { warnings.push(`${relative(root, file)}: 任务记录不可读`); return []; }
  });
}

export function activeTaskGuard(root, activeTask, issue) {
  if (!activeTask) return { kind: 'no-task', may_implement: false, next: '前置处理后展示实时流程选择；不得自动建任务' };
  const file = inside(root, path.join(activeTask, 'task.json'));
  const task = json(file);
  const source = issueFromMeta(task?.meta);
  if (sameIssue(source, issue)) return { kind: 'same-source', may_implement: false, next: '核验原合同后推荐继续；实施仍受原批准范围约束' };
  return { kind: source ? 'different-source' : 'source-unconfirmed', may_implement: false, next: '只做前置处理；独立事项建议 worktree 隔离，真实子项需批准并维护两侧关系，不替换当前指针' };
}

export function inspectProject(root, input, options = {}) {
  root = fs.realpathSync(root);
  const contract = json(path.join(root, '.github/issue-management.json'));
  const repository = repositoryFor(root, contract);
  const issue = parseIssue(input, repository);
  const foreign = repository && (issue.host !== repository.host?.toLowerCase() || issue.full_name !== repository.full_name?.toLowerCase());
  if (foreign) return { issue, project_mismatch: true, tasks: [], workflows: null, next: '先定位 URL 对应的真实项目，不套用当前项目合同或授权' };
  if (options.task) {
    const declared = issueFromMeta(json(path.join(inside(root, options.task), 'task.json'))?.meta);
    if (!sameIssue(declared, issue)) throw new Error('指定任务的来源未能与 Issue 对应，先核实关联');
  }
  const workflows = discoverWorkflows(root, options);
  const taskWarnings = [];
  const tasks = findTasks(root, issue, { warnings: taskWarnings });
  return { issue, repository, project_mismatch: false, tasks, task_lookup_complete: taskWarnings.length === 0, task_scan_warnings: taskWarnings, activeTaskGuard: activeTaskGuard(root, workflows.active_task, issue), workflows, contract_present: Boolean(contract), stage_inference: '需要读取实际流程与本轮证据，工具不按 status 自动判定或写标签' };
}

export function labelsForKind(contract, kind) {
  const stage = contract?.labels?.stage?.triage;
  if (typeof stage !== 'string' || !stage.trim()) throw new Error('合同缺少 labels.stage.triage');
  const kinds = contract?.labels?.kind?.[kind] || [];
  if (!Array.isArray(kinds) || kinds.some(x => typeof x !== 'string' || !x.trim())) throw new Error('类型兼容标签必须是非空字符串数组');
  return [...new Set([...kinds, stage])];
}

const ENTRY = 'Issue 前置处理优先于通用建任务询问：收到明确 #编号、Issue 链接或前置请求时，先用 issue-triage 核实来源及关联任务，动态发现 workflow，只读首个一级标题导语与首个二级章节，按授权同步有据标签，展示清单与推荐。没有任务时，用户选择采用流程并创建 Task 进入规划可合并批准；未选择不建任务。已有独立活动任务时建议 worktree 隔离；真实子项经批准才维护两侧关系，不抢切会话指针。前置处理不自动授权实施。';
const GUARD = '收到新的 Issue 先核对当前 Task 来源：异源只做获准前置处理，独立事项建议 worktree，真实子项需批准，不自动切换、创建或实施；同源沿原合同。';

function managed(name, content) { return `<!-- ${name}:START -->\n<!-- managed-sha256:${digest(content)} -->\n${content}\n<!-- ${name}:END -->`; }
function upsert(text, name, content, prepend = false) {
  const start = `<!-- ${name}:START -->`, end = `<!-- ${name}:END -->`;
  const a = text.indexOf(start), b = text.indexOf(end);
  if ((a < 0) !== (b < 0) || (a >= 0 && (b < a || text.indexOf(start, a + start.length) >= 0))) throw new Error(`${name} 受管边界冲突`);
  const block = managed(name, content);
  if (a < 0) return prepend ? `${block}\n${text}` : `${text.trimEnd()}\n\n${block}\n`;
  const old = text.slice(a + start.length, b).trim().replace(/\r\n/g, '\n');
  const check = old.match(/^<!-- managed-sha256:([a-f0-9]{64}) -->\n([\s\S]*)$/);
  if (!check || digest(check[2]) !== check[1]) throw new Error(`${name} 已被手工修改，停止覆盖`);
  // 内容相同时保留原字节，包括 Git 在 Windows 检出时采用的 CRLF。
  if (check[2] === content) return text;
  return text.slice(0, a) + block + text.slice(b + end.length);
}
const merge = (a, b) => { const result = { ...a }; for (const [k, v] of Object.entries(b)) result[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a?.[k] || {}, v) : v; return result; };

export function planInitialization(root, contract) {
  root = fs.realpathSync(root);
  if (contract?.schema_version !== 1 || contract.provider !== 'github') throw new Error('仅接受 schema_version=1 的 GitHub 合同');
  parseIssue('#1', contract.repository);
  repositoryFor(root, contract);
  labelsForKind(contract, 'other');
  if (contract.routing?.by_type || contract.workflow?.candidates) throw new Error('不能把当前 workflow 名单或 Type-ID 固定表写进合同');
  const changes = [];
  const add = (file, after) => {
    const full = inside(root, file), before = read(full);
    if (before !== after) changes.push({ path: file, before_sha256: before === null ? null : digest(before), after });
  };
  const existing = json(path.join(root, '.github/issue-management.json')) || {};
  const mergedContract = merge(existing, contract);
  if (mergedContract.routing?.by_type || mergedContract.workflow?.candidates) throw new Error('已有合同仍含 workflow 固定表；先明确旧字段的迁移差异并取得批准，不能静默保留');
  add('.github/issue-management.json', `${JSON.stringify(mergedContract, null, 2)}\n`);
  add('AGENTS.md', upsert(read(path.join(root, 'AGENTS.md')) || '', 'ISSUE-MANAGEMENT', `## Issue 管理\n读取 .github/issue-management.json。${ENTRY}\n后续创建任务沿用已批准动作；当前请求更窄的限制优先。`));
  const workflows = discoverWorkflows(root, { resolveNative: () => ({}) });
  for (const candidate of workflows.candidates) {
    const file = inside(root, candidate.path), text = read(file);
    const seen = new Set();
    let after = text.replace(/(\[workflow-state:([A-Za-z0-9_-]+)\]\s*\n)([\s\S]*?)(\n\s*\[\/workflow-state:\2\])/g, (all, open, status, body, close) => {
      if (seen.has(status)) throw new Error(`重复状态块：${candidate.path} ${status}`);
      seen.add(status);
      return open + upsert(body, 'ISSUE-ENTRY', status === 'no_task' ? ENTRY : GUARD, true) + close;
    });
    if (!seen.has('no_task')) after = `${after.trimEnd()}\n\n[workflow-state:no_task]\n${managed('ISSUE-ENTRY', ENTRY)}\n[/workflow-state:no_task]\n`;
    add(candidate.path, after);
  }
  return { schema_version: 1, root, adapter: workflows.adapter, changes };
}

export function applyInitialization(root, plan, approved = false) {
  root = fs.realpathSync(root);
  if (!approved) throw new Error('应用本地接入前必须取得具体差异批准');
  if (plan.root !== root || plan.schema_version !== 1 || !Array.isArray(plan.changes)) throw new Error('计划不属于当前项目');
  const checked = [];
  for (const change of plan.changes) {
    if (!/^(AGENTS\.md|\.github\/issue-management\.json|\.trellis\/workflow\.md|\.trellis\/workflows\/[A-Za-z0-9_-]+\.md)$/.test(change.path) || typeof change.after !== 'string') throw new Error('计划包含非接入文件');
    const file = inside(root, change.path), before = read(file);
    const current = before === null ? null : digest(before);
    if (current !== change.before_sha256 && before !== change.after) throw new Error(`文件已变化，停止应用：${change.path}`);
    checked.push({ ...change, file, unchanged: before === change.after });
  }
  const written = [];
  try {
    for (const item of checked) {
      if (item.unchanged) continue;
      fs.mkdirSync(path.dirname(item.file), { recursive: true });
      fs.writeFileSync(item.file, item.after, 'utf8');
      written.push(item.path);
    }
  } catch (error) { throw new Error(`接入部分完成，已写 ${JSON.stringify(written)}；复读后恢复，不整批重放：${error.message}`); }
  return { written, unchanged: checked.filter(x => x.unchanged).map(x => x.path), remote_writes: false };
}

function argumentsFor(argv) {
  const [command, ...args] = argv, flags = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!key.startsWith('--')) throw new Error(`未知参数：${key}`);
    if (['--approved', '--no-templates', '--remote'].includes(key)) flags[key.slice(2)] = true;
    else {
      if (i + 1 >= args.length || args[i + 1].startsWith('--')) throw new Error(`参数缺少值：${key}`);
      flags[key.slice(2)] = args[++i];
    }
  }
  return { command, flags };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { command, flags } = argumentsFor(process.argv.slice(2));
    if (!flags.root) throw new Error('必须显式提供 --root 目标项目，不能从技能安装目录猜测');
    let result;
    if (command === 'doctor') {
      const allowed = new Set(['root', 'workflow', 'platform', 'remote']);
      if (Object.keys(flags).some(key => !allowed.has(key))) throw new Error('doctor 包含未知参数');
      result = diagnoseProject(flags.root, { workflow: flags.workflow, platform: flags.platform, remote: flags.remote === true, discoverWorkflows });
    }
    else if (command === 'inspect') result = inspectProject(flags.root, flags.issue, { task: flags.task, templates: !flags['no-templates'] });
    else if (command === 'plan-init') result = planInitialization(flags.root, json(flags.contract));
    else if (command === 'apply-init') result = applyInitialization(flags.root, json(flags.plan), flags.approved === true);
    else throw new Error('命令：doctor、inspect、plan-init、apply-init；详见 references/local-tools.md');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; }
}
