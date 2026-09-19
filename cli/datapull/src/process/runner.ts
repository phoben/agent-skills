import { execa, type Options } from "execa";
import { DataPullError } from "../core/errors.js";

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  timeoutMs?: number;
  secrets?: string[];
  outputDecoder?: (value: Uint8Array, stream: "stdout" | "stderr") => string;
}

export interface RunResult {
  stdout: string;
  stderr: string;
}

export async function runProcess(
  command: string,
  args: string[],
  options: RunOptions = {},
): Promise<RunResult> {
  const execaOptions: Options = {
    reject: false,
    windowsHide: true,
    ...(options.outputDecoder === undefined ? {} : { encoding: "buffer" as const }),
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.input === undefined ? {} : { input: options.input }),
    ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
  };
  const result = await execa(command, args, execaOptions);
  const stdout = decodeOutput(result.stdout, "stdout", options.outputDecoder);
  const stderr = decodeOutput(result.stderr, "stderr", options.outputDecoder);
  if (result.exitCode !== 0) {
    const timedOut = result.timedOut === true;
    const detail = redact(
      [result.shortMessage, stderr, stdout]
        .filter((value) => typeof value === "string" && value.trim().length > 0)
        .join("\n"),
      options.secrets ?? [],
    );
    throw new DataPullError(
      "DATABASE_CLIENT_FAILED",
      timedOut ? `${command} 执行超时。` : `${command} 执行失败。`,
      1,
      {
        command,
        exitCode: result.exitCode,
        timedOut,
        ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
        detail,
      },
    );
  }
  return {
    stdout,
    stderr,
  };
}

export function redact(value: string, secrets: string[]): string {
  return secrets
    .filter((secret) => secret.length > 0)
    .reduce((current, secret) => current.split(secret).join("***"), value);
}

function normalizeOutput(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).join("\n");
  return value === undefined ? "" : String(value);
}

function decodeOutput(
  value: unknown,
  stream: "stdout" | "stderr",
  decoder: RunOptions["outputDecoder"],
): string {
  if (decoder !== undefined && value instanceof Uint8Array) return decoder(value, stream);
  return normalizeOutput(value);
}
