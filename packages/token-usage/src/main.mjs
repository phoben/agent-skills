import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createUsageServer } from './server.mjs';

const version = typeof __YG_VERSION__ === 'string' ? __YG_VERSION__ : '0.2.0';
async function main() { try {
  const html = await readFile(join(dirname(process.argv[1]), 'token-usage.html'), 'utf8');
  const server = createUsageServer({ html, version });
  await server.connect(new StdioServerTransport());
  const close = async () => { await server.close(); };
  process.stdin.once('end', close);
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
} catch {
  process.stderr.write('YG Toolkit 用量服务启动失败，请检查Node版本与插件构建产物。\n');
  process.exitCode = 1;
} }
void main();
