import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, copyFileSync, chmodSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { ProofError, requireValue } from '../errors.mjs';

const SCHEMA_VERSION = 1;
export function createStorage({ directory }) {
  requireValue(typeof directory === 'string' && isAbsolute(directory), 'STORAGE_PATH', '本机数据目录必须是绝对路径。');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = join(directory, 'issue-hub.sqlite');
  const existed = existsSync(filename);
  let database;
  try { database = new DatabaseSync(filename); database.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;'); }
  catch { try { database?.close(); } catch { /* 不覆盖初始化错误。 */ } throw new ProofError('STORAGE_UNAVAILABLE', '本机数据存储不可用，请检查目录权限。'); }
  const version = database.prepare('PRAGMA user_version').get().user_version;
  if (version > SCHEMA_VERSION) { database.close(); throw new ProofError('STORAGE_NEWER', '本机数据来自较新版本，请升级插件后再打开。'); }
  if (version < SCHEMA_VERSION) {
    try {
      // 升级前保留原文件；首次创建空数据库不需要备份。
      if (existed) { database.exec('PRAGMA wal_checkpoint(TRUNCATE)'); copyFileSync(filename, `${filename}.v${version}.backup`); }
      database.exec('BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS entries (scope TEXT NOT NULL, kind TEXT NOT NULL, entry_key TEXT NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(scope, kind, entry_key)); PRAGMA user_version=1; COMMIT;');
    } catch { try { database.exec('ROLLBACK'); } catch { /* 保留原异常。 */ } database.close(); throw new ProofError('STORAGE_MIGRATION', '本机数据升级失败，原数据备份已保留。'); }
  }
  try { chmodSync(filename, 0o600); } catch { /* Windows 权限继承由用户数据目录控制。 */ }
  const getStatement = database.prepare('SELECT value FROM entries WHERE scope=? AND kind=? AND entry_key=?');
  const setStatement = database.prepare('INSERT INTO entries(scope,kind,entry_key,value,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(scope,kind,entry_key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at');
  const removeStatement = database.prepare('DELETE FROM entries WHERE scope=? AND kind=? AND entry_key=?');
  const listStatement = database.prepare('SELECT entry_key,value FROM entries WHERE scope=? AND kind=? ORDER BY entry_key');
  let depth = 0, closed = false;
  function validate(...values) { requireValue(!closed && values.every(value => typeof value === 'string' && value.length > 0 && value.length <= 1024 && !value.includes('\0')), 'STORAGE_KEY', '本机存储作用域无效。'); }
  function decode(raw) { try { return JSON.parse(raw); } catch { throw new ProofError('STORAGE_CORRUPT', '本机数据格式异常，未继续覆盖。'); } }
  function guarded(callback) { try { return callback(); } catch (error) { if (error instanceof ProofError) throw error; throw new ProofError('STORAGE_UNAVAILABLE', '本机数据操作失败，请保留当前输入并重试。'); } }
  function transaction(callback) {
    return guarded(() => {
      const nested = depth > 0, name = `level_${depth}`;
      database.exec(nested ? `SAVEPOINT ${name}` : 'BEGIN IMMEDIATE'); depth++;
      try {
        const value = callback();
        requireValue(!value || typeof value.then !== 'function', 'STORAGE_ASYNC_TRANSACTION', '事务中不能执行异步请求。');
        database.exec(nested ? `RELEASE ${name}` : 'COMMIT'); return value;
      } catch (error) { database.exec(nested ? `ROLLBACK TO ${name}; RELEASE ${name}` : 'ROLLBACK'); throw error; }
      finally { depth--; }
    });
  }
  return {
    filename,
    get(scope, kind, key) { validate(scope, kind, key); return guarded(() => { const row = getStatement.get(scope, kind, key); return row ? decode(row.value) : null; }); },
    set(scope, kind, key, value) {
      validate(scope, kind, key);
      const encoded = JSON.stringify(value);
      requireValue(typeof encoded === 'string' && Buffer.byteLength(encoded) <= 16 * 1024 * 1024, 'STORAGE_VALUE', '本机内容超过可保存大小。');
      return guarded(() => setStatement.run(scope, kind, key, encoded, Date.now()));
    },
    remove(scope, kind, key) { validate(scope, kind, key); return guarded(() => removeStatement.run(scope, kind, key)); },
    list(scope, kind) { validate(scope, kind); return guarded(() => listStatement.all(scope, kind).map(row => ({ key: row.entry_key, value: decode(row.value) }))); },
    transaction,
    close() { if (!closed) { database.close(); closed = true; } },
  };
}
