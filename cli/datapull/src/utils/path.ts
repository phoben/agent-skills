import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { execa } from "execa";
import { DataPullError } from "../core/errors.js";

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const INVALID_SEGMENT = /[<>:"/\\|?*\u0000-\u001f]/gu;

export function validatePathSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized === "." ||
    normalized === ".." ||
    INVALID_SEGMENT.test(normalized) ||
    WINDOWS_RESERVED.test(normalized) ||
    normalized.endsWith(".") ||
    normalized.endsWith(" ")
  ) {
    throw new DataPullError(
      label === "数据库名" ? "INVALID_DATABASE_NAME" : "OUTPUT_PATH_UNSAFE",
      `${label}不是安全的单级路径名称：${value}`,
      label === "数据库名" ? 2 : 5,
    );
  }
  return normalized;
}

export function safeFileName(
  value: string,
  identity: string,
  forceHash = false,
): string {
  let readable = value
    .replace(INVALID_SEGMENT, "_")
    .replace(/\s+/gu, "_")
    .replace(/^[._ ]+|[._ ]+$/gu, "");
  if (readable.length === 0 || WINDOWS_RESERVED.test(readable)) readable = "object";
  if (readable.length > 100) readable = readable.slice(0, 100).replace(/[. ]+$/gu, "");
  const changed = readable !== value;
  if (!changed && !forceHash) return `${readable}.sql`;
  const hash = createHash("sha256").update(identity).digest("hex").slice(0, 10);
  return `${readable}--${hash}.sql`;
}

export async function discoverProjectRoot(start = process.cwd()): Promise<string> {
  try {
    const result = await execa("git", ["rev-parse", "--show-toplevel"], {
      cwd: start,
      reject: true,
    });
    return resolve(result.stdout.trim());
  } catch {
    return resolve(start);
  }
}
