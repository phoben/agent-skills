import { DatabaseSync } from 'node:sqlite';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, realpath, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createZstdDecompress } from 'node:zlib';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const FIELDS = ['inputTokens', 'cachedInputTokens', 'cacheWriteInputTokens', 'uncachedInputTokens', 'outputTokens', 'reasoningOutputTokens', 'totalTokens'];
const RAW_FIELDS = ['input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', null, 'output_tokens', 'reasoning_output_tokens', 'total_tokens'];
const CACHE_VERSION = 2;
const empty = () => Object.fromEntries(FIELDS.map(k => [k, 0]));
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const safeText = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').slice(0, 500) : '';
const failure = (code, message) => Object.assign(new Error(message), { code, collectorSafe: true });
const inside = (root, target) => { const rel = path.relative(root, target); return rel !== '' && !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel); };
const cleanCwd = value => typeof value === 'string' && process.platform === 'win32' ? value.replace(/^\\\\\?\\/, '') : value;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

function add(target, value) {
  for (const key of FIELDS) {
    const sum = target[key] + value[key];
    if (!Number.isSafeInteger(sum)) throw failure('LOCAL_TOTAL_OVERFLOW', '本机统计超出可安全计算的范围。');
    target[key] = sum;
  }
  return target;
}

function usage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const result = {};
  for (let i = 0; i < FIELDS.length; i++) {
    if (!RAW_FIELDS[i]) continue;
    const value = raw[RAW_FIELDS[i]] ?? (i === 2 || i === 5 ? 0 : undefined);
    if (!Number.isSafeInteger(value) || value < 0) return null;
    result[FIELDS[i]] = value;
  }
  result.uncachedInputTokens = result.inputTokens - result.cachedInputTokens;
  if (result.uncachedInputTokens < result.cacheWriteInputTokens || result.reasoningOutputTokens > result.outputTokens || result.totalTokens !== result.inputTokens + result.outputTokens) return null;
  return result;
}

function delta(current, previous, last) {
  if (!previous) return { value: last ?? empty(), partial: !last || current.totalTokens !== last.totalTokens };
  if (FIELDS.every(k => current[k] === previous[k])) return { value: empty(), partial: false };
  const difference = Object.fromEntries(FIELDS.map(k => [k, current[k] - previous[k]]));
  const valid = FIELDS.every(k => Number.isSafeInteger(difference[k]) && difference[k] >= 0)
    && difference.totalTokens === difference.inputTokens + difference.outputTokens
    && difference.cachedInputTokens + difference.cacheWriteInputTokens <= difference.inputTokens
    && difference.reasoningOutputTokens <= difference.outputTokens;
  return valid ? { value: difference, partial: false } : { value: last ?? empty(), partial: true };
}

function parentFrom(source) {
  try {
    const parsed = typeof source === 'string' ? JSON.parse(source) : source;
    return parsed?.subagent?.thread_spawn?.parent_thread_id ?? null;
  } catch { return null; }
}

function validateRange(args) {
  const { startDate, endDate, timeZone } = args;
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate || (Date.parse(endDate) - Date.parse(startDate)) / 86400000 >= 366) throw failure('INVALID_RANGE', '请选择不超过 366 天的有效日期范围。');
  try { if (typeof timeZone !== 'string' || !timeZone) throw new Error(); new Intl.DateTimeFormat('en-CA', { timeZone }).format(); } catch { throw failure('INVALID_TIME_ZONE', '请选择有效的 IANA 时区。'); }
  if (!args.accountId || typeof args.accountId !== 'string') throw failure('ACCOUNT_REQUIRED', '请先登录 Codex 账号。');
}

