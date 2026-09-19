import type { DatabaseExporter } from "../exporters/exporter.js";
import type { DatabaseObject, ResolvedConnection } from "../types.js";
import type {
  DatabaseConnectionProbe,
  DatabaseProvider,
  DatabaseProviderManifest,
  ExportReadinessOptions,
} from "./provider.js";
import { ProviderRuntime } from "./runtime.js";
import type { DataPullError } from "../core/errors.js";

export type TransientErrorClassifier = (error: DataPullError) => boolean;

/**
 * 复用已经过验证的数据库导出器，并把它们收敛到统一 Provider 生命周期。
 */
export class ExporterProviderAdapter implements DatabaseProvider {
  constructor(
    readonly manifest: DatabaseProviderManifest,
    private readonly exporter: DatabaseExporter,
    private readonly isTransient: TransientErrorClassifier = () => false,
    private readonly runtime = new ProviderRuntime(),
  ) {}

  listDatabases(connection: ResolvedConnection): Promise<string[]> {
    return this.runtime.read(
      { providerId: this.manifest.id, operation: "listDatabases" },
      async () => this.exporter.listDatabases(connection),
      this.isTransient,
    );
  }

  probeConnection(connection: ResolvedConnection): Promise<DatabaseConnectionProbe> {
    return this.runtime.read(
      { providerId: this.manifest.id, operation: "probeConnection" },
      async () => this.exporter.test(connection),
      this.isTransient,
    );
  }

  probeExportReadiness(
    connection: ResolvedConnection,
    options: ExportReadinessOptions,
  ): Promise<DatabaseConnectionProbe> {
    return this.runtime.read(
      { providerId: this.manifest.id, operation: "probeExportReadiness" },
      async () => this.exporter.test(connection, options.database),
      this.isTransient,
    );
  }

  async *exportObjects(
    connection: ResolvedConnection,
    database: string,
    objectTypes: readonly string[],
    onStage?: ((stage: string) => void) | undefined,
  ): AsyncIterable<DatabaseObject> {
    const objects = await this.runtime.read(
      { providerId: this.manifest.id, operation: "exportObjects" },
      async () => this.exporter.exportObjects(
        connection,
        database,
        objectTypes,
        onStage,
      ),
      this.isTransient,
    );
    for (const object of objects) {
      yield object;
    }
  }
}
