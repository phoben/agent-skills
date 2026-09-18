import type { Engine } from "../types.js";
import type { DatabaseExporter } from "./exporter.js";
import { MySqlExporter } from "./mysql.js";
import { PostgreSqlExporter } from "./postgresql.js";
import { SqlServerExporter } from "./sqlserver.js";

export function exporterFor(engine: Engine): DatabaseExporter {
  if (engine === "mysql") return new MySqlExporter();
  if (engine === "postgresql") return new PostgreSqlExporter();
  return new SqlServerExporter();
}
