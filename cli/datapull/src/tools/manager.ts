import { execa } from "execa";
import { DataPullError } from "../core/errors.js";
import type { Engine } from "../types.js";
import {
  installationPlan,
  REQUIRED_TOOLS,
  type InstallationPlan,
  type ToolId,
} from "./catalog.js";

export interface ToolStatus {
  tool: ToolId;
  available: boolean;
  version?: string | undefined;
}

export interface InstallationResult extends InstallationPlan {
  status: "installed" | "failed" | "manualRequired";
  recheck: boolean;
  error?: string | undefined;
}

export class ToolManager {
  async inspect(engine: Engine): Promise<ToolStatus[]> {
    return Promise.all(REQUIRED_TOOLS[engine].map(async (tool) => this.detect(tool)));
  }

  async missing(engine: Engine): Promise<ToolId[]> {
    return (await this.inspect(engine))
      .filter((status) => !status.available)
      .map((status) => status.tool);
  }

  plans(tools: ToolId[]): InstallationPlan[] {
    return tools
      .map((tool) => installationPlan(tool))
      .filter((plan): plan is InstallationPlan => plan !== undefined);
  }

  async ensure(engine: Engine, installMissing: boolean, confirmed: boolean): Promise<InstallationResult[]> {
    const missing = await this.missing(engine);
    if (missing.length === 0) return [];
    const plans = this.plans(missing);
    const uncovered = missing.filter((tool) => !plans.some((plan) => plan.tool === tool));
    if (!installMissing) {
      throw new DataPullError(
        "DATABASE_TOOL_MISSING",
        `缺少数据库工具：${missing.join("、")}`,
        4,
        { missingTools: missing, actionPlan: { installation: plans }, manualRequired: uncovered },
      );
    }
    if (!confirmed) {
      throw new DataPullError(
        "CONFIRMATION_REQUIRED",
        "自动安装数据库工具需要显式确认。",
        2,
        { actionPlan: { installation: plans }, manualRequired: uncovered },
      );
    }
    const results: InstallationResult[] = uncovered.map((tool) => ({
      adapterVersion: 1,
      tool,
      source: "未识别的官方安装组合",
      sourceUrl: "",
      command: "",
      args: [],
      permission: "未知",
      downloadImpact: "未知",
      manager: "manual",
      status: "manualRequired",
      recheck: false,
    }));
    for (const plan of plans) {
      if ((await this.detect(plan.tool)).available) {
        results.push({ ...plan, status: "installed", recheck: true });
        continue;
      }
      try {
        const result = await execa(plan.command, plan.args, {
          reject: false,
          windowsHide: true,
        });
        const recheck = (await this.detect(plan.tool)).available;
        results.push({
          ...plan,
          status: result.exitCode === 0 && recheck ? "installed" : "failed",
          recheck,
          ...(result.exitCode === 0 && recheck
            ? {}
            : { error: `${result.stderr || result.stdout}`.trim() }),
        });
      } catch (error) {
        results.push({
          ...plan,
          status: "failed",
          recheck: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const remaining = await this.missing(engine);
    if (remaining.length > 0) {
      throw new DataPullError(
        "DATABASE_TOOL_MISSING",
        `自动安装后仍缺少数据库工具：${remaining.join("、")}`,
        4,
        { installation: results, manualRequired: remaining },
      );
    }
    return results;
  }

  async detect(tool: ToolId): Promise<ToolStatus> {
    if (tool === "sqlserver-module") return this.detectSqlServerModule();
    const args = tool === "sqlcmd" ? ["-?"] : ["--version"];
    try {
      const result = await execa(tool, args, { reject: false, windowsHide: true });
      return {
        tool,
        available: result.exitCode === 0,
        version: `${result.stdout || result.stderr}`.split(/\r?\n/u)[0]?.trim(),
      };
    } catch {
      return { tool, available: false };
    }
  }

  private async detectSqlServerModule(): Promise<ToolStatus> {
    try {
      const result = await execa(
        "pwsh",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "(Get-Module -ListAvailable SqlServer | Sort-Object Version -Descending | Select-Object -First 1).Version.ToString()",
        ],
        { reject: false, windowsHide: true },
      );
      const version = result.stdout.trim();
      return { tool: "sqlserver-module", available: result.exitCode === 0 && version.length > 0, version };
    } catch {
      return { tool: "sqlserver-module", available: false };
    }
  }
}
