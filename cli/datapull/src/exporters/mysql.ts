import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm, writeFile } from "node:fs/promises";
import { DataPullError } from "../core/errors.js";
import { CredentialSecurity } from "../config/security.js";
import { runProcess } from "../process/runner.js";
import type { DatabaseObject, ResolvedConnection } from "../types.js";
import type { DatabaseConnectionTest, DatabaseExporter } from "./exporter.js";
import { ensureStatement, quoteMysqlIdentifier, quoteSqlLiteral } from "./sql.js";

export class MySqlExporter implements DatabaseExporter {
  constructor(private readonly security = new CredentialSecurity()) {}

  async listDatabases(connection: ResolvedConnection): Promise<string[]> {
    return this.withOptionFile(connection, undefined, async (optionFile) => {
      const rows = await this.query(
        optionFile,
        "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA " +
          "WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys') " +
          "ORDER BY SCHEMA_NAME",
        connection,
      );
      return rows.map((row) => row[0]).filter((value): value is string => value !== undefined);
    });
  }

  async test(
    connection: ResolvedConnection,
    database?: string,
  ): Promise<DatabaseConnectionTest> {
    return this.withOptionFile(connection, database, async (optionFile) => {
      const rows = await this.query(optionFile, "SELECT VERSION()", connection);
      const serverVersion = rows[0]?.[0];
      if (serverVersion === undefined || serverVersion.length === 0) {
        throw new DataPullError("DATABASE_CLIENT_FAILED", "MySQL 未返回服务端版本。", 1);
      }
      return { serverVersion };
    });
  }

  async exportObjects(
    connection: ResolvedConnection,
    database: string,
    objectTypes: readonly string[],
  ): Promise<DatabaseObject[]> {
    return this.withOptionFile(connection, database, async (optionFile) => {
      const objects: DatabaseObject[] = [];
      const selected = new Set(objectTypes);
      if (selected.has("table") || selected.has("view")) {
        const relations = await this.query(
          optionFile,
          `SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=${quoteSqlLiteral(database)} ORDER BY TABLE_NAME`,
          connection,
        );
        for (const [name, kind] of relations) {
          if (name === undefined || kind === undefined) continue;
          const type = kind === "BASE TABLE" ? "table" : "view";
          if (!selected.has(type)) continue;
          const row = await this.firstRow(
            optionFile,
            `SHOW CREATE ${type === "table" ? "TABLE" : "VIEW"} ${quoteMysqlIdentifier(name)}`,
            connection,
          );
          objects.push({
            type,
            name,
            ddl: ensureStatement(stripMysqlDefiner(requiredColumn(row, 1, name))),
          });
        }
      }
      if (selected.has("function") || selected.has("procedure")) {
        const routines = await this.query(
          optionFile,
          `SELECT ROUTINE_NAME, ROUTINE_TYPE FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA=${quoteSqlLiteral(database)} ORDER BY ROUTINE_TYPE, ROUTINE_NAME`,
          connection,
        );
        for (const [name, routineType] of routines) {
          if (name === undefined || routineType === undefined) continue;
          const type = routineType.toLocaleLowerCase("en-US");
          if (!selected.has(type)) continue;
          const row = await this.firstRow(
            optionFile,
            `SHOW CREATE ${routineType} ${quoteMysqlIdentifier(name)}`,
            connection,
          );
          objects.push({
            type,
            name,
            ddl: ensureStatement(stripMysqlDefiner(requiredColumn(row, 2, name)), true),
          });
        }
      }
      if (selected.has("trigger")) {
        const names = await this.singleColumn(
          optionFile,
          `SELECT TRIGGER_NAME FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA=${quoteSqlLiteral(database)} ORDER BY TRIGGER_NAME`,
          connection,
        );
        for (const name of names) {
          const row = await this.firstRow(
            optionFile,
            `SHOW CREATE TRIGGER ${quoteMysqlIdentifier(name)}`,
            connection,
          );
          objects.push({
            type: "trigger",
            name,
            ddl: ensureStatement(stripMysqlDefiner(requiredColumn(row, 2, name)), true),
          });
        }
      }
      if (selected.has("event")) {
        const names = await this.singleColumn(
          optionFile,
          `SELECT EVENT_NAME FROM INFORMATION_SCHEMA.EVENTS WHERE EVENT_SCHEMA=${quoteSqlLiteral(database)} ORDER BY EVENT_NAME`,
          connection,
        );
        for (const name of names) {
          const row = await this.firstRow(
            optionFile,
            `SHOW CREATE EVENT ${quoteMysqlIdentifier(name)}`,
            connection,
          );
          objects.push({
            type: "event",
            name,
            ddl: ensureStatement(stripMysqlDefiner(requiredColumn(row, 3, name)), true),
          });
        }
      }
      return objects;
    });
  }

