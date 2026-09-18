import { DataPullError } from "../core/errors.js";
import { runProcess } from "../process/runner.js";
import type { DatabaseObject, ResolvedConnection } from "../types.js";
import type { DatabaseExporter } from "./exporter.js";
import { ensureStatement, quoteIdentifier } from "./sql.js";

interface NamedRow {
  schema: string;
  name: string;
  identity?: string;
  ddl?: string;
  kind?: string;
}

export class PostgreSqlExporter implements DatabaseExporter {
  async listDatabases(connection: ResolvedConnection): Promise<string[]> {
    const rows = await this.queryJson<string>(
      connection,
      "postgres",
      "SELECT to_json(datname)::text FROM pg_database " +
        "WHERE datallowconn AND NOT datistemplate ORDER BY datname",
    );
    return rows;
  }

  async test(connection: ResolvedConnection, database?: string): Promise<void> {
    await this.queryJson<number>(connection, database ?? "postgres", "SELECT to_json(1)::text");
  }

  async exportObjects(
    connection: ResolvedConnection,
    database: string,
    objectTypes: readonly string[],
  ): Promise<DatabaseObject[]> {
    const selected = new Set(objectTypes);
    const objects: DatabaseObject[] = [];

    if (selected.has("schema")) {
      const rows = await this.namedRows(
        connection,
        database,
        "SELECT json_build_object('schema', nspname, 'name', nspname)::text " +
          "FROM pg_namespace WHERE nspname <> 'information_schema' " +
          "AND nspname !~ '^pg_' ORDER BY nspname",
      );
      objects.push(
        ...rows.map((row) => ({
          type: "schema",
          schema: row.schema,
          name: row.name,
          ddl: `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(row.name)};\n`,
        })),
      );
    }

    if (selected.has("extension")) {
      const rows = await this.namedRows(
        connection,
        database,
        "SELECT json_build_object('schema', n.nspname, 'name', e.extname, " +
          "'ddl', format('CREATE EXTENSION IF NOT EXISTS %I WITH SCHEMA %I VERSION %L;', e.extname, n.nspname, e.extversion))::text " +
          "FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace " +
          "WHERE e.extname <> 'plpgsql' ORDER BY e.extname",
      );
      objects.push(...rows.map((row) => this.fromDdlRow("extension", row)));
    }

    if (selected.has("table") || selected.has("view") || selected.has("materialized_view")) {
      const rows = await this.namedRows(
        connection,
        database,
        "SELECT json_build_object('schema', n.nspname, 'name', c.relname, 'kind', c.relkind, " +
          "'ddl', CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid, true) ELSE NULL END)::text " +
          "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace " +
          "WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_' " +
          "AND c.relkind IN ('r','p','v','m') ORDER BY n.nspname,c.relname",
      );
      for (const row of rows) {
        const type = row.kind === "v" ? "view" : row.kind === "m" ? "materialized_view" : "table";
        if (!selected.has(type)) continue;
        if (type === "table") {
          objects.push({
            type,
            schema: row.schema,
            name: row.name,
            ddl: await this.dumpTable(connection, database, row.schema, row.name),
          });
        } else {
          const keyword = type === "view" ? "VIEW" : "MATERIALIZED VIEW";
          objects.push({
            type,
            schema: row.schema,
            name: row.name,
            ddl: `CREATE ${keyword} ${quoteIdentifier(row.schema)}.${quoteIdentifier(row.name)} AS\n${requiredDdl(row)};\n`,
          });
        }
      }
    }

    if (selected.has("sequence")) {
      const rows = await this.namedRows(
        connection,
        database,
        "SELECT json_build_object('schema', schemaname, 'name', sequencename, " +
          "'ddl', format('CREATE SEQUENCE %I.%I AS %s INCREMENT BY %s MINVALUE %s MAXVALUE %s START WITH %s CACHE %s %s;', " +
          "schemaname, sequencename, data_type, increment_by, min_value, max_value, start_value, cache_size, " +
          "CASE WHEN cycle THEN 'CYCLE' ELSE 'NO CYCLE' END))::text FROM pg_sequences " +
          "WHERE schemaname !~ '^pg_' AND schemaname <> 'information_schema' ORDER BY schemaname,sequencename",
      );
      objects.push(...rows.map((row) => this.fromDdlRow("sequence", row)));
    }

    if (selected.has("function") || selected.has("procedure")) {
      const rows = await this.namedRows(
        connection,
        database,
        "SELECT json_build_object('schema', n.nspname, 'name', p.proname, " +
          "'identity', format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)), " +
          "'kind', p.prokind, 'ddl', pg_get_functiondef(p.oid))::text " +
          "FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace " +
          "WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_' " +
          "AND p.prokind IN ('f','p') ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)",
      );
      for (const row of rows) {
        const type = row.kind === "p" ? "procedure" : "function";
        if (selected.has(type)) objects.push(this.fromDdlRow(type, row));
      }
    }

    if (selected.has("trigger")) {
      const rows = await this.namedRows(
        connection,
        database,
        "SELECT json_build_object('schema', n.nspname, 'name', c.relname || '.' || t.tgname, " +
          "'identity', format('%I.%I.%I', n.nspname,c.relname,t.tgname), " +
          "'ddl', pg_get_triggerdef(t.oid, true) || ';')::text " +
          "FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid " +
          "JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal " +
          "AND n.nspname !~ '^pg_' ORDER BY n.nspname,c.relname,t.tgname",
      );
      objects.push(...rows.map((row) => this.fromDdlRow("trigger", row)));
    }

    if (selected.has("type")) {
      objects.push(...(await this.exportTypes(connection, database)));
    }

    return objects;
  }

