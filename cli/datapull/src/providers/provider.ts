import type { ToolId } from "../tools/catalog.js";
import type {
  AuthMode,
  DatabaseObject,
  Engine,
  ResolvedConnection,
} from "../types.js";

export type DatabaseObjectCategory = "common" | "advanced";

export interface DatabaseObjectDefinition {
  id: string;
  displayName: string;
  category: DatabaseObjectCategory;
  defaultSelected: boolean;
}

export interface DatabaseProviderManifest {
  id: Engine;
  displayName: string;
  aliases: readonly string[];
  defaultPort: number;
  urlProtocols: readonly string[];
  authModes: readonly AuthMode[];
  tls: {
    supported: boolean;
    trustServerCertificate: boolean;
  };
  objects: readonly DatabaseObjectDefinition[];
  tools: readonly ToolId[];
}

export interface DatabaseConnectionProbe {
  serverVersion: string;
}

export interface ExportReadinessOptions {
  database: string;
  objectTypes: readonly string[];
}

/**
 * 数据库差异只通过该契约暴露；文件事务、配置存储和交互流程由公共层负责。
 */
export interface DatabaseProvider {
  readonly manifest: DatabaseProviderManifest;
  listDatabases(connection: ResolvedConnection): Promise<string[]>;
  probeConnection(connection: ResolvedConnection): Promise<DatabaseConnectionProbe>;
  probeExportReadiness(
    connection: ResolvedConnection,
    options: ExportReadinessOptions,
  ): Promise<DatabaseConnectionProbe>;
  exportObjects(
    connection: ResolvedConnection,
    database: string,
    objectTypes: readonly string[],
    onStage?: ((stage: string) => void) | undefined,
  ): AsyncIterable<DatabaseObject>;
}
