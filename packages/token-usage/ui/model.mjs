// 只接受服务端聚合计数；未知值保留为空，不补成零。
export const tokenKeys = ['inputTokens', 'cachedInputTokens', 'cacheWriteInputTokens', 'uncachedInputTokens', 'outputTokens', 'reasoningOutputTokens', 'totalTokens'];
export const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export function formatTokens(value) {
  if (count(value) === null) return '—';
  return value >= 1e9 ? `${(value / 1e9).toFixed(2)}B` : value >= 1e6 ? `${(value / 1e6).toFixed(2)}M` : value >= 1000 ? `${(value / 1000).toFixed(value >= 1e5 ? 0 : 1)}K` : value.toLocaleString('zh-CN');
}
export function formatPercent(part, total) {
  if (count(part) === null || count(total) === null || total === 0) return '—';
  const percentage = part / total * 100;
  return part > 0 && percentage < 0.1 ? '<0.1%' : `${percentage.toFixed(1)}%`;
}

export function coverageWarnings(local) {
  if (!local) return [];
  const coverage = local.coverage ?? {}, notes = [];
  const coveredWarnings = new Map([
    ['未确认账号归属的历史会话已排除。','unassignedAccountThreads'],
    ['其他账号的本机会话已排除。','excludedAccountThreads'],
    ['部分会话只有可确认的新增用量，统计可能不完整。','partialRollouts'],
    ['部分本机会话暂时无法读取。','failedThreads'],
  ]);
  const hasCounts = ['attributedThreads', ...coveredWarnings.values()].some(key => count(coverage[key]) !== null);
  if (local.status === 'partial' && !hasCounts) notes.push('本机统计覆盖不完整，仅含已成功读取的记录。');
  for (const warning of new Set(local.warnings ?? [])) {
    if (typeof warning !== 'string' || !/[\u4e00-\u9fff]/.test(warning) || /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/.test(warning)) continue;
    const key = coveredWarnings.get(warning);
    if (local.status === 'unavailable' || !key || !(count(coverage[key]) > 0)) notes.push(warning);
  }
  return notes;
}
export function dateToday(timeZone, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function dateRange(start, end) {
  if (!validDate(start) || !validDate(end) || start > end) return [];
  const length = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1;
  if (length > 366) return [];
  return Array.from({length}, (_, index) => new Date(Date.parse(`${start}T00:00:00Z`) + index * 86400000).toISOString().slice(0, 10));
}
export function presetRange(preset, today) {
  const date = new Date(`${today}T00:00:00Z`);
  let start = today;
  if (preset === '近7天' || preset === '近30天') { date.setUTCDate(date.getUTCDate() - (preset === '近7天' ? 6 : 29)); start = date.toISOString().slice(0, 10); }
  if (preset === '本周') { date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7)); start = date.toISOString().slice(0, 10); }
  if (preset === '本月') start = `${today.slice(0, 7)}-01`;
  if (preset === '本季度') start = `${today.slice(0, 4)}-${String(Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
  if (preset === '本年') start = `${today.slice(0, 4)}-01-01`;
  return {startDate:start, endDate:today};
}
export function decodeToolResult(result) {
  let data = result?.structuredContent;
  if (!data) {
    for (const item of result?.content ?? []) {
      if (item.type !== 'text') continue;
      try { data = JSON.parse(item.text); break; } catch { /* 文本说明不是结构化统计。 */ }
    }
  }
  if (result?.isError || data?.error) {
    const error = new Error('用量服务暂时无法完成查询');
    error.code = data?.error?.code ?? data?.code;
    throw error;
  }
  if (!data || data.schemaVersion !== 1) throw new Error('用量服务返回了无法识别的数据');
  return data;
}
export function chooseQuotaWindow(windows = []) {
  const usable = windows.filter(window => Number.isFinite(window?.usedPercent) && window.usedPercent >= 0);
  return usable.find(window => Number.isFinite(window.windowMinutes) && window.windowMinutes >= 10080) ?? usable[0] ?? null;
}
export const isIdentityError = error => ['ACCOUNT_CHANGED', 'IDENTITY_UNAVAILABLE'].includes(error?.code);

// 只有相邻且有有效计数的日期相连，未知日期会切断折线。
export function trendSegments(daily, startDate, endDate) {
  const buckets = new Map((Array.isArray(daily) ? daily : []).filter(row => validDate(row?.date) && count(row.tokens) !== null).map(row => [row.date,row]));
  const segments = [];
  let segment = [];
  for (const date of dateRange(startDate,endDate)) {
    const row = buckets.get(date);
    if (row) segment.push(row);
    else if (segment.length) { segments.push(segment); segment = []; }
  }
  if (segment.length) segments.push(segment);
  return segments;
}

export const OTHER_PROJECT_ID = 'group:other';
// 折叠只改变展示，不改变总量；严格超过1%的项目保留原行。
export function projectPresentation(projects, totalTokens, expanded = false) {
  const source = Array.isArray(projects) ? projects : [];
  if (count(totalTokens) === null || totalTokens === 0) return { rows: source, hiddenCount: 0, totalCount: source.length };
  const kept = [], hidden = [];
  for (const project of source) {
    if (count(project?.totalTokens) === null || BigInt(project.totalTokens) * 100n > BigInt(totalTokens)) kept.push(project);
    else hidden.push(project);
  }
  if (expanded || !hidden.length) return { rows: source, hiddenCount: hidden.length, totalCount: source.length };
  const merge = (rows, key) => rows.every(row => count(row[key]) !== null) ? rows.reduce((sum, row) => sum + row[key], 0) : null;
  const daily = new Map();
  for (const project of hidden) for (const day of project.daily ?? []) {
    if (!validDate(day.date)) continue;
    if (!daily.has(day.date)) daily.set(day.date, []);
    daily.get(day.date).push(day);
  }
  const other = {
    id: OTHER_PROJECT_ID, name: `其他 ${hidden.length} 个项目`, memberIds: hidden.map(project => project.id),
    sessionCount: merge(hidden, 'sessionCount'),
    ...Object.fromEntries(tokenKeys.map(key => [key, merge(hidden, key)])),
    daily: [...daily].sort(([a],[b]) => a.localeCompare(b)).map(([date,rows]) => ({ date, ...Object.fromEntries(tokenKeys.map(key => [key,merge(rows,key)])) })),
  };
  return { rows: [...kept, other], hiddenCount: hidden.length, totalCount: source.length };
}
