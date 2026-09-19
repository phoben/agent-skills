import { DataPullError, asDataPullError } from "../core/errors.js";
import type { Engine } from "../types.js";

export interface ProviderOperationContext {
  providerId: Engine;
  operation: string;
}

export interface ProviderRuntimeOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  delay?: (milliseconds: number) => Promise<void>;
}

/**
 * Provider 公共运行策略。只重试由数据库适配器明确判定为瞬态的只读操作。
 */
export class ProviderRuntime {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly delay: (milliseconds: number) => Promise<void>;

  constructor(options: ProviderRuntimeOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 250;
    this.delay = options.delay ?? wait;
  }

  async read<T>(
    context: ProviderOperationContext,
    action: () => Promise<T>,
    isTransient: (error: DataPullError) => boolean,
  ): Promise<T> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await action();
      } catch (error) {
        const normalized = asDataPullError(error);
        const retryable = attempt < this.maxAttempts && isTransient(normalized);
        if (!retryable) {
          throw enrichError(normalized, context, attempt);
        }
        await this.delay(this.baseDelayMs * attempt);
      }
    }
    throw new DataPullError("UNEXPECTED_ERROR", "数据库读取重试未生成结果。", 1);
  }
}

function enrichError(
  error: DataPullError,
  context: ProviderOperationContext,
  attempt: number,
): DataPullError {
  return new DataPullError(
    error.code,
    error.message,
    error.exitCode,
    {
      ...error.details,
      providerId: context.providerId,
      operation: context.operation,
      attempt,
    },
    { cause: error },
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
