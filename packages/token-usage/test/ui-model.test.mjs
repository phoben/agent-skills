import test from 'node:test';
import assert from 'node:assert/strict';
import {count, formatTokens, formatPercent, coverageNotes, dateToday, dateRange, presetRange, decodeToolResult, chooseQuotaWindow, escapeHtml, isIdentityError, trendSegments} from '../ui/model.mjs';

test('缺失、字符串和异常计数保留未知，真实零正常显示', () => {
  for (const value of [null,undefined,'123',NaN,Infinity,-1,1.1,Number.MAX_SAFE_INTEGER+1]) {
    assert.equal(count(value),null);
    assert.equal(formatTokens(value),'—');
  }
  assert.equal(formatTokens(0),'0');
});
test('日期按请求时区跨日，本周从周一开始，闰年与长区间严格校验', () => {
  const now = new Date('2026-11-02T18:00:00Z');
  assert.equal(dateToday('Asia/Shanghai',now),'2026-11-03');
  assert.equal(dateToday('America/Los_Angeles',now),'2026-11-02');
  assert.deepEqual(presetRange('本周','2026-11-01'),{startDate:'2026-10-26',endDate:'2026-11-01'});
  assert.equal(dateRange('2024-01-01','2024-12-31').length,366);
  assert.equal(dateRange('2024-01-01','2025-01-01').length,0);
  assert.equal(dateRange('2026-02-29','2026-03-01').length,0);
  assert.equal(dateRange('2026-11-01','2026-11-03').length,3);
});
test('工具错误优先于有效载荷，保留账号变化错误码', () => {
  assert.throws(() => decodeToolResult({isError:true,structuredContent:{schemaVersion:1,code:'ACCOUNT_CHANGED'}}),error => isIdentityError(error));
  assert.throws(() => decodeToolResult({content:[{type:'text',text:'读取失败'}]}));
  assert.deepEqual(decodeToolResult({content:[{type:'text',text:'{"schemaVersion":1,"value":null}'}]}),{schemaVersion:1,value:null});
  assert.throws(() => decodeToolResult({structuredContent:{schemaVersion:1,error:{code:'IDENTITY_UNAVAILABLE'}}}),error => isIdentityError(error));
});
test('额度按官方窗口长度选择周额度，零使用率仍可展示', () => {
  assert.equal(chooseQuotaWindow([{kind:'primary',windowMinutes:300,usedPercent:30},{kind:'secondary',windowMinutes:10080,usedPercent:0}]).kind,'secondary');
  assert.equal(chooseQuotaWindow([{kind:'primary',windowMinutes:300,usedPercent:30}]).kind,'primary');
  assert.equal(chooseQuotaWindow([{usedPercent:null}]),null);
});
test('标题与项目名称中的标记只作为文本展示', () => {
  assert.equal(escapeHtml('<img src="x" onerror="x">'), '&lt;img src=&quot;x&quot; onerror=&quot;x&quot;&gt;');
});
test('官方趋势跨缺失与未知日期断开，真实零保留，单点独立成段', () => {
  const segments = trendSegments([{date:'2026-11-07',tokens:90},{date:'2026-11-03',tokens:20},{date:'2026-11-04',tokens:0},{date:'2026-11-05',tokens:null},{date:'2026-11-01',tokens:10},{date:'2026-11-09',tokens:99}], '2026-11-01','2026-11-07');
  assert.deepEqual(segments.map(segment => segment.map(row => row.date)),[['2026-11-01'],['2026-11-03','2026-11-04'],['2026-11-07']]);
  assert.equal(segments[1][1].tokens,0);
  assert.deepEqual(trendSegments(null,'2026-11-01','2026-11-07'),[]);
});
test('微小非零占比不显示为零，HTML使用时可安全转义', () => {
  assert.equal(formatPercent(1,100000),'<0.1%');
  assert.equal(formatPercent(1,1000),'0.1%');
  assert.equal(formatPercent(0,100000),'0.0%');
  assert.equal(formatPercent(100,100),'100.0%');
  assert.equal(formatPercent(null,100),'—');
  assert.equal(formatPercent(0,0),'—');
  assert.equal(escapeHtml(formatPercent(1,100000)),'&lt;0.1%');
});
test('覆盖说明按范围与读取分组，通用warning去重而独特中文错误保留', () => {
  const notes = coverageNotes({status:'partial',coverage:{attributedThreads:411,unassignedAccountThreads:1882,excludedAccountThreads:383,failedThreads:2,partialRollouts:12},warnings:['未确认账号归属的历史会话已排除。','其他账号的本机会话已排除。','部分会话只有可确认的新增用量，统计可能不完整。','部分本机会话暂时无法读取。','ROLL_OUT_FAILED','统计目录暂时不可读。','统计目录暂时不可读。']});
  assert.equal(notes.length,3);
  assert.match(notes[0],/统计范围：当前账号 411 条/);
  assert.match(notes[1],/读取失败 2 条；部分覆盖 12 条/);
  assert.equal(notes[2],'统计目录暂时不可读。');
  assert.equal(notes.join('').includes('ROLL_OUT_FAILED'),false);
});
