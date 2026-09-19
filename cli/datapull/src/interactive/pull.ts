import { confirm, input } from "@inquirer/prompts";
import type { ConnectionService } from "../connections/service.js";
import { OBJECT_TYPES } from "../exporters/objects.js";
import { PullService, type PullExecutionResult } from "../pull/service.js";
import type { ConnectionConfig } from "../types.js";
import { discoverProjectRoot, validatePathSegment } from "../utils/path.js";

interface ImmediatePullOptions {
  trustServerCertificateOnce?: boolean;
  projectRoot?: string;
  pullService?: Pick<PullService, "execute">;
}

export async function promptImmediatePull(
  connections: ConnectionService,
  connection: ConnectionConfig,
  options: ImmediatePullOptions = {},
): Promise<PullExecutionResult | undefined> {
  const approved = await confirm({
    message: "连接已校验通过，是否立即拉取数据库结构？",
    default: true,
  });
  if (!approved) return undefined;

  const database = await input({ message: "目标数据库名：", required: true });
  validatePathSegment(database, "数据库名");
  const selectedTypes = [...OBJECT_TYPES[connection.engine]];
  const projectRoot = options.projectRoot ?? (await discoverProjectRoot());
  process.stdout.write(
    [
      "\n本次操作：",
      `  连接：${connection.alias}`,
      `  数据库：${database}`,
      `  对象类型：${selectedTypes.join("、")}`,
      `  项目根：${projectRoot}`,
      ...(connection.tls?.trustServerCertificate === true ||
      options.trustServerCertificateOnce === true
        ? ["  SQL Server TLS：连接已加密，但不验证服务器身份"]
        : []),
      "  覆盖规则：全部对象类型整体更新；任一类型失败则均不更新。",
    ].join("\n") + "\n",
  );

  const pull = options.pullService ?? new PullService(connections);
  const result = await pull.execute({
    connectionAlias: connection.alias,
    database,
    include: selectedTypes,
    installMissing: false,
    confirmed: true,
    trustServerCertificate: options.trustServerCertificateOnce === true,
    projectRoot,
    onStage: (stage) => {
      process.stdout.write(`• ${stage}\n`);
    },
  });
  process.stdout.write(
    `\n获取成功：${Object.values(result.objectCounts).reduce((sum, count) => sum + count, 0)} 个对象\n` +
      `输出目录：${result.outputPath}\n` +
      `已更新：${result.updatedTypes.join("、")}\n` +
      `已保留：${result.preservedTypes.join("、") || "无"}\n` +
      (result.warnings ?? []).map((warning) => `警告：${warning}\n`).join(""),
  );
  return result;
}
