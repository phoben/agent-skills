import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
export async function temporary(t) {
  const path = await mkdtemp(join(tmpdir(), 'issue-hub-test-'));
  t.after(async () => { if (!resolve(path).startsWith(`${resolve(tmpdir())}${sep}`)) throw new Error('测试清理路径越界'); await rm(path, { recursive: true, force: true }); });
  return path;
}
export const repositoryKey = 'a'.repeat(20);
export const workspaceKey = 'b'.repeat(20);
export const firstThread = '11111111-1111-4111-8111-111111111111';
export const secondThread = '22222222-2222-4222-8222-222222222222';
