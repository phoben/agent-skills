import { DataPullError } from "../core/errors.js";

const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;

export function parseDotenv(content: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const [index, rawLine] of content.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) {
      throw new DataPullError(
        "CONFIG_INVALID",
        `credentials.env 第 ${index + 1} 行格式无效。`,
        3,
      );
    }
    const name = line.slice(0, separator).trim();
    if (!NAME_PATTERN.test(name)) {
      throw new DataPullError(
        "CONFIG_INVALID",
        `credentials.env 第 ${index + 1} 行变量名无效。`,
        3,
      );
    }
    values.set(name, decodeValue(line.slice(separator + 1).trim()));
  }
  return values;
}

export function serializeDotenv(values: Map<string, string>): string {
  return `${[...values.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
    .join("\n")}\n`;
}

export function assertCredentialReference(name: string): void {
  if (!NAME_PATTERN.test(name)) {
    throw new DataPullError(
      "INVALID_ARGUMENT",
      `凭证引用变量名无效：${name}`,
      2,
    );
  }
}

function decodeValue(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed === "string") return parsed;
    } catch {
      throw new DataPullError("CONFIG_INVALID", "credentials.env 引号内容无效。", 3);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value.replace(/\s+#.*$/u, "").trim();
}
