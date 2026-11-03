import test from 'node:test';
import assert from 'node:assert/strict';
import { projectPresentation, tokenKeys, OTHER_PROJECT_ID } from '../ui/model.mjs';

const project = (id, value, date = '2026-11-03') => ({ id, name:id, sessionCount:1, ...Object.fromEntries(tokenKeys.map(key=>[key,key==='totalTokens'||key==='inputTokens'||key==='uncachedInputTokens'?value:0])),daily:[{date,...Object.fromEntries(tokenKeys.map(key=>[key,key==='totalTokens'||key==='inputTokens'||key==='uncachedInputTokens'?value:0]))}] });
test('严格超过1%才独立显示，等于1%与更小项目合并且计数守恒', () => {
  const source=[project('large',970),project('above',11),project('exact',10),project('tiny',9)];
  const result=projectPresentation(source,1000);
  assert.deepEqual(result.rows.map(row=>row.id),['large','above',OTHER_PROJECT_ID]);
  const other=result.rows.at(-1);
  assert.deepEqual(other.memberIds,['exact','tiny']);assert.equal(other.totalTokens,19);assert.equal(other.sessionCount,2);
  assert.equal(other.daily[0].totalTokens,19);assert.equal(result.rows.reduce((n,p)=>n+p.totalTokens,0),1000);
  assert.equal(source.length,4);assert.equal(source[2].id,'exact');
});
test('展开保留原始项目与总量，缺失日桶不伪造零，未知计数不隐藏', () => {
  const source=[project('large',990),project('first',5,'2026-11-01'),project('second',5,'2026-11-03')];
  assert.deepEqual(projectPresentation(source,1000,true).rows,source);
  const other=projectPresentation(source,1000).rows.at(-1);
  assert.deepEqual(other.daily.map(day=>day.date),['2026-11-01','2026-11-03']);
  const unknown={...project('unknown',1),totalTokens:null};
  assert.ok(projectPresentation([source[0],unknown],1000).rows.some(row=>row.id==='unknown'));
  assert.equal(projectPresentation(source,null).hiddenCount,0);
});