  private async exportTypes(
    connection: ResolvedConnection,
    database: string,
  ): Promise<DatabaseObject[]> {
    const queries = [
      "SELECT json_build_object('schema', n.nspname, 'name', t.typname, " +
        "'ddl', format('CREATE TYPE %I.%I AS ENUM (%s);', n.nspname,t.typname, " +
        "(SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid)))::text " +
        "FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typtype='e' " +
        "AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' ORDER BY n.nspname,t.typname",
      "SELECT json_build_object('schema', n.nspname, 'name', t.typname, " +
        "'ddl', format('CREATE DOMAIN %I.%I AS %s%s%s%s;', n.nspname,t.typname,format_type(t.typbasetype,t.typtypmod), " +
        "CASE WHEN t.typdefault IS NULL THEN '' ELSE ' DEFAULT ' || t.typdefault END, " +
        "CASE WHEN t.typnotnull THEN ' NOT NULL' ELSE '' END, " +
        "COALESCE((SELECT string_agg(' CONSTRAINT ' || quote_ident(c.conname) || ' ' || pg_get_constraintdef(c.oid), '' ORDER BY c.conname) " +
        "FROM pg_constraint c WHERE c.contypid=t.oid), '')))::text " +
        "FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typtype='d' " +
        "AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' ORDER BY n.nspname,t.typname",
      "SELECT json_build_object('schema', n.nspname, 'name', t.typname, " +
        "'ddl', format('CREATE TYPE %I.%I AS (%s);', n.nspname,t.typname, " +
        "(SELECT string_agg(format('%I %s', a.attname, format_type(a.atttypid,a.atttypmod)), ', ' ORDER BY a.attnum) " +
        "FROM pg_attribute a WHERE a.attrelid=t.typrelid AND a.attnum>0 AND NOT a.attisdropped)))::text " +
        "FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_class c ON c.oid=t.typrelid " +
        "WHERE t.typtype='c' AND c.relkind='c' AND n.nspname !~ '^pg_' ORDER BY n.nspname,t.typname",
      "SELECT json_build_object('schema', n.nspname, 'name', t.typname, " +
        "'ddl', format('CREATE TYPE %I.%I AS RANGE (SUBTYPE = %s);', n.nspname,t.typname,format_type(r.rngsubtype,NULL)))::text " +
        "FROM pg_range r JOIN pg_type t ON t.oid=r.rngtypid JOIN pg_namespace n ON n.oid=t.typnamespace " +
        "WHERE n.nspname !~ '^pg_' ORDER BY n.nspname,t.typname",
    ];
    const rows = (await Promise.all(queries.map(async (query) => this.namedRows(connection, database, query)))).flat();
    return rows.map((row) => this.fromDdlRow("type", row));
  }

