export class ProofError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}

export function safeFailure(error) {
  if (!(error instanceof ProofError)) return { code: 'INTERNAL_ERROR', message: '操作失败，请重新读取后重试。' };
  const result = { code: error.code, message: error.message };
  // 仅投影业务可恢复字段，不输出子进程错误、HTTP 原文或凭据。
  for (const name of ['remote', 'operation', 'retryAt']) if (error[name] !== undefined) result[name] = error[name];
  return result;
}

export function requireValue(condition, code, message) {
  if (!condition) throw new ProofError(code, message);
}
