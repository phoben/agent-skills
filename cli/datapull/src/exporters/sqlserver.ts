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
          timeoutMs: 900_000,
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
      "-Q",
      query,
    ];
    args.push(...sqlcmdTrustArguments(connection));
    if (connection.authMode === "integrated") args.push("-E");
    else args.push("-U", connection.username ?? "");
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
      });
      return result.stdout;
    } catch (error) {
      if (
        error instanceof DataPullError &&
        /certificate|证书|certificate chain|unable to verify/iu.test(
          JSON.stringify(error.details ?? {}),
        )
      ) {
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

export function sqlcmdTrustArguments(
  connection: Pick<ResolvedConnection, "tls">,
): string[] {
  return connection.tls?.trustServerCertificate === true ? ["-C"] : [];
}

function required(value: string | undefined, label: string): string {
  if (value !== undefined && value.length > 0) return value;
  throw new DataPullError("CONFIG_INVALID", `SQL Server 连接缺少 ${label}。`, 3);
}