async function openIndex(codexHome) {
  let names;
  try { names = await readdir(codexHome); } catch { throw failure('LOCAL_SOURCE_UNAVAILABLE', '暂时无法读取本机 Codex 会话索引。'); }
  const candidates = names.filter(name => /^state_\d+\.sqlite$/.test(name)).sort((a, b) => Number(b.match(/\d+/)[0]) - Number(a.match(/\d+/)[0]));
  for (const name of candidates) {
    let db;
    try {
      db = new DatabaseSync(path.join(codexHome, name), { readOnly: true });
      db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=3000');
      const columns = new Set(db.prepare('PRAGMA table_info(threads)').all().map(row => row.name));
      if (!columns.has('id') || !columns.has('rollout_path')) { db.close(); continue; }
      const wanted = ['id', 'rollout_path', 'creator_account_id', 'project_id', 'cwd', 'title', 'name', 'model', 'source', 'attached_thread_parent_id', 'updated_at', 'updated_at_ms'];
      const rows = db.prepare(`SELECT ${wanted.filter(key => columns.has(key)).map(key => `"${key}"`).join(',')} FROM threads`).all();
      const projectNames = new Map();
      const projectColumns = new Set(db.prepare('PRAGMA table_info(projects)').all().map(row => row.name));
      if (projectColumns.has('id') && projectColumns.has('name')) {
        for (const project of db.prepare('SELECT id,name FROM projects').all()) {
          const name = safeText(project.name).trim();
          if (name) projectNames.set(project.id, name);
        }
      }
      db.close();
      return { rows, projectNames };
    } catch { try { db?.close(); } catch {} }
  }
  throw failure('LOCAL_SOURCE_UNAVAILABLE', '没有找到可用的本机 Codex 会话索引。');
}

async function projectFor(row, meta, projectCache, projectNames) {
  const explicit = row.project_id || meta.projectId;
  const cwd = cleanCwd(row.cwd || meta.cwd || '');
  if (explicit) return { id: `project-${hash(explicit).slice(0, 24)}`, name: projectNames.get(explicit) || safeText(path.basename(cwd)) || 'Codex 项目' };
  if (!cwd) return { id: 'project-unknown', name: '未归类项目' };
  if (projectCache.has(cwd)) return projectCache.get(cwd);
  let key = path.resolve(cwd);
  let name = path.basename(key);
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { windowsHide: true, timeout: 3000, maxBuffer: 16384 });
    const common = stdout.trim();
    if (common) {
      key = await realpath(common);
      name = path.basename(key) === '.git' ? path.basename(path.dirname(key)) : path.basename(key).replace(/\.git$/, '');
    }
  } catch { try { key = await realpath(key); } catch {} }
  const project = { id: `project-${hash(process.platform === 'win32' ? key.toLowerCase() : key).slice(0, 24)}`, name: safeText(name) || 'Codex 项目' };
  projectCache.set(cwd, project);
  return project;
}

async function parseRollout(file, row) {
  let lineNumber = -1;
  let ownMeta = null;
  let boundary = -1;
  let previous = null;
  let partial = false;
  let model = '';
  let latest = null;
  const events = [];
  const stream = createReadStream(file);
  const input = file.endsWith('.zst') ? stream.pipe(createZstdDecompress()) : stream;
  input.setEncoding('utf8');
  // 压缩源和解压流的错误统一交给读取方，避免未处理的流异常。
  if (input !== stream) stream.on('error', error => input.destroy(error));
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      lineNumber++;
      if (!line.trim()) continue;
      let record;
      try { record = JSON.parse(line); } catch { partial = true; continue; }
      if (record.type === 'session_meta') {
        const meta = record.payload;
        // 子代理日志可能复制父线程的 meta，只使用与索引线程相符的第一条。
        if (!ownMeta && meta && (meta.id ?? meta.session_id) === row.id) {
          if (meta.creator_account_id && meta.creator_account_id !== row.creator_account_id) throw failure('LOCAL_IDENTITY_MISMATCH', '部分会话的账号归属无法确认，已排除。');
          ownMeta = { parentId: meta.parent_thread_id || parentFrom(meta.source), projectId: meta.project_id, cwd: meta.cwd };
          if (Number.isSafeInteger(meta.subagent_history_start_ordinal) && meta.subagent_history_start_ordinal >= 0) boundary = meta.subagent_history_start_ordinal;
        }
        continue;
      }
      const ordinal = Number.isSafeInteger(record.ordinal) ? record.ordinal : lineNumber;
      if (!Number.isSafeInteger(record.ordinal)) partial = true;
      if (!ownMeta) { partial = true; continue; }
      // 本机抽样中边界记录是子代理自己的 thread_settings_applied，即第一条新记录。
      // 因此只跳过边界之前的继承历史；边界本身若为用量事件，也必须计入。
      if (ordinal < boundary) continue;
      if (record.type === 'turn_context' && typeof record.payload?.model === 'string') model = safeText(record.payload.model);
      if (record.type !== 'event_msg' || record.payload?.type !== 'token_count' || !record.payload.info) continue;
      const current = usage(record.payload.info.total_token_usage);
      const last = usage(record.payload.info.last_token_usage);
      if (!current) { partial = true; continue; }
      const result = delta(current, previous, last);
      previous = current;
      partial ||= result.partial;
      const timestamp = Date.parse(record.timestamp);
      if (!Number.isFinite(timestamp)) { partial = true; continue; }
      latest = Math.max(latest ?? timestamp, timestamp);
      if (result.value.totalTokens > 0) events.push({ timestamp, ...result.value });
    }
  } finally { lines.close(); input.destroy(); stream.destroy(); }
  if (!ownMeta) partial = true;
  return { events, partial, meta: { parentId: ownMeta?.parentId || parentFrom(row.source) || null, projectId: ownMeta?.projectId, cwd: ownMeta?.cwd, model, latest } };
}

