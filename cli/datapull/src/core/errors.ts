export type ExitCode = 1 | 2 | 3 | 4 | 5;

export class DataPullError extends Error {
  readonly code: string;
  readonly exitCode: ExitCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    exitCode: ExitCode,
    details?: Record<string, unknown>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DataPullError";
    this.code = code;
    this.exitCode = exitCode;
    if (details !== undefined) this.details = details;
  }
}

export function asDataPullError(error: unknown): DataPullError {
  if (error instanceof DataPullError) return error;
  if (isPromptCancellation(error)) {
    return new DataPullError("OPERATION_CANCELLED", "操作已取消。", 1, {
      outputFilesChanged: false,
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  return new DataPullError(
    "UNEXPECTED_ERROR",
    "发生未预期错误，请使用 datapull doctor 检查环境。",
    1,
    { cause: message },
    error instanceof Error ? { cause: error } : undefined,
  );
}

function isPromptCancellation(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "ExitPromptError" || error.message.includes("force closed"))
  );
}
