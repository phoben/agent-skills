import type { DatabaseObject, ResolvedConnection } from "../types.js";

export interface DatabaseExporter {
  listDatabases(connection: ResolvedConnection): Promise<string[]>;
  test(connection: ResolvedConnection, database?: string): Promise<void>;
  exportObjects(
    connection: ResolvedConnection,
    database: string,
    objectTypes: readonly string[],
  ): Promise<DatabaseObject[]>;
}
