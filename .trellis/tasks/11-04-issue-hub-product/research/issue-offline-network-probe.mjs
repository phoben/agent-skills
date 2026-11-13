import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { createGithubClient } from '../../../../packages/issue-hub/src/github/client.mjs';
import { createHash } from 'node:crypto';

// 只读指定Issue，错误仅保留类别；不输出凭据、正文或原始stderr。
const label = process.argv[2] || 'current';
if(label==='no-proxy')for(const key of Object.keys(process.env))if(['http_proxy','https_proxy','all_proxy','no_proxy'].includes(key.toLowerCase()))delete process.env[key];
const report = { label, readOnly: true, privateContentPrinted: false, proxyEnvironment: Object.fromEntries(['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','GH_HOST'].map(key => [key, Boolean(process.env[key])])), requests: [], failure: null };
const run = (args, input, options) => new Promise((resolve, reject) => {
  const start = Date.now();
  const child = execFile(options.command, args, { encoding: 'utf8', shell: false, windowsHide: true, timeout: options.timeout, maxBuffer: options.maxBuffer, env: { ...process.env, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0', GH_PAGER: 'cat', NO_COLOR: '1' } }, (error, stdout, stderr) => {
    if (args[0] === 'api') report.requests.push({ endpoint: args.at(-1), elapsedMs: Date.now()-start, success: !error, exitCode: error?.code ?? 0, timeout: Boolean(error?.killed || error?.code === 'ETIMEDOUT'), dns: /no such host|ENOTFOUND|name resolution/i.test(stderr || ''), proxy: /proxyconnect|proxy error|proxy.*refused/i.test(stderr || ''), connection: /refused|reset|EOF|connectex/i.test(stderr || ''), tls: /certificate|TLS|SSL/i.test(stderr || ''), httpStatus: Number(/^HTTP\/[\d.]+\s+(\d+)/.exec(stdout || '')?.[1]) || null });
    if(error){ error.stdout=stdout;error.stderr=stderr;reject(error); }else resolve({stdout,stderr});
  });
  child.stdin.on('error',()=>{});child.stdin.end(input || '');
});
try {
  const client=createGithubClient({run,timeout:7000});
  await client.identity(); report.identityVerified=true;
  const repository=await client.request('GET','/repos/phoben/aoy-erp');report.repositoryKey=createHash('sha256').update(`github.com:id:${repository.data.id}`).digest('hex').slice(0,20);
  const result=await client.request('GET','/repos/phoben/aoy-erp/issues/185');
  report.issue={number:result.data.number,bodyPresent:typeof result.data.body==='string'&&result.data.body.length>0};report.passed=true;
}catch(error){report.failure={code:error.code||'PROBE_FAILED',message:error.message};report.passed=false;}
await writeFile(new URL(`./issue-offline-network-${label}.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
