import { ConnectionService, connectionSecurityWarnings } from "../connections/service.js";
import { DataPullError } from "../core/errors.js";
import { exporterFor } from "../exporters/factory.js";
import { OBJECT_TYPES } from "../exporters/objects.js";
import { OutputTransaction } from "../output/transaction.js";
import { ToolManager, type InstallationResult } from "../tools/manager.js";
import type { PullResult } from "../types.js";
import { discoverProjectRoot, validatePathSegment } from "../utils/path.js";

export interface PullOptions {
  connectionAlias: string;
  database: string;
  include?: readonly string[] | undefined;
  installMissing: boolean;
  confirmed: boolean;
  trustServerCertificate?: boolean | undefined;
  projectRoot?: string | undefined;
  onStage?: ((stage: string) => void) | undefined;
}

export interface PullExecutionResult extends PullResult {
  installation: InstallationResult[];
  warnings?: string[] | undefined;
}

export class PullService {
  constructor(
    readonly connections: ConnectionService,
    readonly tools = new ToolManager(),
  ) {}

  async execute(options: PullOptions): Promise<PullExecutionResult> {
    validatePathSegment(options.database, "数据库名");
    const connection = await this.connections.get(options.connectionAlias);
    if (options.trustServerCertificate === true && connection.engine !== "sqlserver") {
      throw new DataPullError(
        "INVALID_ARGUMENT",
        "--trust-server-certificate 只适用于 SQL Server。",
        2,
      );
    }
    const supported = OBJECT_TYPES[connection.engine];
    const selected = options.include === undefined ? [...supported] : [...new Set(options.include)];
    if (selected.length === 0) {
      throw new DataPullError("INVALID_OBJECT_TYPE", "至少选择一种数据库对象。", 2);
    }
    const invalid = selected.filter((type) => !supported.includes(type));
    if (invalid.length > 0) {
      throw new DataPullError(
        "INVALID_OBJECT_TYPE",
        `当前数据库不支持对象类型：${invalid.join("、")}`,
        2,
        { engine: connection.engine, supported, invalid },
      );
    }
    options.onStage?.("检查数据库工具");
    const installation = await this.tools.ensure(
      connection.engine,
      options.installMissing,
      options.confirmed,
    );
    options.onStage?.("解析连接并校验数据库");
    const resolved = await this.connections.resolve(options.connectionAlias, options.database, {
      ...(options.trustServerCertificate === true
        ? { trustServerCertificate: true }
        : {}),
    });
    const exporter = exporterFor(connection.engine);
    const projectRoot = options.projectRoot ?? (await discoverProjectRoot());
    const transaction = new OutputTransaction({
      projectRoot,
      connectionAlias: connection.alias,
      database: options.database,
      selectedTypes: selected,
    });
    options.onStage?.("准备输出目录与事务锁");
    await transaction.acquire();
    let committed = false;
    const warnings = connectionSecurityWarnings(resolved);
    let result: PullExecutionResult | undefined;
    try {
      await exporter.test(resolved, options.database);
      options.onStage?.("读取元数据并生成 DDL");
      const objects = await exporter.exportObjects(resolved, options.database, selected);
      options.onStage?.("校验暂存结构文件");
      const objectCounts = await transaction.writeObjects(objects);
      options.onStage?.("提交所选对象类型");
      await transaction.commit();
      committed = true;
      try {
        await this.connections.rememberDatabase(connection.alias, options.database);
      } catch (error) {
        warnings.push(
          `结构文件已提交，但无法更新最近使用记录：${error instanceof Error ? error.message : String(error)}`,
        );
      }
      options.onStage?.("清理并生成结果");
      result = {
        connectionAlias: connection.alias,
        engine: connection.engine,
        database: options.database,
        projectRoot,
        outputPath: transaction.targetDirectory,
        updatedTypes: selected,
        preservedTypes: supported.filter((type) => !selected.includes(type)),
        objectCounts,
        installation,
      };
    } catch (error) {
      if (!committed) await transaction.abort();
      throw error;
    } finally {
      try {
        await transaction.release();
      } catch (error) {
        if (!committed) throw error;
        warnings.push(
          `结构文件已提交，但无法清理本地锁：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (result === undefined) {
      throw new DataPullError("UNEXPECTED_ERROR", "拉取操作未生成结果。", 1);
    }
    if (warnings.length > 0) result.warnings = warnings;
    return result;
  }
}
