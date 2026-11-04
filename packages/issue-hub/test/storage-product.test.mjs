import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createStorage } from '../src/storage/database.mjs';
import { temporary } from './helpers.mjs';

test('SQLite 隔离身份、重开持久化和事务回滚', async t => {
  let store;
  const directory = await temporary({ after: cleanup => t.after(async () => { store?.close(); await cleanup(); }) }); store = createStorage({ directory });
  store.set('github.com:1', 'draft', 'r#1:issue', { body: '未发布内容' });
  assert.equal(store.get('github.com:2', 'draft', 'r#1:issue'), null);
  assert.throws(() => store.transaction(() => { store.set('github.com:1', 'draft', 'r#1:issue', { body: '不该保存' }); throw new Error('rollback'); }));
  assert.throws(() => store.transaction(() => Promise.resolve()), { code: 'STORAGE_ASYNC_TRANSACTION' });
  store.close(); store = createStorage({ directory });
  assert.equal(store.get('github.com:1', 'draft', 'r#1:issue').body, '未发布内容');
  assert.deepEqual(store.list('github.com:1', 'draft').map(row => row.key), ['r#1:issue']);
});

test('两个进程并发事务不会覆盖彼此写入', async t => {
  let store;
  const directory = await temporary({ after: cleanup => t.after(async () => { store?.close(); await cleanup(); }) }); store = createStorage({ directory });
  store.set('s', 'counter', 'key', 0);
  const moduleUrl = new URL('../src/storage/database.mjs', import.meta.url).href;
  const script = `import {createStorage} from ${JSON.stringify(moduleUrl)};const s=createStorage({directory:${JSON.stringify(directory)}});for(let i=0;i<30;i++)s.transaction(()=>s.set('s','counter','key',s.get('s','counter','key')+1));s.close();`;
  const child = () => new Promise((resolve, reject) => { const process = spawn(globalThis.process.execPath, ['--input-type=module', '-e', script], { windowsHide: true, stdio: 'pipe' }); let stderr = ''; process.stderr.on('data', chunk => stderr += chunk); process.on('error', reject); process.on('exit', code => code === 0 ? resolve() : reject(new Error(stderr))); });
  await Promise.all([child(), child()]); assert.equal(store.get('s', 'counter', 'key'), 60);
});

test('拒绝较新schema以保护回滚数据', async t => {
  const directory = await temporary(t); const database = new DatabaseSync(join(directory, 'issue-hub.sqlite'));
  database.exec('PRAGMA user_version=9'); database.close();
  assert.throws(() => createStorage({ directory }), { code: 'STORAGE_NEWER' });
});
