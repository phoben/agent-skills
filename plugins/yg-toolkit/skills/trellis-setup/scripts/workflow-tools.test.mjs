import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { discoverWorkflows } from './workflow-tools.mjs';
import { discoverWorkflows as issueDiscovery } from '../../issue-triage/scripts/issue-tools.mjs';

const entry = fileURLToPath(new URL('./workflow-tools.mjs', import.meta.url));

test('Trellis 独立入口只读发现，Issue 工具保持同一个发现实现', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'trellis-setup-discover-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cli = (...args) => spawnSync(process.execPath, [entry, ...args], { cwd: tmpdir(), encoding: 'utf8' });
  const local = () => {
    const result = cli('discover', '--root', root);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  assert.equal(issueDiscovery, discoverWorkflows);
  assert.equal(local().adapter, 'native');
  assert.equal(local().read_only, true);
  const variants = join(root, '.trellis', 'workflows');
  mkdirSync(variants, { recursive: true });
  writeFileSync(join(dirname(variants), 'workflow.md'), '# 日常开发\n\n## 适用场景\n日常缺陷\n');
  const task = join(root, '.trellis', 'tasks', 'current', 'task.json');
  mkdirSync(dirname(task), { recursive: true });
  writeFileSync(task, '{"id":"current","workflow":"daily"}');
  const variant = join(variants, 'conflict.md');
  writeFileSync(variant, '# 处理冲突\n\n## 适用场景\nPR 冲突\n\n## 执行步骤\n正文');
  const before = readFileSync(task);
  const first = local();
  assert.equal(first.adapter, 'trellis');
  assert.ok(first.warnings.some(text => text.includes('原生')));
  assert.equal(first.candidates.find(item => item.id === 'conflict').first_section, '## 适用场景\nPR 冲突');
  renameSync(variant, join(variants, 'merge.md'));
  assert.deepEqual(local().candidates.filter(item => item.id).map(item => item.id), ['merge']);
  assert.deepEqual(readFileSync(task), before);
  assert.notEqual(cli('discover').status, 0);
  assert.notEqual(cli('discover', '--root', root, '--apply').status, 0);
});
