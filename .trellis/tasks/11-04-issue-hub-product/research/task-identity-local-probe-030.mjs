import { writeFile } from 'node:fs/promises';
import { createHostBridge } from '../../../../packages/issue-hub/src/host/bridge.mjs';

// 真实只读自测只保存成功与版本，不输出身份散列、账户标识或登录内容。
const bridge = createHostBridge();
const result = { readOnly: true, ok: false, version: null };
try {
  const details = await bridge.identityDetails();
  result.ok = typeof details.identity === 'string' && /^[a-f0-9]{64}$/.test(details.identity);
  result.version = details.version;
} catch (error) {
  result.errorCode = typeof error?.code === 'string' ? error.code : 'HOST_IDENTITY_UNAVAILABLE';
} finally { await bridge.close(); }
await writeFile(new URL('./task-identity-local-probe-030.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify({ ok: result.ok, version: result.version }) + '\n');
