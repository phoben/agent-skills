// 只读诊断目标项目；安装、登录、规则写入及远端变更由主会话按批准范围执行。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const validRepo = value => object(value) && typeof value.host === 'string' && typeof value.full_name === 'string'
  && /^[A-Za-z0-9.-]+$/.test(value.host)
  && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.full_name)
  && value.full_name.split('/').every(part => !['.', '..'].includes(part));
const sameRepo = (a, b) => a && b && a.host.toLowerCase() === b.host.toLowerCase()
  && a.full_name.toLowerCase() === b.full_name.toLowerCase();

function execute(command, args, root) {
  return spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true,
    timeout: 5000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GH_PROMPT_DISABLED: '1' } });
}

function safeFile(root, relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) return { state: 'missing' };
  try {
    const real = fs.realpathSync(file), rel = path.relative(root, real);
    if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel) || !fs.statSync(real).isFile()) return { state: 'unreadable' };
    return { state: 'present', text: fs.readFileSync(real, 'utf8').replace(/^\uFEFF/, '') };
  } catch { return { state: 'unreadable' }; }
}

function readJson(root, relative) {
  const file = safeFile(root, relative);
  if (file.state !== 'present') return file;
  try { return { state: 'present', value: JSON.parse(file.text) }; }
  catch { return { state: 'invalid' }; }
}

