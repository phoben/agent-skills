import test from 'node:test';
import assert from 'node:assert/strict';
import { createUsageService } from '../src/service.mjs';
import { parseArguments, dashboardSchema, sessionsSchema, sessionsShape } from '../src/contracts.mjs';

const range = { startDate: '2026-11-01', endDate: '2026-11-03', timeZone: 'Asia/Shanghai' };
const totals = { inputTokens: 90, cachedInputTokens: 60, cacheWriteInputTokens: 0, uncachedInputTokens: 30, outputTokens: 10, reasoningOutputTokens: 3, totalTokens: 100 };
function snapshot(accountId = 'account-a') {
  return { accountId, account: { type: 'chatgpt', planType: 'pro' }, usage: { summary: { lifetimeTokens: 1000 }, dailyUsageBuckets: [{ startDate: '2026-11-01', tokens: 200 }, { startDate: '2026-11-03', tokens: 300 }] }, rates: { rateLimits: { primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 1794000000 }, secondary: { usedPercent: 62, windowDurationMins: 10080, resetsAt: 1794500000 } } } };
}
test('查询边界拒绝未知字段、无效日期、过长区间和越界单日', () => {
  for (const value of [{ ...range, extra: true }, { ...range, startDate: '2026-02-30' }, { ...range, timeZone: 'bad-zone' }, { ...range, startDate: '2020-01-01' }]) assert.throws(() => parseArguments(dashboardSchema, value), { code: 'INVALID_ARGUMENT' });
  assert.throws(() => parseArguments(sessionsSchema, { ...range, projectId: 'p', date: '2026-10-31' }), { code: 'INVALID_ARGUMENT' });
});
test('会话选择器兼容单项目，合并项目严格互斥且标识有效唯一', () => {
  assert.equal(parseArguments(sessionsSchema, { ...range, projectId: 'legacy' }).projectId, 'legacy');
  assert.deepEqual(parseArguments(sessionsSchema, { ...range, projectIds: ['a', 'b'] }).projectIds, ['a', 'b']);
  const limit = Array.from({ length: 1000 }, (_, index) => `project-${index}`);
  assert.equal(parseArguments(sessionsSchema, { ...range, projectIds: limit }).projectIds.length, 1000);
  for (const selector of [{}, { projectId: 'a', projectIds: ['b'] }, { projectIds: [] }, { projectIds: ['a', 'a'] }, { projectIds: [''] }, { projectIds: [' '] }, { projectId: ' ' }, { projectIds: ['a'.repeat(201)] }, { projectIds: [...limit, 'one-too-many'] }, { projectIds: 'a' }, { projectIds: [null] }]) {
    assert.equal(sessionsShape.safeParse({ ...range, ...selector }).success, false);
    assert.throws(() => parseArguments(sessionsSchema, { ...range, ...selector }), { code: 'INVALID_ARGUMENT' });
  }
});
test('合并会话通过服务保留真实成员和日期条件，并确认当前账号', async () => {
  let forwarded;
  let identityReads = 0;
  const service = createUsageService({ bridge: { identity: async () => { identityReads++; return { accountId: 'account-a' }; }, close() {} }, collector: { sessions: async args => { forwarded = args; return { project: { id: 'group:other', name: '其他 2 个项目' }, sessions: [] }; } } });
  const input = { ...range, projectIds: ['a', 'b'], date: '2026-11-02', search: 'Alpha', sort: 'recent', page: 2, pageSize: 5 };
  const value = await service.sessions(input);
  assert.deepEqual(forwarded, { ...input, refresh: false, accountId: 'account-a' });
  assert.equal('projectId' in forwarded, false);
  assert.equal(identityReads, 2);
  assert.equal(value.project.id, 'group:other');
  await service.close();
});
test('官方日期缺口标记部分覆盖，本机与官方总量独立且额度来自当前窗口', async () => {
  const service = createUsageService({ bridge: { snapshot: async () => snapshot(), identity: async () => ({ accountId: 'account-a' }), close() {} }, collector: { dashboard: async args => { assert.equal(args.accountId, 'account-a'); return { status: 'ok', totals, projects: [], coverage: {} }; } } });
  const value = await service.dashboard(range);
  assert.equal(value.account.status, 'partial'); assert.equal(value.account.rangeTokens, 500); assert.equal(value.account.coverage.availableDays, 2);
  assert.equal(value.local.totals.totalTokens, 100); assert.equal(value.quota.windows[1].windowMinutes, 10080); assert.equal(value.quota.windows[1].usedPercent, 62);
  assert.ok(value.identityKey && !value.identityKey.includes('account-a')); await service.close();
});
test('账号在采集期间切换时拒绝返回旧账号统计', async () => {
  const service = createUsageService({ bridge: { snapshot: async () => snapshot(), identity: async () => ({ accountId: 'account-b' }), close() {} }, collector: { dashboard: async () => ({ status: 'ok', totals, projects: [], coverage: {} }) } });
  await assert.rejects(service.dashboard(range), { code: 'ACCOUNT_CHANGED' }); await service.close();
});
test('未知账号不读取本机历史，无官方日期时总量保持未知', async () => {
  const service = createUsageService({ bridge: { snapshot: async () => ({ accountId: null, account: { type: 'apiKey' }, usage: null, rates: null }), identity: async () => ({ accountId: null }), close() {} }, collector: { dashboard: async () => assert.fail('不能读取未知归属历史') } });
  const value = await service.dashboard(range);
  assert.equal(value.account.rangeTokens, null); assert.equal(value.local.totals, null); assert.equal(value.local.status, 'unavailable');
  await assert.rejects(service.sessions({ ...range, projectId: 'p' }), { code: 'IDENTITY_UNAVAILABLE' }); await service.close();
});

test('服务关闭等待统计缓存释放后再完成', async () => {
  let released = false;
  const service = createUsageService({ bridge: { close: async () => {} }, collector: { close: async () => { await new Promise(resolve => setImmediate(resolve)); released = true; } } });
  await service.close();
  assert.equal(released, true);
});
