// 只报告网络错误分类，不输出 gh 响应正文、stderr 原文或凭据。
import { execFile } from 'node:child_process';
const args = ['api', '--hostname', 'github.com', '--method', 'GET', '--include', '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28', '/user'];
const report = await new Promise(resolve => {
  const child = execFile('gh', args, { encoding: 'utf8', shell: false, windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024, env: { ...process.env, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0', GH_PAGER: 'cat', NO_COLOR: '1' } }, (error, stdout, stderr) => {
    const status = /^HTTP\/[\d.]+\s+(\d+)/.exec(stdout || '')?.[1];
    resolve({ exitCode: error?.code || 0, killed: Boolean(error?.killed), signal: error?.signal || null, status: status ? Number(status) : null, stdoutBytes: Buffer.byteLength(stdout || ''), stderrBytes: Buffer.byteLength(stderr || ''), stderrCategories: { dns: /resolve|no such host/i.test(stderr || ''), tls: /certificate|x509|tls/i.test(stderr || ''), proxy: /proxy/i.test(stderr || ''), timeout: /timeout|timed out|deadline exceeded/i.test(stderr || ''), connection: /connect|dial tcp|eof/i.test(stderr || ''), flags: /unknown flag|unknown shorthand/i.test(stderr || '') }, proxyConfigured: Boolean(process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy) });
  });
  child.stdin?.end();
});
process.stdout.write(`${JSON.stringify(report)}\n`);
