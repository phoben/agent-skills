import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpath, stat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, resolve, join, relative, sep } from 'node:path';
import { ProofError, requireValue } from './errors.mjs';

const execFileAsync = promisify(execFile);
const key = value => createHash('sha256').update(value).digest('hex').slice(0, 20);
export const samePath = (left, right) => process.platform === 'win32' ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);
const inside = (root, child) => { const path = relative(root, child); return !isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`); };
const skipped = new Set(['.git', '.hg', '.svn', 'node_modules', 'vendor', 'dist', 'build', 'out', 'target', 'coverage', '.next', '.nuxt', '.cache', '.venv', 'venv', '__pycache__', '.codex', '.trellis']);

export function parseGithubRemote(raw) {
  let path;
  const ssh = /^git@github\.com:([^?#\s]+)$/i.exec(raw);
  if (ssh) path = ssh[1];
  else {
    let url; try { url = new URL(raw); } catch { return null; }
    if (!['https:', 'ssh:'].includes(url.protocol) || url.hostname.toLowerCase() !== 'github.com' || url.password || url.search || url.hash || (url.protocol === 'https:' && url.username)) return null;
    path = url.pathname.replace(/^\//, '');
  }
  path = path.replace(/\/+$/, '').replace(/\.git$/i, '');
  if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9_.-]+$/i.test(path) || path.split('/').some(part => part === '.' || part === '..')) return null;
  return { key: key(`github.com/${path.toLowerCase()}`), fullName: path, host: 'github.com' };
}

export async function inspectGit(directory, { run = execFileAsync } = {}) {
  let cwd;
  try { cwd = await realpath(directory); } catch (error) { throw new ProofError(error.code === 'ENOENT' ? 'ROOT_MISSING' : 'ROOT_ACCESS_FAILED', '无法访问已注册工作区目录。'); }
  requireValue(isAbsolute(cwd) && (await stat(cwd)).isDirectory(), 'WORKSPACE_INVALID', '工作区目录不可用。');
  const options = { cwd, windowsHide: true, shell: false, timeout: 7000, maxBuffer: 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } };
  async function git(args) {
    try { return await run('git', args, options); }
    catch (error) {
      const code = error.code === 'ENOENT' ? 'GIT_UNAVAILABLE' : /not a git repository/i.test(error.stderr || '') ? 'ROOT_NOT_REPOSITORY' : ['EACCES', 'EPERM'].includes(error.code) ? 'ROOT_ACCESS_FAILED' : 'GIT_READ_FAILED';
      throw new ProofError(code, '无法读取工作区 Git 信息。');
    }
  }
  const top = (await git(['rev-parse', '--show-toplevel'])).stdout.trim();
  const gitRoot = await realpath(top);
  // 项目指向仓库子目录时仍在原目录工作，不扩大目录扫描范围。
  const remotes = (await git(['remote'])).stdout.split(/\r?\n/).filter(Boolean);
  requireValue(remotes.length <= 64, 'REMOTE_LIMIT', '仓库远端数量超过本次验证范围。');
  const repositories = new Map();
  for (const remote of remotes) {
    const values = (await git(['remote', 'get-url', '--all', '--', remote])).stdout.split(/\r?\n/).filter(Boolean);
    for (const value of values) {
      const repository = parseGithubRemote(value);
      if (repository) repositories.set(repository.key, repository);
    }
  }
  return { cwd, gitRoot, repositories: [...repositories.values()] };
}

// 只扫描已注册根下的实际目录；不跟随符号链接或目录联接，触及边界明确返回部分覆盖。
export async function discoverGitRepositories(directory, { gitInspector = inspectGit, maxDepth = 5, maxDirectories = 1500 } = {}) {
  const root = await realpath(directory);
  const infos = [], warnings = [], visited = new Set();
  const queue = [{ path: root, depth: 0 }];
  let count = 0;
  while (queue.length) {
    if (count >= maxDirectories) { warnings.push('DIRECTORY_LIMIT'); break; }
    const item = queue.shift();
    let actual;
    try { actual = await realpath(item.path); } catch { warnings.push('ROOT_ACCESS_FAILED'); continue; }
    if (!inside(root, actual) || !samePath(actual, item.path)) { warnings.push('LINK_SKIPPED'); continue; }
    const normalized = process.platform === 'win32' ? actual.toLowerCase() : actual;
    if (visited.has(normalized)) continue;
    visited.add(normalized); count++;
    let entries;
    try { entries = await readdir(actual, { withFileTypes: true }); }
    catch { warnings.push('ROOT_ACCESS_FAILED'); continue; }
    if (item.depth === 0 || entries.some(entry => entry.name === '.git')) {
      try { infos.push(await gitInspector(actual)); }
      catch (error) {
        if (error?.code === 'GIT_UNAVAILABLE') throw error;
        if (error?.code !== 'ROOT_NOT_REPOSITORY') warnings.push(error instanceof ProofError ? error.code : 'ROOT_INSPECTION_FAILED');
      }
    }
    const children = entries.filter(entry => entry.isDirectory() && !entry.isSymbolicLink() && !skipped.has(entry.name.toLowerCase()));
    if (item.depth >= maxDepth) {
      if (children.length) warnings.push('DIRECTORY_DEPTH_LIMIT');
      continue;
    }
    for (const child of children) queue.push({ path: join(actual, child.name), depth: item.depth + 1 });
  }
  return { infos, warnings: [...new Set(warnings)], scannedDirectories: count, authorizedRoot: root };
}

export function createCatalog({ bridge, gitInspector = inspectGit, pageLimit = 20, discover = discoverGitRepositories, discoveryOptions = {} } = {}) {
  let state = { schemaVersion: 1, status: 'unavailable', projects: 0, roots: 0, repositories: [], warnings: [], sampledAt: null };
  let rawRepositories = [];
  const refreshes = new Map();
  let revision = 0;
  let sourceRevision = 0;
  async function refresh({ quick = false } = {}) {
    const mode = quick ? 'quick' : 'full';
    if (refreshes.has(mode)) return refreshes.get(mode);
    const startedRevision = revision;
    const pending = (async () => {
      const projects = [], seen = new Set(); let cursor = null, complete = false;
      for (let page = 0; page < pageLimit; page++) {
        const result = await bridge.request('project/list', { limit: 100, sortKey: 'position', ...(cursor ? { cursor } : {}) });
        requireValue(Array.isArray(result?.data), 'HOST_PROTOCOL', '项目列表格式不可识别。');
        for (const project of result.data) {
          requireValue(typeof project?.id === 'string' && Array.isArray(project.roots) && project.roots.every(root => typeof root?.path === 'string' && isAbsolute(root.path)), 'HOST_PROTOCOL', '项目目录格式不可识别。');
          projects.push(project);
        }
        const next = result.nextCursor;
        requireValue(next === null || next === undefined || typeof next === 'string', 'HOST_PROTOCOL', '项目分页格式不可识别。');
        if (!next) { complete = true; break; }
        requireValue(!seen.has(next), 'HOST_PROTOCOL', '项目分页游标重复。'); seen.add(next); cursor = next;
      }
      const repositories = new Map(), warnings = [], roots = projects.flatMap(project => project.roots.map(root => ({ projectId: project.id, projectName: typeof project.name === 'string' ? project.name : '', path: root.path })));
      if (!complete) warnings.push('PROJECT_PAGE_LIMIT');
      if (quick) warnings.push('CATALOG_DEEP_SCAN_PENDING');
      let index = 0;
      const scans = new Map();
      await Promise.all(Array.from({ length: Math.min(4, roots.length) }, async () => {
        while (index < roots.length) {
          const root = roots[index++];
        try {
          const scanKey = process.platform === 'win32' ? root.path.toLowerCase() : root.path;
          if (!scans.has(scanKey)) scans.set(scanKey, quick ? (async () => { const info = await gitInspector(root.path); return { infos: [info], warnings: [], authorizedRoot: info.cwd }; })() : discover(root.path, { ...discoveryOptions, gitInspector }));
          const scan = await scans.get(scanKey);
          warnings.push(...scan.warnings);
          for (const info of scan.infos) for (const repository of info.repositories) {
            const entry = repositories.get(repository.key) || { ...repository, workspaces: [] };
            const workspace = { key: key(`${root.projectId}:${info.cwd}`), projectId: root.projectId, projectName: root.projectName, cwd: info.cwd, authorizedRoot: scan.authorizedRoot };
            if (!entry.workspaces.some(existing => existing.key === workspace.key)) entry.workspaces.push(workspace);
            repositories.set(entry.key, entry);
          }
        } catch (error) {
          if (error?.code === 'GIT_UNAVAILABLE') throw error;
          warnings.push(error instanceof ProofError ? error.code : 'ROOT_INSPECTION_FAILED');
        }
        }
      }));
      if (quick && revision !== startedRevision && state.status !== 'unavailable' && !state.checking) return snapshot();
      state = { schemaVersion: 1, status: warnings.length ? 'partial' : 'complete', projects: projects.length, roots: roots.length, repositories: [...repositories.values()].sort((a, b) => a.fullName.localeCompare(b.fullName)), warnings: [...new Set(warnings)], sampledAt: new Date().toISOString(), ...(quick ? { checking: true } : {}) }; revision++; sourceRevision++;
      // 刷新回到实际 Git 发现项，由调用方按当前 GitHub 身份重新确认后再归一。
      rawRepositories = structuredClone(state.repositories);
      return snapshot();
    })().catch(error => { if (!quick || revision === startedRevision) { const code = error instanceof ProofError ? error.code : 'HOST_DISCOVERY_FAILED'; state = { ...state, status: 'unavailable', checking: true, error: { code, message: 'Codex项目读取暂不可用，已保留上次发现范围，请重试。' }, warnings: ['DISCOVERY_FAILED', code] }; revision++; sourceRevision++; } throw error; }).finally(() => { if (refreshes.get(mode) === pending) refreshes.delete(mode); });
    refreshes.set(mode, pending); return pending;
  }
  function snapshot({ raw = false } = {}) { return structuredClone({ ...(raw ? { ...state, repositories: rawRepositories } : state), revision, sourceRevision }); }
  function restore(value) {
    requireValue(value?.schemaVersion === 1 && ['complete', 'partial'].includes(value.status) && Array.isArray(value.repositories) && value.repositories.length <= 10000 && Number.isSafeInteger(value.projects) && Number.isSafeInteger(value.roots) && Array.isArray(value.warnings), 'CATALOG_CACHE_INVALID', '本机项目快照格式无效。');
    for (const entry of value.repositories) {
      const parsed = typeof entry?.fullName === 'string' ? parseGithubRemote(`https://github.com/${entry.fullName}`) : null;
      requireValue(parsed && parsed.key === entry.key && Array.isArray(entry.workspaces) && entry.workspaces.every(workspace => typeof workspace?.key === 'string' && /^[a-f0-9]{20}$/.test(workspace.key) && typeof workspace.projectId === 'string' && typeof workspace.cwd === 'string' && isAbsolute(workspace.cwd) && (!workspace.authorizedRoot || isAbsolute(workspace.authorizedRoot))), 'CATALOG_CACHE_INVALID', '本机工作区快照格式无效。');
    }
    // 快照只供先显示；工作区操作必须等本轮真实项目与Git复核，不以缓存打开目录。
    rawRepositories = structuredClone(value.repositories);
    state = { ...structuredClone(value), repositories: rawRepositories, status: 'partial', checking: true, warnings: [...new Set([...value.warnings, 'CATALOG_CACHE_CHECKING'])] }; revision++; sourceRevision++;
    return snapshot();
  }
  function remap(mapping) {
    requireValue(state.status !== 'unavailable', 'CATALOG_UNAVAILABLE', '请先重新发现项目目录。');
    requireValue(Array.isArray(mapping) && mapping.length <= rawRepositories.length, 'CATALOG_MAPPING_INVALID', '仓库归一映射格式无效。');
    const rawByKey = new Map(rawRepositories.map(repository => [repository.key, repository]));
    const mappings = new Map(), canonicalNames = new Map();
    for (const item of mapping) {
      requireValue(item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).every(name => ['sourceKey', 'key', 'id', 'fullName'].includes(name)), 'CATALOG_MAPPING_INVALID', '仓库归一映射包含不支持的内容。');
      const sourceKey = item.sourceKey || item.key;
      requireValue(rawByKey.has(sourceKey), 'CATALOG_MAPPING_UNKNOWN', '仓库归一映射不属于当前已发现项目。');
      requireValue((Number.isSafeInteger(item.id) && item.id > 0) || (typeof item.id === 'string' && /^[1-9][0-9]{0,19}$/.test(item.id)), 'CATALOG_MAPPING_INVALID', 'GitHub 仓库标识无效。');
      const id = String(item.id), canonicalKey = key(`github.com:id:${id}`);
      requireValue(!item.sourceKey || !item.key || item.key === canonicalKey, 'CATALOG_MAPPING_INVALID', '仓库规范标识与 GitHub 标识不一致。');
      const parsed = typeof item.fullName === 'string' ? parseGithubRemote(`https://github.com/${item.fullName}`) : null;
      requireValue(parsed && parsed.fullName === item.fullName, 'CATALOG_MAPPING_INVALID', 'GitHub 规范仓库名称无效。');
      requireValue(!mappings.has(sourceKey), 'CATALOG_MAPPING_INVALID', '同一仓库不能重复归一。');
      requireValue(!canonicalNames.has(id) || canonicalNames.get(id).toLowerCase() === item.fullName.toLowerCase(), 'CATALOG_MAPPING_CONFLICT', '同一 GitHub 仓库的规范名称不一致，请重新读取。');
      canonicalNames.set(id, item.fullName);
      mappings.set(sourceKey, { id: item.id, key: canonicalKey, fullName: item.fullName });
    }
    const repositories = new Map();
    for (const source of rawRepositories) {
      const target = mappings.get(source.key);
      if (!target) { repositories.set(source.key, structuredClone(source)); continue; }
      const entry = repositories.get(target.key) || { ...structuredClone(source), ...target, host: 'github.com', sourceKeys: [], sourceNames: [], workspaces: [] };
      if (!entry.sourceKeys.includes(source.key)) entry.sourceKeys.push(source.key);
      if (!entry.sourceNames.includes(source.fullName)) entry.sourceNames.push(source.fullName);
      for (const original of source.workspaces) {
        let workspace = entry.workspaces.find(current => current.key === original.key);
        if (!workspace) { workspace = { ...structuredClone(original), sourceKeys: [], sourceNames: [] }; entry.workspaces.push(workspace); }
        if (!workspace.sourceKeys.includes(source.key)) workspace.sourceKeys.push(source.key);
        if (!workspace.sourceNames.includes(source.fullName)) workspace.sourceNames.push(source.fullName);
      }
      repositories.set(entry.key, entry);
    }
    // 整轮替换而非叠加，另一账号未确认的旧规范元数据不会留在当前目录。
    const normalized = [...repositories.values()].sort((left, right) => left.fullName.localeCompare(right.fullName));
    if (JSON.stringify(state.repositories) !== JSON.stringify(normalized)) { state = { ...state, repositories: normalized }; revision++; }
    return snapshot();
  }
  async function resolveWorkspace(repositoryKey, workspaceKey) {
    requireValue(state.status !== 'unavailable', 'CATALOG_UNAVAILABLE', '请先重新发现项目目录。');
    requireValue(!state.checking, 'CATALOG_CHECKING', '正在核对项目和工作区，请稍后再创建任务。');
    const repository = state.repositories.find(entry => entry.key === repositoryKey);
    const workspace = repository?.workspaces.find(entry => entry.key === workspaceKey);
    requireValue(workspace, 'WORKSPACE_UNKNOWN', '工作区不属于当前已发现仓库。');
    let current; try { current = await gitInspector(workspace.cwd); } catch { throw new ProofError('WORKSPACE_INVALID', '工作区目录已失效，请重新发现。'); }
    requireValue(!workspace.authorizedRoot || inside(workspace.authorizedRoot, current.cwd), 'WORKSPACE_CHANGED', '工作区已离开注册项目范围。');
    const acceptedKeys = new Set([...(workspace.sourceKeys || [repositoryKey]), ...(repository.id ? [parseGithubRemote(`https://github.com/${repository.fullName}`).key] : [])]);
    requireValue(samePath(current.cwd, workspace.cwd) && current.repositories.some(entry => acceptedKeys.has(entry.key)), 'WORKSPACE_CHANGED', '工作区对应仓库已变化，请重新选择。');
    return { repository: structuredClone(repository), workspace: structuredClone(workspace) };
  }
  return { refresh, snapshot, remap, restore, resolveWorkspace };
}
