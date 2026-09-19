import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { DataPullError } from "../core/errors.js";
import { runProcess } from "../process/runner.js";
import type { DatabaseObject, ResolvedConnection } from "../types.js";
import type { DatabaseConnectionTest, DatabaseExporter } from "./exporter.js";

interface SmoRecord {
  objectType: string;
  schema?: string | null;
  name: string;
  identity: string;
  file: string;
}

export class SqlServerExporter implements DatabaseExporter {
  async listDatabases(connection: ResolvedConnection): Promise<string[]> {
    const result = await this.sqlcmd(
      connection,
      "master",
      "SET NOCOUNT ON; SELECT name FROM sys.databases WHERE state = 0 AND HAS_DBACCESS(name) = 1 ORDER BY name;",
    );
    return result
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  async test(
    connection: ResolvedConnection,
    database?: string,
  ): Promise<DatabaseConnectionTest> {
    const value = await this.sqlcmd(
      connection,
      database ?? "master",
      "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(128));",
    );
    const serverVersion = value.split(/\r?\n/u).map((line) => line.trim()).find(Boolean);
    if (serverVersion === undefined) {
      throw new DataPullError("DATABASE_CLIENT_FAILED", "SQL Server 未返回服务端版本。", 1);
    }
    return { serverVersion };
  }

  async exportObjects(
    connection: ResolvedConnection,
    database: string,
    objectTypes: readonly string[],
  ): Promise<DatabaseObject[]> {
    await this.test(connection, database);
    const temporary = await mkdtemp(join(tmpdir(), "datapull-sqlserver-"));
    try {
      const script = fileURLToPath(
        new URL("../../resources/export-sqlserver.ps1", import.meta.url),
      );
      await runProcess(
        "pwsh",
        ["-NoProfile", "-NonInteractive", "-File", script, "-OutputDirectory", temporary],
        {
          env: {
            ...process.env,
            DATAPULL_SQLSERVER_HOST: required(connection.host, "host"),
            DATAPULL_SQLSERVER_PORT: String(connection.port ?? 1433),
            DATAPULL_SQLSERVER_DATABASE: database,
            DATAPULL_SQLSERVER_AUTH: connection.authMode,
            DATAPULL_SQLSERVER_USER: connection.username ?? "",
            DATAPULL_SQLSERVER_PASSWORD: connection.password ?? "",
            DATAPULL_SQLSERVER_TYPES: JSON.stringify(objectTypes),
            DATAPULL_SQLSERVER_ENCRYPT: "true",
            DATAPULL_SQLSERVER_TRUST_CERT:
              connection.tls?.trustServerCertificate === true ? "true" : "false",
          },
          timeoutMs: sqlServerExportTimeoutMs(process.env.DATAPULL_SQLSERVER_EXPORT_TIMEOUT_MS),
          secrets: [connection.password ?? "", connection.secretUrl ?? ""],
        },
      );
      const records = JSON.parse(
        await readFile(join(temporary, "objects.json"), "utf8"),
      ) as SmoRecord[];
      const objects: DatabaseObject[] = [];
      for (const record of records) {
        const ddl = (await readFile(join(temporary, record.file), "utf8"))
          .replaceAll("\r\n", "\n")
          .trim();
        if (ddl.length === 0) {
          throw new DataPullError(
            "DATABASE_OBJECT_READ_FAILED",
            `SQL Server 对象 ${record.identity} 的 DDL 为空。`,
            1,
          );
        }
        objects.push({
          type: record.objectType,
          ...(record.schema === undefined || record.schema === null
            ? {}
            : { schema: record.schema }),
          name: record.name,
          identity: record.identity,
          ddl: `${ddl}\n`,
        });
      }
      return objects;
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  }

  private async sqlcmd(
    connection: ResolvedConnection,
    database: string,
    query: string,
  ): Promise<string> {
    const args = sqlcmdQueryArguments(connection, database, query);
    try {
      const result = await runProcess("sqlcmd", args, {
        env: {
          ...process.env,
          ...(connection.password === undefined
            ? {}
            : { SQLCMDPASSWORD: connection.password }),
        },
        timeoutMs: 120_000,
        secrets: [connection.password ?? "", connection.secretUrl ?? ""],
        outputDecoder: decodeSqlcmdOutput,
      });
      return result.stdout;
    } catch (error) {
      if (isSqlServerCertificateError(error)) {
        throw new DataPullError(
          "SQLSERVER_TLS_CERTIFICATE_UNTRUSTED",
          "SQL Server 证书链无法验证。请安装可信 CA 链或修复服务器证书。",
          1,
        );
      }
      throw error;
    }
  }
}

export function sqlcmdQueryArguments(
  connection: Pick<
    ResolvedConnection,
    "host" | "port" | "authMode" | "username" | "tls"
  >,
  database: string,
  query: string,
  platform = process.platform,
): string[] {
  const args = [
    "-S",
    `${required(connection.host, "host")},${connection.port ?? 1433}`,
    "-d",
    database,
    "-N",
    "-b",
    "-h",
    "-1",
    "-W",
    ...(platform === "win32" ? ["-f", "65001"] : []),
    "-Q",
    query,
    ...sqlcmdTrustArguments(connection),
  ];
  if (connection.authMode === "integrated") args.push("-E");
  else args.push("-U", connection.username ?? "");
  return args;
}

export function isSqlServerCertificateError(error: unknown): boolean {
  return (
    error instanceof DataPullError &&
    /certificate|证书|certificate chain|unable to verify|not trusted|untrusted|self[- ]signed/iu.test(
      JSON.stringify(error.details ?? {}),
    )
  );
}

export function decodeSqlcmdOutput(
  value: Uint8Array,
  stream: "stdout" | "stderr",
  platform = process.platform,
  locale = Intl.DateTimeFormat().resolvedOptions().locale,
): string {
  if (platform !== "win32" || stream === "stdout") return new TextDecoder().decode(value);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    // Windows 版 ODBC sqlcmd 的错误流可能仍使用系统 ANSI 代码页。
  }
  return new TextDecoder(windowsAnsiEncoding(locale)).decode(value);
}

function windowsAnsiEncoding(locale: string): string {
  const normalized = locale.toLowerCase();
  if (
    normalized.startsWith("zh-tw") ||
    normalized.startsWith("zh-hk") ||
    normalized.startsWith("zh-mo") ||
    normalized.includes("hant")
  ) {
    return "big5";
  }
  if (normalized.startsWith("zh")) return "gbk";
  if (normalized.startsWith("ja")) return "shift_jis";
  if (normalized.startsWith("ko")) return "euc-kr";
  if (normalized.startsWith("th")) return "windows-874";
  if (/^(ru|uk|be|bg|sr|mk)/u.test(normalized)) return "windows-1251";
  if (/^(cs|pl|hu|sk|sl|hr|ro|sq)/u.test(normalized)) return "windows-1250";
  if (normalized.startsWith("el")) return "windows-1253";
  if (normalized.startsWith("tr")) return "windows-1254";
  if (normalized.startsWith("he")) return "windows-1255";
  if (normalized.startsWith("ar")) return "windows-1256";
  if (/^(et|lv|lt)/u.test(normalized)) return "windows-1257";
  if (normalized.startsWith("vi")) return "windows-1258";
  return "windows-1252";
}

export function sqlcmdTrustArguments(
  connection: Pick<ResolvedConnection, "tls">,
): string[] {
  return connection.tls?.trustServerCertificate === true ? ["-C"] : [];
}

export function sqlServerExportTimeoutMs(value: string | undefined): number {
  if (value === undefined || value.trim().length === 0) return 900_000;
  const timeoutMs = Number(value);
  if (Number.isSafeInteger(timeoutMs) && timeoutMs > 0) return timeoutMs;
  throw new DataPullError(
    "CONFIG_INVALID",
    "DATAPULL_SQLSERVER_EXPORT_TIMEOUT_MS 必须是正整数毫秒值。",
    3,
  );
}

function required(value: string | undefined, label: string): string {
  if (value !== undefined && value.length > 0) return value;
  throw new DataPullError("CONFIG_INVALID", `SQL Server 连接缺少 ${label}。`, 3);
}
