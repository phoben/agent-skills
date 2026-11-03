import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let initialized = false;
const lines = createInterface({ input: process.stdin });
lines.on('line', line => {
  const request = JSON.parse(line);
  if (!request.id) return;
  if (request.method === 'initialize') { initialized = true; process.stdout.write(JSON.stringify({ id: request.id, result: {} }) + '\n'); return; }
  if (!initialized) { process.stdout.write(JSON.stringify({ id: request.id, error: { code: -32000, message: '尚未初始化' } }) + '\n'); return; }
  const accountId = JSON.parse(readFileSync(join(process.env.CODEX_HOME, 'auth.json'), 'utf8')).account;
  const result = request.method === 'account/read' ? { account: { type: 'chatgpt', planType: 'pro' } } : request.method === 'account/usage/read' ? { summary: { lifetimeTokens: accountId === 'test-a' ? 100 : 200 }, dailyUsageBuckets: [] } : { accountId, rateLimits: {} };
  process.stdout.write(JSON.stringify({ id: request.id, result }) + '\n');
});
