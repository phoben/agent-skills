import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { projectPresentation } from '../ui/model.mjs';

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const end = new Date(), start = new Date(); start.setDate(start.getDate() - 6);
const day = date => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: zone }).format(date);
const args = { startDate: day(start), endDate: day(end), timeZone: zone, refresh: true };
const bundle = resolve(dirname(fileURLToPath(import.meta.url)), '../../../plugins/yg-toolkit/dist/token-usage.cjs');
const client = new Client({ name: 'yg-usage-live-check', version: '1.0.0' });
const transport = new StdioClientTransport({ command: 'node', args: [bundle], stderr: 'pipe' });
transport.stderr?.on('data', () => {});
async function call(name, argumentsValue) {
  const result = await client.callTool({ name, arguments: argumentsValue }, undefined, { timeout: 120000 });
  assert.ok(!result.isError, '真实MCP查询不应返回错误');
  return result.structuredContent;
}
try {
  await client.connect(transport);
  const result = await call('token_usage_dashboard', args);
  assert.ok(result.identityKey, '当前账号身份必须可确认');
  assert.ok(['ok', 'partial'].includes(result.account.status), '官方账号接口应有真实返回');
  assert.ok(['ok', 'partial'].includes(result.local.status), '本机项目应可读取');
  const total = result.local.totals;
  assert.equal(total.totalTokens, total.cachedInputTokens + total.uncachedInputTokens + total.outputTokens);
  assert.equal(total.totalTokens, result.local.projects.reduce((sum, project) => sum + project.totalTokens, 0));
  for (const project of result.local.projects) assert.equal(project.totalTokens, project.daily.reduce((sum, daily) => sum + daily.totalTokens, 0));
  let sessionPage, groupedPage;
  if (result.local.projects.length) {
    sessionPage = await call('token_usage_sessions', { ...args, projectId: result.local.projects[0].id, page: 1, pageSize: 10, sort: 'tokens' });
    assert.ok(sessionPage.sessions.length > 0);
    assert.equal(sessionPage.identityKey, result.identityKey);
  }
  const other=projectPresentation(result.local.projects,total.totalTokens).rows.find(project=>project.memberIds);
  if(other){
    groupedPage=await call('token_usage_sessions',{...args,projectIds:other.memberIds,page:1,pageSize:10,sort:'tokens'});
    assert.equal(groupedPage.project.id,'group:other');
    assert.equal(groupedPage.project.memberCount,other.memberIds.length);
    assert.equal(groupedPage.totals.totalTokens,groupedPage.totals.cachedInputTokens+groupedPage.totals.uncachedInputTokens+groupedPage.totals.outputTokens);
    assert.equal(groupedPage.identityKey,result.identityKey);
  }
  process.stdout.write(JSON.stringify({
    checkedAt: new Date().toISOString(), range: result.range,
    accountStatus: result.account.status, officialDailyBuckets: result.account.daily.length,
    quotaStatus: result.quota.status, quotaWindows: result.quota.windows.length,
    localStatus: result.local.status, projectCount: result.local.projects.length,
    rangeTokens: total.totalTokens, coverage: result.local.coverage,
    sessionPageCount: sessionPage?.sessions.length || 0, groupedSessionCount:groupedPage?.totalCount??0, conservation: true,
  }, null, 2) + '\n');
} finally { await client.close(); }