function remoteRepository(text) {
  try {
    const raw = String(text || '').trim();
    const scp = raw.match(/^(?:[^@\s]+@)([A-Za-z0-9.-]+):([^\s]+)$/);
    const url = scp ? null : new URL(raw);
    if (url && !['https:', 'http:', 'ssh:'].includes(url.protocol)) return null;
    const host = scp ? scp[1] : url.hostname;
    const full_name = (scp ? scp[2] : url.pathname.replace(/^\//, '')).replace(/\.git\/?$/, '').replace(/\/$/, '');
    return validRepo({ host, full_name }) ? { host: host.toLowerCase(), full_name: full_name.toLowerCase() } : null;
  } catch { return null; }
}

function contractIssues(contract) {
  const issues = [];
  if (!object(contract) || contract.schema_version !== 1 || contract.provider !== 'github') issues.push('schema_version/provider');
  if (!validRepo(contract?.repository)) issues.push('repository');
  if (contract?.workflow?.discovery !== 'runtime' || contract?.workflow?.summary !== 'first-h1-and-h2') issues.push('workflow');
  if (contract?.routing?.by_type || contract?.workflow?.candidates) issues.push('静态 workflow 映射');
  if (!object(contract?.labels?.stage) || typeof contract.labels.stage.triage !== 'string' || !contract.labels.stage.triage.trim()) issues.push('labels.stage.triage');
  if (!object(contract?.authority) || !contract.authority.labels) issues.push('authority.labels');
  const inspectLabels = value => {
    if (typeof value === 'string' && value.trim()) return true;
    if (Array.isArray(value)) return value.every(item => typeof item === 'string' && item.trim());
    return object(value) && Object.values(value).every(inspectLabels);
  };
  if (!object(contract?.labels) || !inspectLabels(contract.labels)) issues.push('labels');
  return issues;
}

function expectedLabels(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(expectedLabels);
  return object(value) ? Object.values(value).flatMap(expectedLabels) : [];
}

function hookRegistration(root, platform) {
  const location = platform === 'codex' ? '.codex/hooks.json' : '.claude/settings.json';
  const config = readJson(root, location);
  if (config.state !== 'present') return { status: config.state === 'missing' ? 'missing' : 'warn', evidence: `项目 hook 配置${config.state === 'missing' ? '缺失' : '不可解析'}` };
  const entries = config.value?.hooks?.UserPromptSubmit;
  if (!Array.isArray(entries)) return { status: 'missing', evidence: '未注册 UserPromptSubmit' };
  const hooks = entries.flatMap(entry => Array.isArray(entry?.hooks) ? entry.hooks : []);
  const commands = hooks.filter(hook => hook?.type === 'command').map(hook => process.platform === 'win32' && hook.commandWindows ? hook.commandWindows : hook.command);
  const workflowCommands = commands.filter(command => typeof command === 'string' && /inject-workflow-state\.(?:py|[cm]?js)/.test(command));
  if (!workflowCommands.length) return { status: 'missing', evidence: 'UserPromptSubmit 未注册 Trellis workflow 状态注入' };
  for (const command of workflowCommands) {
    const relative = command.match(/(?:\.codex|\.claude)[/\\]hooks[/\\][A-Za-z0-9_.-]+\.(?:py|[cm]?js)/)?.[0]?.replaceAll('\\', '/');
    if (!relative) return { status: 'unknown', evidence: '存在状态注入注册，命令引用位置需要人工核实' };
    if (safeFile(root, relative).state !== 'present') return { status: 'missing', evidence: '状态注入已注册，但所引用的项目脚本缺失或不可读' };
  }
  return { status: 'pass', evidence: '状态注入注册及所引用的项目脚本存在；未执行 hook' };
}

function toolProbe(command, root, run) {
  const result = run(command, ['--version'], root);
  return result.status === 0 ? { available: true, version: `${result.stdout || ''} ${result.stderr || ''}`.match(/\d+\.\d+(?:\.\d+)?/)?.[0] || null } : { available: false };
}

function trellisProbe(root, run) {
  const direct = toolProbe('trellis', root, run);
  if (direct.available || process.platform !== 'win32') return direct;
  // 复用已有安装布局的正式 Node 入口，避免用 shell 执行 npm shim。
  const found = run('where.exe', ['trellis'], root);
  const first = found.status === 0 && String(found.stdout || '').trim().split(/\r?\n/)[0];
  if (!first) return direct;
  const entry = path.join(path.dirname(first), 'node_modules/@mindfoldhq/trellis/bin/trellis.js');
  if (!fs.existsSync(entry)) return direct;
  const result = run(process.execPath, [entry, '--version'], root);
  return result.status === 0 ? { available: true, version: String(result.stdout || '').match(/\d+\.\d+(?:\.\d+)?/)?.[0] || null } : direct;
}

export function diagnoseProject(projectRoot, options = {}) {
  const workflowMode = options.workflow ?? 'auto';
  if (!['auto', 'existing', 'trellis'].includes(workflowMode)) throw new Error('workflow 仅支持 auto、existing 或 trellis');
  if (options.platform !== undefined && !['codex', 'claude'].includes(options.platform)) throw new Error('platform 仅支持 codex 或 claude');
  let root;
  try { root = fs.realpathSync(projectRoot); if (!fs.statSync(root).isDirectory()) throw new Error(); }
  catch { throw new Error('目标项目目录不存在或不可读'); }
  const run = options.run || execute;
  const checks = [];
  const add = (id, status, required, evidence, action, approval = false) => {
    const item = { id, status, required, evidence };
    if (action) Object.assign(item, { action, approval_required: approval });
    checks.push(item);
    return item;
  };
  add('project.directory', 'pass', true, '目标目录可读，诊断仅读取指定项目');
  add('tools.node', 'pass', true, `当前运行 Node ${process.versions.node}`);

  const git = toolProbe('git', root, run);
  add('tools.git', git.available ? 'pass' : 'missing', false, git.available ? `Git ${git.version || '可执行'}` : '本机 Git 不可用', '需要本地版本管理时安装 Git', true);
  let origin = null;
  if (git.available) {
    const repository = run('git', ['rev-parse', '--show-toplevel'], root);
    add('git.repository', repository.status === 0 ? 'pass' : 'missing', false, repository.status === 0 ? '当前目录属于 Git 工作区' : '当前目录尚未建立 Git 仓库', repository.status === 0 ? undefined : '先确认需要新建仓库还是关联已有仓库', true);
    if (repository.status === 0) {
      const status = run('git', ['status', '--porcelain'], root);
      add('git.worktree', status.status === 0 ? (String(status.stdout || '').trim() ? 'warn' : 'pass') : 'unknown', false,
        status.status === 0 ? (String(status.stdout || '').trim() ? '工作区存在未提交修改，后续写入须保留并核对归属' : '工作区干净') : '工作区状态本轮不可核实');
      const identityName = run('git', ['config', 'user.name'], root), identityEmail = run('git', ['config', 'user.email'], root);
      add('git.identity', identityName.status === 0 && identityEmail.status === 0 ? 'pass' : 'unknown', false, identityName.status === 0 && identityEmail.status === 0 ? '本地提交身份已配置，未输出身份值' : '提交身份尚待配置或核实；前置规划不要求提交');
      const remote = run('git', ['remote', 'get-url', 'origin'], root);
      origin = remote.status === 0 ? remoteRepository(remote.stdout) : null;
      add('git.origin', origin ? 'pass' : 'unknown', false, origin ? '已识别 origin 的主机及仓库，未输出原始 URL' : '未能从 origin 唯一识别托管仓库', origin ? undefined : '确认目标 GitHub 仓库；不要将其他远端当作 tracker');
    }
  }

  const documentPaths = ['AGENTS.md', 'CONTRIBUTING.md', 'README.md', 'docs/workflow.md'].filter(file => safeFile(root, file).state === 'present');
  const agents = safeFile(root, 'AGENTS.md');
  add('project.agents', agents.state === 'present' ? 'pass' : 'missing', true, agents.state === 'present' ? '项目 AGENTS 可读' : '项目 AGENTS 缺失或不可读', agents.state === 'present' ? undefined : '调研后按批准差异补充精简 Issue 入口', true);
  add('workflow.sources', documentPaths.length ? 'pass' : 'missing', true, documentPaths.length ? { candidates: documentPaths, meaning: '仅证明资料存在，适用流程和门禁需阅读确认' } : '未发现常见流程资料入口', documentPaths.length ? '阅读候选，确认真实流程；不能把文件存在当作规则完整' : '通过业务场景确认开发、批准、验收与交付的最小规则');

  const stored = readJson(root, '.github/issue-management.json');
  const contract = stored.state === 'present' ? stored.value : null;
  const issues = stored.state === 'present' ? contractIssues(contract) : [];
  add('issue.contract', stored.state === 'missing' ? 'missing' : stored.state !== 'present' || issues.length ? 'warn' : 'pass', true,
    stored.state === 'missing' ? '尚无项目 Issue 管理合同' : stored.state !== 'present' ? '项目合同不可读取或 JSON 损坏' : issues.length ? { invalid_fields: issues } : '必要结构、动态发现方式、标签和授权字段有效',
    stored.state !== 'present' || issues.length ? '调研真实需求和现有远端对象，先展示合同差异，批准后接入' : undefined, true);
  const declared = validRepo(contract?.repository) ? { host: contract.repository.host.toLowerCase(), full_name: contract.repository.full_name.toLowerCase() } : null;
  const conflict = Boolean(origin && declared && !sameRepo(origin, declared));
  const repository = declared || origin;
  add('issue.repository', conflict ? 'warn' : repository ? 'pass' : 'missing', true,
    conflict ? '项目合同与 origin 仓库冲突，未选择任何远端执行查询' : repository || '尚未确定 GitHub 主机和仓库',
    conflict || !repository ? '核对 Issue tracker 和目标项目，确认后更正；不自动覆盖 Git 配置' : undefined, true);
  const entry = agents.state === 'present' && agents.text.match(/<!-- ISSUE-MANAGEMENT:START -->\s*<!-- managed-sha256:([a-f0-9]{64}) -->\r?\n([\s\S]*?)\r?\n<!-- ISSUE-MANAGEMENT:END -->/);
  const entryValid = entry && crypto.createHash('sha256').update(entry[2].replace(/\r\n/g, '\n')).digest('hex') === entry[1];
  add('issue.entry', entryValid ? 'pass' : 'unknown', true, entryValid ? 'Issue 受管入口哈希有效；实际 Agent 分流仍需冷启动验收' : '未发现可验证的受管入口，既有自定义规则需人工核对', entryValid ? undefined : '检查已有规则并展示入口差异，不覆盖用户内容', true);

  const trellisDirectory = fs.existsSync(path.join(root, '.trellis'));
  const selected = workflowMode === 'trellis' ? 'trellis' : workflowMode === 'existing' ? 'existing' : trellisDirectory ? 'trellis' : documentPaths.length ? 'existing' : null;
  const useTrellis = selected === 'trellis';
  if (selected === 'existing') add('workflow.rules', 'unknown', true, '已有资料仅为候选，开发、批准、验收和交付规则尚未完成业务核验', '阅读实际规则并通过必要问答补齐最小流程；由主会话验证适用性，不凭文件齐全标记就绪');
  const cli = trellisProbe(root, run);
  add('tools.trellis', cli.available ? 'pass' : 'missing', useTrellis, cli.available ? `Trellis CLI ${cli.version || '可执行'}` : '本机 Trellis CLI 不可用', cli.available || selected === 'existing' ? undefined : '仅在用户选择 Trellis 后，核实官方安装方法并按批准范围安装', true);
  let trellisState = !trellisDirectory ? (cli.available ? 'project_uninitialized' : 'not_installed') : 'incomplete';
  const core = ['.trellis/workflow.md', '.trellis/scripts/common/workflow_selection.py', '.trellis/scripts/common/active_task.py', '.trellis/scripts/task.py', '.trellis/scripts/get_context.py'];
  const missingCore = trellisDirectory ? core.filter(file => safeFile(root, file).state !== 'present') : core;
  if (trellisDirectory && !missingCore.length) trellisState = 'project_available';
  add('trellis.project', trellisState === 'project_available' ? 'pass' : useTrellis ? 'missing' : 'not_applicable', useTrellis,
    { state: trellisState, ...(trellisDirectory ? { missing_files: missingCore } : {}) },
    useTrellis && missingCore.length ? '选择实际平台并核对官方 init/update 帮助；批准后补齐安装，保留已有项目文件，不手改内置脚本或哈希' : undefined, true);
  if (!selected) add('workflow.selection', 'unknown', true, '尚未确定现有流程或 Trellis 路径', '用项目业务场景选择复用现有流程或接入 Trellis；auto 不会自动安装');
  if (useTrellis) {
    const python = toolProbe('python', root, run);
    add('tools.python', python.available ? 'pass' : 'missing', true, python.available ? `Python ${python.version || '可执行'}` : '原生解析所需 Python 命令不可用', python.available ? undefined : '核实本机 Python 与原生 Trellis 调用要求，按批准范围补齐', true);
    const skills = ['trellis-start', 'trellis-continue'].filter(name => safeFile(root, `.agents/skills/${name}/SKILL.md`).state === 'present');
    add('trellis.skills', skills.length === 2 ? 'pass' : 'missing', true, { available: skills, required: ['trellis-start', 'trellis-continue'] }, skills.length === 2 ? undefined : '通过官方平台初始化／更新补齐原生技能，不复制其他项目定制内容', true);
    const platforms = options.platform ? [options.platform] : ['codex', 'claude'].filter(name => fs.existsSync(path.join(root, `.${name}`)));
    if (!options.platform) add('agent.platform', 'unknown', true, { discovered: platforms, meaning: '目录只表示候选，不能证明当前会话平台已选定' }, '确认实际使用平台后带 --platform 复检；不推测用户级开关或信任状态');
    for (const platform of platforms) {
      const hook = hookRegistration(root, platform);
      add(`agent.${platform}.registration`, hook.status, Boolean(options.platform), hook.evidence, hook.status === 'pass' ? undefined : '核实官方平台接入和缺失文件；不执行未信任 hook，不手改 native 文件', true);
      add(`agent.${platform}.activation`, 'unknown', Boolean(options.platform), '注册不等于当前宿主启用、信任或实际触发；本工具未读取用户凭据或改信任配置', '在当前平台核实开关与信任，并用新会话验证注入和 Issue 前置入口');
    }
    if (!missingCore.length && python.available && options.discoverWorkflows) {
      try {
        const workflows = options.discoverWorkflows(root, { templates: false });
        const usable = Boolean(workflows.current && workflows.candidates?.some(item => item.selected && item.ready) && !workflows.selection_mismatch);
        add('trellis.workflows', usable ? 'pass' : 'unknown', true, { current: workflows.current || null, candidates: (workflows.candidates || []).map(item => ({ path: item.path, id: item.id, selected: item.selected, ready: item.ready })), warning_count: workflows.warnings?.length || 0 }, usable ? undefined : '核实原生选择和缺失变体；不把回落当原选择成功');
      } catch { add('trellis.workflows', 'unknown', true, '原生 workflow 解析本轮未完成，未猜测默认', '核对原生环境和真实候选后重试'); }
    } else add('trellis.workflows', 'unknown', true, '缺少原生解析前提，本轮未执行项目解析器', '先补齐已确认的原生依赖再重新发现流程');
  }

  let github = 'not_checked';
  if (options.remote) {
    const gh = toolProbe('gh', root, run);
    add('github.transport', gh.available ? 'pass' : 'unknown', false, gh.available ? '已存在 gh CLI；未获取或输出 token' : 'gh CLI 不可用，但当前平台连接器可作为替代，需主会话核实', gh.available ? undefined : '使用实际可用连接器核实仓库读取与管理能力，不强制安装 gh');
    if (gh.available && repository && !conflict) {
      const args = ['api', '--hostname', repository.host, `repos/${repository.full_name}`];
      const access = run('gh', args, root);
      let data;
      try { data = access.status === 0 ? JSON.parse(access.stdout) : null; } catch { data = null; }
      const verified = data && data.full_name?.toLowerCase() === repository.full_name && data.has_issues === true;
      add('github.access', verified ? 'pass' : 'unknown', true, verified ? '目标仓库可读且启用 Issues' : '远端不可访问、身份不匹配或未启用 Issues；未输出原始响应', verified ? undefined : '由用户核实账号、访问权限和仓库设置；登录在官方交互入口完成', true);
      github = verified ? 'readable' : 'needs_verification';
      if (verified) {
        const labels = run('gh', ['api', '--hostname', repository.host, '--paginate', '--slurp', `repos/${repository.full_name}/labels?per_page=100`], root);
        let pages;
        try { pages = labels.status === 0 ? JSON.parse(labels.stdout) : null; } catch { pages = null; }
        const valid = Array.isArray(pages) && pages.every(page => Array.isArray(page) && page.every(label => typeof label?.name === 'string'));
        const names = new Set(valid ? pages.flat().map(label => label.name) : []);
        const missing = valid ? [...new Set(expectedLabels(contract?.labels))].filter(label => !names.has(label)) : [];
        add('github.labels', !valid ? 'unknown' : missing.length ? 'missing' : contract && !issues.length ? 'pass' : 'unknown', true,
          valid ? { actual_count: names.size, missing } : '标签分页未能完整读取，未将不完整结果当作空列表',
          missing.length ? '先展示远端标签增补差异，批准后创建或调整；保留其他标签' : !valid || !contract ? '使用完整分页结果与已确认合同核对标签' : undefined, true);
        if (missing.length) github = 'needs_setup';
      }
    } else {
      github = 'needs_verification';
      add('github.access', 'unknown', true, conflict ? '仓库身份冲突，已跳过远端查询' : '缺少可用 CLI 或明确仓库，远端尚未核实', '使用实际可用连接器或先补齐已确认的访问条件');
    }
  } else add('github.access', 'unknown', false, '默认未联网，远端定义及权限尚未核实', '获准后使用 --remote 或实际可用连接器做只读核验');
  add('github.types_fields', 'unknown', false, '原生 Type、共享字段和精确管理权限未由本工具验证', '主会话按平台实际能力核查；不能从可读取或仓库角色推断写入授权');
  add('behavior.cold_start', 'unknown', false, '未运行 Agent 冷启动，不能据文件存在宣布完整接入', '新会话验证仅发编号、动态流程推荐、异源任务保护与重跑幂等');
  const setup = checks.some(check => check.required && !check.id.startsWith('github.') && ['missing', 'warn'].includes(check.status));
  const remoteSetup = checks.some(check => check.required && check.id.startsWith('github.') && ['missing', 'warn'].includes(check.status));
  const localUnknown = checks.some(check => check.required && check.status === 'unknown' && !check.id.startsWith('github.'));
  const local = setup ? 'needs_setup' : localUnknown ? 'needs_verification' : 'ready';
  return { schema_version: 1, root, workflow_mode: workflowMode, selected_workflow: selected,
    status: setup || remoteSetup || github === 'needs_setup' ? 'needs_setup' : 'needs_verification',
    readiness: { local, github, behavior: 'not_verified' }, checks,
    next_actions: checks.filter(check => check.status !== 'pass' && check.status !== 'not_applicable' && check.action).map(({ id, action, approval_required }) => ({ check: id, action, ...(approval_required === undefined ? {} : { approval_required }) })),
    read_only: true, complete: false };
}
