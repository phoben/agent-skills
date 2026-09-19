import type { DatabaseObject, ResolvedConnection } from "../types.js";

export interface DatabaseConnectionTest {
  serverVersion: string;
}

export interface DatabaseExporter {
  listDatabases(connection: ResolvedConnection): Promise<string[]>;
  test(
    connection: ResolvedConnection,
    database?: string,
  ): Promise<DatabaseConnectionTest>;
  exportObjects(
    connection: ResolvedConnection,
    database: string,
    objectTypes: readonly string[],
    onStage?: ((stage: string) => void) | undefined,
  ): Promise<DatabaseObject[]>;
}
