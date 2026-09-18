import type { DataPullError } from "./errors.js";

export interface OutputOptions {
  command: string;
  json: boolean;
}

export class Output {
  readonly command: string;
  readonly json: boolean;

  constructor(options: OutputOptions) {
    this.command = options.command;
    this.json = options.json;
  }

  info(message: string): void {
    if (this.json) process.stderr.write(`${message}\n`);
    else process.stdout.write(`${message}\n`);
  }

  warn(message: string): void {
    process.stderr.write(`${message}\n`);
  }

  success(payload: object, message?: string): void {
    if (this.json) {
      process.stdout.write(
        `${JSON.stringify({ ok: true, command: this.command, ...payload })}\n`,
      );
      return;
    }
    if (message !== undefined) this.info(message);
  }

  failure(error: DataPullError, extra: Record<string, unknown> = {}): void {
    if (this.json) {
      process.stdout.write(
        `${JSON.stringify({
          ok: false,
          command: this.command,
          ...extra,
          error: {
            code: error.code,
            message: error.message,
            ...(error.details === undefined ? {} : { details: error.details }),
          },
        })}\n`,
      );
      return;
    }
    this.warn(`错误 [${error.code}]：${error.message}`);
    this.writeInstallationGuidance(extra);
  }

  private writeInstallationGuidance(extra: Record<string, unknown>): void {
    const plans = installationPlans(extra);
    const manualRequired = stringArray(extra.manualRequired);
    if (plans.length === 0 && manualRequired.length === 0) return;

    this.warn("手工安装指引（执行前请核对来源与权限）：");
    for (const plan of plans) {
      const tool = stringValue(plan.tool) ?? "未知工具";
      const source = stringValue(plan.source) ?? "未提供";
      const sourceUrl = stringValue(plan.sourceUrl);
      const command = stringValue(plan.command);
      const args = stringArray(plan.args);
      const permission = stringValue(plan.permission) ?? "未提供";
      const downloadImpact = stringValue(plan.downloadImpact) ?? "未提供";
      this.warn(`- 工具：${tool}`);
      this.warn(`  来源：${source}${sourceUrl === undefined ? "" : `（${sourceUrl}）`}`);
      if (command !== undefined) this.warn(`  命令：${[command, ...args].join(" ")}`);
      this.warn(`  权限：${permission}`);
      this.warn(`  下载影响：${downloadImpact}`);
    }
    if (manualRequired.length > 0) {
      this.warn(`- 当前适配器无法自动处理：${manualRequired.join("、")}`);
    }
  }
}

function installationPlans(extra: Record<string, unknown>): Record<string, unknown>[] {
  const direct = recordArray(extra.installation);
  if (direct.length > 0) return direct;
  const actionPlan = recordValue(extra.actionPlan);
  return actionPlan === undefined ? [] : recordArray(actionPlan.installation);
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(recordValue).filter((item): item is Record<string, unknown> => item !== undefined)
    : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
