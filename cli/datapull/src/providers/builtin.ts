import { MySqlExporter } from "../exporters/mysql.js";
import {
  isRetryablePostgreSqlClientError,
  PostgreSqlExporter,
} from "../exporters/postgresql.js";
import { SqlServerExporter } from "../exporters/sqlserver.js";
import { ExporterProviderAdapter } from "./adapter.js";
import type { DatabaseObjectDefinition, DatabaseProviderManifest } from "./provider.js";
import { DatabaseProviderRegistry } from "./registry.js";
import { DataPullError } from "../core/errors.js";
import { DATABASE_PROVIDER_IDS } from "./ids.js";

const object = (
  id: string,
  displayName: string,
  category: "common" | "advanced",
  defaultSelected = ["table", "view", "function"].includes(id),
): DatabaseObjectDefinition => ({ id, displayName, category, defaultSelected });

export const MYSQL_PROVIDER_MANIFEST = {
  id: "mysql",
  displayName: "MySQL",
  aliases: [],
  defaultPort: 3306,
  urlProtocols: ["mysql:"],
  authModes: ["password", "url"],
  tls: { supported: true, trustServerCertificate: false },
  objects: [
    object("table", "数据表(Table)", "common"),
    object("view", "视图(View)", "common"),
    object("function", "函数(Function)", "common"),
    object("procedure", "存储过程(Procedure)", "common"),
    object("trigger", "触发器(Trigger)", "advanced"),
    object("event", "事件(Event)", "advanced"),
  ],
  tools: ["mysql"],
} as const satisfies DatabaseProviderManifest;

export const POSTGRESQL_PROVIDER_MANIFEST = {
  id: "postgresql",
  displayName: "PostgreSQL",
  aliases: ["postgres"],
  defaultPort: 5432,
  urlProtocols: ["postgres:", "postgresql:"],
  authModes: ["password", "url"],
  tls: { supported: true, trustServerCertificate: false },
  objects: [
    object("schema", "模式(Schema)", "common", false),
    object("extension", "扩展(Extension)", "advanced", false),
    object("table", "数据表(Table)", "common"),
    object("view", "视图(View)", "common"),
    object("materialized_view", "物化视图(Materialized View)", "advanced", false),
    object("sequence", "序列(Sequence)", "advanced", false),
    object("function", "函数(Function)", "common"),
    object("procedure", "存储过程(Procedure)", "common", false),
    object("trigger", "触发器(Trigger)", "advanced", false),
    object("type", "类型(Type)", "advanced", false),
  ],
  tools: ["psql", "pg_dump"],
} as const satisfies DatabaseProviderManifest;

export const SQLSERVER_PROVIDER_MANIFEST = {
  id: "sqlserver",
  displayName: "SQL Server",
  aliases: ["mssql"],
  defaultPort: 1433,
  urlProtocols: ["sqlserver:", "mssql:"],
  authModes: ["password", "url", "integrated"],
  tls: { supported: true, trustServerCertificate: true },
  objects: [
    object("schema", "模式(Schema)", "common", false),
    object("table", "数据表(Table)", "common"),
    object("view", "视图(View)", "common"),
    object("function", "函数(Function)", "common"),
    object("procedure", "存储过程(Procedure)", "common", false),
    object("trigger", "触发器(Trigger)", "advanced", false),
    object("sequence", "序列(Sequence)", "advanced", false),
    object("synonym", "同义词(Synonym)", "advanced", false),
    object("type", "类型(Type)", "advanced", false),
  ],
  tools: ["sqlcmd", "pwsh", "sqlserver-module"],
} as const satisfies DatabaseProviderManifest;

export const databaseProviders = new DatabaseProviderRegistry([
  new ExporterProviderAdapter(
    MYSQL_PROVIDER_MANIFEST,
    new MySqlExporter(),
    mysqlTransientError,
  ),
  new ExporterProviderAdapter(
    POSTGRESQL_PROVIDER_MANIFEST,
    new PostgreSqlExporter(),
    postgresqlTransientError,
  ),
  new ExporterProviderAdapter(
    SQLSERVER_PROVIDER_MANIFEST,
    new SqlServerExporter(),
    sqlServerTransientError,
  ),
]);

for (const providerId of DATABASE_PROVIDER_IDS) {
  if (!databaseProviders.has(providerId)) {
    throw new DataPullError(
      "PROVIDER_REGISTRY_INVALID",
      `内置数据库 Provider 未登记：${providerId}`,
      3,
    );
  }
}

function mysqlTransientError(error: DataPullError): boolean {
  return transientClientFailure(error, /\b(2006|2013|1040)\b|server has gone away|lost connection|too many connections/iu);
}

function postgresqlTransientError(error: DataPullError): boolean {
  const command = error.details?.command;
  return command === "psql" || command === "pg_dump"
    ? isRetryablePostgreSqlClientError(error, command)
    : false;
}

function sqlServerTransientError(error: DataPullError): boolean {
  return transientClientFailure(error, /transport-level error|connection (?:was )?(?:reset|closed)|timeout expired|forcibly closed/iu);
}

function transientClientFailure(error: DataPullError, vendorPattern: RegExp): boolean {
  if (error.code !== "DATABASE_CLIENT_FAILED") return false;
  if (error.details?.timedOut === true) return true;
  const detail = String(error.details?.detail ?? "");
  if (/authentication|access denied|password|login failed|permission|certificate|syntax/iu.test(detail)) {
    return false;
  }
  return vendorPattern.test(detail);
}
