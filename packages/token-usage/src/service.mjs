import { createHash } from 'node:crypto';
import { createCollector } from './collector.mjs';
import { createCodexBridge, defaultCodexHome } from './codex-bridge.mjs';
import { UsageError, dashboardSchema, sessionsSchema, parseArguments, safeFailure } from './contracts.mjs';

const validCount = value => Number.isSafeInteger(value) && value >= 0;
const identityKey = id => id ? createHash('sha256').update(id).digest('hex').slice(0, 24) : null;
function normalizeAccount(snapshot, range) {
  const daily = (Array.isArray(snapshot.usage?.dailyUsageBuckets) ? snapshot.usage.dailyUsageBuckets : [])
    .filter(row => typeof row.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.startDate) && validCount(row.tokens))
    .map(row => ({ date: row.startDate, tokens: row.tokens })).sort((a, b) => a.date.localeCompare(b.date));
  const selected = daily.filter(row => row.date >= range.startDate && row.date <= range.endDate);
  const requestedDays = (Date.parse(range.endDate) - Date.parse(range.startDate)) / 86400000 + 1;
  const availableDays = new Set(selected.map(row => row.date)).size;
  const status = !snapshot.usage ? 'unavailable' : availableDays < requestedDays ? 'partial' : 'ok';
  return {
    status, planType: snapshot.account?.planType ?? null,
    lifetimeTokens: validCount(snapshot.usage?.summary?.lifetimeTokens) ? snapshot.usage.summary.lifetimeTokens : null,
    rangeTokens: selected.length ? selected.reduce((total, row) => total + row.tokens, 0) : null,
    daily: selected,
    coverage: { startDate: daily[0]?.date ?? null, endDate: daily.at(-1)?.date ?? null, requestedDays, availableDays },
    message: status === 'unavailable' ? '当前登录方式或Codex版本未提供官方账号统计。' : status === 'partial' ? '官方返回的日期记录未完整覆盖所选区间。' : null,
  };
}
function normalizeQuota(rates) {
  const groups = rates?.rateLimitsByLimitId && typeof rates.rateLimitsByLimitId === 'object' ? Object.values(rates.rateLimitsByLimitId) : [];
  const primaryGroup = rates?.rateLimits || groups[0];
  const windows = ['primary', 'secondary'].flatMap(kind => {
    const value = primaryGroup?.[kind];
    return value && Number.isFinite(value.usedPercent) && value.usedPercent >= 0 ? [{
      kind, usedPercent: value.usedPercent,
      windowMinutes: Number.isFinite(value.windowDurationMins) ? value.windowDurationMins : null,
      resetsAt: Number.isFinite(value.resetsAt) ? value.resetsAt : null,
    }] : [];
  });
  return { status: windows.length ? 'ok' : 'unavailable', windows, message: windows.length ? null : '当前账号暂未提供额度窗口。' };
}
export function createUsageService({ codexHome = defaultCodexHome(), cacheDir, bridge = createCodexBridge({ codexHome }), collector = createCollector({ codexHome, cacheDir }) } = {}) {
  async function confirm(accountId) {
    const now = await bridge.identity();
    if (!accountId || now.accountId !== accountId) throw new UsageError('ACCOUNT_CHANGED', '当前账号已变化，请刷新页面。');
  }
  async function dashboard(input) {
    const args = parseArguments(dashboardSchema, input);
    const snapshot = await bridge.snapshot({ refresh: args.refresh });
    let local;
    if (!snapshot.accountId) local = { status: 'unavailable', totals: null, projects: [], coverage: null, warnings: ['IDENTITY_UNAVAILABLE'], message: '无法确认当前账号，本机项目统计未读取。' };
    else {
      try { local = await collector.dashboard({ ...args, accountId: snapshot.accountId }); }
      catch (error) { const failure = safeFailure(error); local = { status: 'unavailable', totals: null, projects: [], coverage: null, warnings: [failure.code], message: failure.message }; }
      await confirm(snapshot.accountId);
    }
    return { schemaVersion: 1, identityKey: identityKey(snapshot.accountId), range: { startDate: args.startDate, endDate: args.endDate, timeZone: args.timeZone }, account: normalizeAccount(snapshot, args), quota: normalizeQuota(snapshot.rates), local, sampledAt: new Date().toISOString() };
  }
  async function sessions(input) {
    const args = parseArguments(sessionsSchema, input), before = await bridge.identity();
    if (!before.accountId) throw new UsageError('IDENTITY_UNAVAILABLE', '无法确认当前账号。');
    const data = await collector.sessions({ ...args, accountId: before.accountId });
    await confirm(before.accountId);
    return { ...data, schemaVersion: 1, identityKey: identityKey(before.accountId) };
  }
  return { dashboard, sessions, async close() { await bridge.close(); await collector.close?.(); } };
}