  private async withOptionFile<T>(
    connection: ResolvedConnection,
    database: string | undefined,
    action: (optionFile: string) => Promise<T>,
  ): Promise<T> {
    const path = join(tmpdir(), `datapull-mysql-${randomUUID()}.cnf`);
    const lines = [
      "[client]",
      `host=${optionValue(required(connection.host, "host"))}`,
      `port=${connection.port ?? 3306}`,
      `user=${optionValue(connection.username ?? "")}`,
      "default-character-set=utf8mb4",
      ...(database === undefined ? [] : [`database=${optionValue(database)}`]),
      ...(connection.sslMode === undefined
        ? []
        : [`ssl-mode=${optionValue(connection.sslMode)}`]),
      ...(connection.password === undefined
        ? []
        : [`password=${optionValue(connection.password)}`]),
    ];
    await writeFile(path, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
    try {
      await this.security.secureFile(path);
      return await action(path);
    } finally {
      await rm(path, { force: true });
    }
  }

  private async query(
    optionFile: string,
    sql: string,
    connection: ResolvedConnection,
  ): Promise<string[][]> {
    const result = await runProcess(
      "mysql",
      [
        `--defaults-extra-file=${optionFile}`,
        "--batch",
        "--skip-column-names",
        "--execute",
        sql,
      ],
      { timeoutMs: 120_000, secrets: [connection.password ?? "", connection.secretUrl ?? ""] },
    );
    return result.stdout.length === 0
      ? []
      : result.stdout.split(/\r?\n/u).map((line) => parseMysqlRow(line));
  }

  private async firstRow(
    optionFile: string,
    sql: string,
    connection: ResolvedConnection,
  ): Promise<string[]> {
    const row = (await this.query(optionFile, sql, connection))[0];
    if (row === undefined) {
      throw new DataPullError("DATABASE_OBJECT_READ_FAILED", "MySQL 对象 DDL 为空。", 1);
    }
    return row;
  }

  private async singleColumn(
    optionFile: string,
    sql: string,
    connection: ResolvedConnection,
  ): Promise<string[]> {
    return (await this.query(optionFile, sql, connection))
      .map((row) => row[0])
      .filter((value): value is string => value !== undefined);
  }
}

export function stripMysqlDefiner(ddl: string): string {
  return ddl
    .replace(/\s+DEFINER\s*=\s*(?:`[^`]*`|'[^']*'|[^\s]+)@(?:`[^`]*`|'[^']*'|[^\s]+)\s*/giu, " ")
    .replace(/\s+SQL SECURITY DEFINER\b/giu, " SQL SECURITY INVOKER");
}

function optionValue(value: string): string {
  return JSON.stringify(value);
}

function parseMysqlRow(line: string): string[] {
  return line.split("\t").map((value) =>
    value.replace(/\\([0btnrZ\\])/gu, (_match, character: string) => {
      const replacements: Record<string, string> = {
        "0": "\0",
        b: "\b",
        t: "\t",
        n: "\n",
        r: "\r",
        Z: "\u001a",
        "\\": "\\",
      };
      return replacements[character] ?? character;
    }),
  );
}

function required(value: string | undefined, label: string): string {
  if (value !== undefined && value.length > 0) return value;
  throw new DataPullError("CONFIG_INVALID", `MySQL 连接缺少 ${label}。`, 3);
}

function requiredColumn(row: string[], index: number, name: string): string {
  const value = row[index];
  if (value === undefined || value.trim().length === 0) {
    throw new DataPullError(
      "DATABASE_OBJECT_READ_FAILED",
      `MySQL 对象 ${name} 的 DDL 为空。`,
      1,
    );
  }
  return value;
}
