import { execa, type Options } from "execa";
import { DataPullError } from "../core/errors.js";

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  timeoutMs?: number;
  secrets?: string[];
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
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.env === undefined ? {} : { env: options.env }),
    ...(options.input === undefined ? {} : { input: options.input }),
    ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
  };
  const result = await execa(command, args, execaOptions);
  if (result.exitCode !== 0) {
    const detail = redact(`${result.stderr}\n${result.stdout}`.trim(), options.secrets ?? []);
    throw new DataPullError(
      "DATABASE_CLIENT_FAILED",
      `${command} 执行失败。`,
      1,
      { command, exitCode: result.exitCode, detail },
    );
  }
  return {
    stdout: normalizeOutput(result.stdout),
    stderr: normalizeOutput(result.stderr),
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