export function createCollector({ codexHome, cacheDir: suppliedCacheDir, now = () => new Date() } = {}) {
  if (!codexHome || typeof codexHome !== 'string') throw failure('LOCAL_CONFIG_INVALID', '本机 Codex 数据目录未配置。');
  const cacheDir = suppliedCacheDir ?? path.join(codexHome, 'yg-toolkit');
  let cache;
  let closed = false;
  let queue = Promise.resolve();
  const projectCache = new Map();
  async function getCache() {
    if (closed) throw failure('LOCAL_COLLECTOR_CLOSED', '本机统计服务已关闭。');
    if (!cache) {
      try {
        await mkdir(cacheDir, { recursive: true });
        cache = new DatabaseSync(path.join(cacheDir, 'token-usage.sqlite'));
        cache.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS rollout_stats (account_key TEXT NOT NULL, thread_id TEXT NOT NULL, signature TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(account_key,thread_id))');
      } catch { throw failure('LOCAL_CACHE_UNAVAILABLE', '暂时无法打开本机统计缓存。'); }
    }
    return cache;
  }

  async function collect(args) {
    validateRange(args);
    const { rows, projectNames } = await openIndex(codexHome);
    const coverage = { scannedThreads: rows.length, attributedThreads: 0, unassignedAccountThreads: 0, excludedAccountThreads: 0, failedThreads: 0, partialRollouts: 0, indexedAt: now().toISOString() };
    const own = [];
    for (const row of rows) {
      if (!row.creator_account_id) coverage.unassignedAccountThreads++;
      else if (row.creator_account_id !== args.accountId) coverage.excludedAccountThreads++;
      else { own.push(row); coverage.attributedThreads++; }
    }
    const db = await getCache();
    const key = hash(args.accountId);
    const read = db.prepare('SELECT signature,data FROM rollout_stats WHERE account_key=? AND thread_id=?');
    const write = db.prepare('INSERT OR REPLACE INTO rollout_stats(account_key,thread_id,signature,data) VALUES(?,?,?,?)');
    const roots = [];
    const realHome = await realpath(codexHome);
    for (const name of ['sessions', 'archived_sessions']) { try { const root = await realpath(path.join(codexHome, name)); if (inside(realHome, root)) roots.push(root); } catch {} }
    const threads = new Map();
    // 日志逐个流读，避免同时打开数百文件或一次加载会话正文。
    for (const row of own) {
      try {
        if (typeof row.rollout_path !== 'string') throw new Error();
        let file;
        try { file = await realpath(row.rollout_path); } catch (error) {
          if (error.code !== 'ENOENT' || !row.rollout_path.endsWith('.jsonl')) throw error;
          // Codex 压缩历史后，索引可能暂时保留原来的 JSONL 文件名。
          file = await realpath(`${row.rollout_path}.zst`);
        }
        if (!roots.some(root => inside(root, file)) || !/\.jsonl(?:\.zst)?$/i.test(file)) throw new Error();
        const before = await stat(file);
        if (!before.isFile()) throw new Error();
        const signature = `${CACHE_VERSION}:${before.size}:${before.mtimeMs}:${hash(row.rollout_path)}`;
        const stored = read.get(key, row.id);
        let parsed;
        if (stored?.signature === signature) { try { parsed = JSON.parse(stored.data); } catch {} }
        if (!parsed) {
          parsed = await parseRollout(file, row);
          const after = await stat(file);
          if (before.size === after.size && before.mtimeMs === after.mtimeMs) write.run(key, row.id, signature, JSON.stringify(parsed));
          else parsed.partial = true;
        }
        const project = await projectFor(row, parsed.meta, projectCache, projectNames);
        const metadataTime = Number(row.updated_at_ms) || Number(row.updated_at) * 1000;
        threads.set(row.id, { id: row.id, title: safeText(row.name || row.title) || '未命名会话', project, model: parsed.meta.model, parentId: parsed.meta.parentId, events: parsed.events, latest: parsed.meta.latest ?? (Number.isFinite(metadataTime) && metadataTime > 0 ? metadataTime : null) });
        if (parsed.partial) coverage.partialRollouts++;
      } catch { coverage.failedThreads++; }
    }
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: args.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const dayFor = timestamp => formatter.format(new Date(timestamp));
    const grouped = new Map();
    function rootOf(thread) {
      const seen = new Set([thread.id]);
      let current = thread;
      while (current.parentId && threads.has(current.parentId)) {
        if (seen.has(current.parentId)) return thread;
        current = threads.get(current.parentId);
        seen.add(current.id);
      }
      return current;
    }
    for (const thread of threads.values()) {
      const root = rootOf(thread);
      if (!grouped.has(root.id)) grouped.set(root.id, { id: root.id, title: root.title, model: root.model, project: root.project, latest: root.latest, childIds: new Set(), events: [] });
      const group = grouped.get(root.id);
      if (thread.id !== root.id) group.childIds.add(thread.id);
      if (thread.latest != null) group.latest = Math.max(group.latest ?? thread.latest, thread.latest);
      for (const event of thread.events) group.events.push(event);
    }
    const sessions = [];
    const projects = new Map();
    const totals = empty();
    for (const group of grouped.values()) {
      const selected = group.events.filter(event => { const day = dayFor(event.timestamp); return day >= args.startDate && day <= args.endDate; });
      if (!selected.length) continue;
      const sum = empty();
      const days = {};
      let selectedLatest = -Infinity;
      for (const event of selected) {
        add(sum, event);
        selectedLatest = Math.max(selectedLatest, event.timestamp);
        const day = days[dayFor(event.timestamp)] ??= { ...empty(), lastActivityAt: null };
        add(day, event);
        const timestamp = new Date(event.timestamp).toISOString();
        if (day.lastActivityAt === null || timestamp > day.lastActivityAt) day.lastActivityAt = timestamp;
      }
      // 最近活动与计数使用同一批已选事件，单日筛选由对应日桶覆盖。
      const session = { id: group.id, title: group.title, model: group.model || null, lastActivityAt: new Date(selectedLatest).toISOString(), subagentCount: group.childIds.size, ...sum, projectId: group.project.id, days };
      sessions.push(session);
      if (!projects.has(group.project.id)) projects.set(group.project.id, { ...group.project, sessionCount: 0, ...empty(), days: new Map() });
      const project = projects.get(group.project.id);
      project.sessionCount++;
      add(project, sum); add(totals, sum);
      for (const event of selected) {
        const date = dayFor(event.timestamp);
        if (!project.days.has(date)) project.days.set(date, { date, ...empty() });
        add(project.days.get(date), event);
      }
    }
    const warnings = [];
    if (coverage.unassignedAccountThreads) warnings.push('未确认账号归属的历史会话已排除。');
    if (coverage.excludedAccountThreads) warnings.push('其他账号的本机会话已排除。');
    if (coverage.partialRollouts) warnings.push('部分会话只有可确认的新增用量，统计可能不完整。');
    if (coverage.failedThreads) warnings.push('部分本机会话暂时无法读取。');
    return { local: { status: coverage.failedThreads || coverage.partialRollouts || coverage.unassignedAccountThreads ? 'partial' : 'ok', totals, projects: [...projects.values()].map(({ days, ...project }) => ({ ...project, daily: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) })).sort((a, b) => b.totalTokens - a.totalTokens || a.id.localeCompare(b.id)), coverage, warnings }, sessions };
  }

  const serialized = operation => {
    const pending = queue.then(async () => {
      try { return await operation(); } catch (error) {
        if (error?.collectorSafe) throw error;
        throw failure('LOCAL_COLLECTION_FAILED', '暂时无法完成本机用量统计，请重试。');
      }
    });
    queue = pending.catch(() => {});
    return pending;
  };
  return {
    dashboard: args => serialized(async () => {
      try { return (await collect(args)).local; } catch (error) {
        if (!['LOCAL_SOURCE_UNAVAILABLE', 'LOCAL_CACHE_UNAVAILABLE'].includes(error.code)) throw error;
        return { status: 'unavailable', totals: null, projects: [], coverage: { scannedThreads: 0, attributedThreads: 0, unassignedAccountThreads: 0, excludedAccountThreads: 0, failedThreads: 0, partialRollouts: 0, indexedAt: now().toISOString() }, warnings: [error.message] };
      }
    }),
    sessions: args => serialized(async () => {
      const { projectId, projectIds, date, search = '', sort = 'tokens', page = 1, pageSize = 20 } = args;
      const validId = value => typeof value === 'string' && value.length <= 200 && value.trim().length > 0;
      const grouped = projectIds !== undefined;
      const validSelector = (projectId !== undefined) !== grouped
        && (grouped ? Array.isArray(projectIds) && projectIds.length >= 1 && projectIds.length <= 1000 && projectIds.every(validId) && new Set(projectIds).size === projectIds.length : validId(projectId));
      if (!validSelector || typeof search !== 'string' || search.length > 200 || !['tokens', 'recent', 'output'].includes(sort) || !Number.isSafeInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || (date !== undefined && (!validDate(date) || date < args.startDate || date > args.endDate))) throw failure('INVALID_SESSION_QUERY', '会话筛选条件无效。');
      const { local, sessions } = await collect(args);
      const selectedIds = new Set(grouped ? projectIds : [projectId]);
      const available = new Map(local.projects.map(item => [item.id, item]));
      if ([...selectedIds].some(id => !available.has(id))) throw failure('PROJECT_NOT_FOUND', '当前范围内没有该项目的会话。');
      const project = grouped ? { id: 'group:other', name: `其他 ${selectedIds.size} 个项目`, memberCount: selectedIds.size } : { id: projectId, name: available.get(projectId).name };
      const all = sessions.filter(item => selectedIds.has(item.projectId) && (!date || item.days[date])).map(item => date ? { ...item, ...item.days[date] } : item);
      const totals = empty();
      for (const session of all) add(totals, session);
      const needle = search.trim().toLocaleLowerCase();
      const filtered = all.filter(item => !needle || `${item.title}\n${item.model ?? ''}`.toLocaleLowerCase().includes(needle));
      filtered.sort((a, b) => (sort === 'recent' ? (Date.parse(b.lastActivityAt) || 0) - (Date.parse(a.lastActivityAt) || 0) : sort === 'output' ? b.outputTokens - a.outputTokens : b.totalTokens - a.totalTokens) || a.id.localeCompare(b.id));
      return { schemaVersion: 1, project, range: { startDate: args.startDate, endDate: args.endDate, timeZone: args.timeZone }, date: date ?? null, totalCount: all.length, filteredCount: filtered.length, totals, page, pageSize, totalPages: Math.ceil(filtered.length / pageSize), sessions: filtered.slice((page - 1) * pageSize, page * pageSize).map(({ projectId: ignored, days: ignoredDays, ...session }) => session) };
    }),
    close: () => serialized(async () => { cache?.close(); cache = undefined; closed = true; }),
  };
}