  private fromDdlRow(type: string, row: NamedRow): DatabaseObject {
    return {
      type,
      schema: row.schema,
      name: row.name,
      ...(row.identity === undefined ? {} : { identity: row.identity }),
      ddl: ensureStatement(requiredDdl(row)),
    };
  }

  private async namedRows(
    connection: ResolvedConnection,
    database: string,
    query: string,
  ): Promise<NamedRow[]> {
    return this.queryJson<NamedRow>(connection, database, query);
  }

  private async queryJson<T>(
    connection: ResolvedConnection,
    database: string,
    query: string,
  ): Promise<T[]> {
    const result = await runProcess(
      "psql",
      [
        "--host",
        required(connection.host, "host"),
        "--port",
        String(connection.port ?? 5432),
        "--username",
        connection.username ?? "",
        "--dbname",
        database,
        "--no-psqlrc",
        "--tuples-only",
        "--no-align",
        "--set",
        "ON_ERROR_STOP=1",
        "--command",
        query,
      ],
      { env: this.environment(connection), timeoutMs: 120_000, secrets: this.secrets(connection) },
    );
    if (result.stdout.trim().length === 0) return [];
    return result.stdout.split(/\r?\n/u).filter(Boolean).map((line) => {
      try {
        return JSON.parse(line) as T;
      } catch (error) {
        throw new DataPullError(
          "DATABASE_CLIENT_FAILED",
          "PostgreSQL 返回了无法解析的 JSON。",
          1,
          { line: line.slice(0, 200) },
          error instanceof Error ? { cause: error } : undefined,
        );
      }
    });
  }

  private async dumpTable(
    connection: ResolvedConnection,
    database: string,
    schema: string,
    name: string,
  ): Promise<string> {
    const pattern = `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`;
    const result = await runProcess(
      "pg_dump",
      [
        "--host",
        required(connection.host, "host"),
        "--port",
        String(connection.port ?? 5432),
        "--username",
        connection.username ?? "",
        "--dbname",
        database,
        "--schema-only",
        "--no-owner",
        "--no-privileges",
        "--strict-names",
        `--table=${pattern}`,
      ],
      { env: this.environment(connection), timeoutMs: 300_000, secrets: this.secrets(connection) },
    );
    const ddl = sanitizePgDump(result.stdout);
    if (ddl.trim().length === 0) {
      throw new DataPullError(
        "DATABASE_OBJECT_READ_FAILED",
        `PostgreSQL 表 ${schema}.${name} 的 DDL 为空。`,
        1,
      );
    }
    return ddl;
  }

  private environment(connection: ResolvedConnection): NodeJS.ProcessEnv {
    return {
      ...process.env,
      ...(connection.password === undefined ? {} : { PGPASSWORD: connection.password }),
    };
  }

  private secrets(connection: ResolvedConnection): string[] {
    return [connection.password ?? "", connection.secretUrl ?? ""];
  }
}

export function sanitizePgDump(value: string): string {
  const statements = value
    .replaceAll("\r\n", "\n")
    .split(/;\n/u)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .filter((statement) => !/\bOWNER\s+TO\b/imu.test(statement))
    .filter((statement) => !/\b(GRANT|REVOKE)\b/imu.test(statement))
    .filter((statement) => !/\bTRIGGER\b/imu.test(statement));
  return `${statements.map((statement) => `${statement};`).join("\n\n")}\n`;
}

function required(value: string | undefined, label: string): string {
  if (value !== undefined && value.length > 0) return value;
  throw new DataPullError("CONFIG_INVALID", `PostgreSQL 连接缺少 ${label}。`, 3);
}

function requiredDdl(row: NamedRow): string {
  if (row.ddl !== undefined && row.ddl.trim().length > 0) return row.ddl;
  throw new DataPullError(
    "DATABASE_OBJECT_READ_FAILED",
    `PostgreSQL 对象 ${row.schema}.${row.name} 的 DDL 为空。`,
    1,
  );
}
