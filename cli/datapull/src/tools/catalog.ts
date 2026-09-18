import type { Engine } from "../types.js";
import { readFileSync } from "node:fs";

export type ToolId =
  | "mysql"
  | "psql"
  | "pg_dump"
  | "sqlcmd"
  | "pwsh"
  | "sqlserver-module";

export const INSTALL_ADAPTER_VERSION = 1;

export interface InstallationPlan {
  adapterVersion: number;
  tool: ToolId;
  source: string;
  sourceUrl: string;
  command: string;
  args: string[];
  permission: string;
  downloadImpact: string;
  manager: string;
}

export const REQUIRED_TOOLS: Record<Engine, readonly ToolId[]> = {
  mysql: ["mysql"],
  postgresql: ["psql", "pg_dump"],
  sqlserver: ["sqlcmd", "pwsh", "sqlserver-module"],
};

export function installationPlan(
  tool: ToolId,
  platform = process.platform,
  distro = process.env.DATAPULL_LINUX_DISTRO ?? detectLinuxDistribution(),
): InstallationPlan | undefined {
  if (tool === "sqlserver-module") {
    return {
      adapterVersion: INSTALL_ADAPTER_VERSION,
      tool,
      source: "PowerShell Gallery / Microsoft SqlServer 模块",
      sourceUrl: "https://learn.microsoft.com/powershell/sql-server/download-sql-server-ps-module",
      command: "pwsh",
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Install-Module SqlServer -Scope CurrentUser -Force",
      ],
      permission: "当前用户 PowerShell 模块目录写权限",
      downloadImpact: "下载并安装 Microsoft SqlServer PowerShell 模块及其依赖",
      manager: "PowerShellGet",
    };
  }
  if (platform === "win32") return windowsPlan(tool);
  if (platform === "darwin") return brewPlan(tool);
  if (platform === "linux") {
    if (distro === "fedora") return linuxPlan(tool, "dnf");
    if (distro === "ubuntu" || distro === "debian") return linuxPlan(tool, "apt");
    return undefined;
  }
  return undefined;
}

function detectLinuxDistribution(): string | undefined {
  if (process.platform !== "linux") return undefined;
  try {
    const content = readFileSync("/etc/os-release", "utf8");
    return content.match(/^ID=(?:"([^"]+)"|([^\n]+))$/mu)?.slice(1).find(Boolean);
  } catch {
    return undefined;
  }
}

function windowsPlan(tool: ToolId): InstallationPlan | undefined {
  const packages: Partial<Record<ToolId, string>> = {
    mysql: "Oracle.MySQL",
    psql: "PostgreSQL.PostgreSQL.18",
    pg_dump: "PostgreSQL.PostgreSQL.18",
    sqlcmd: "Microsoft.Sqlcmd",
    pwsh: "Microsoft.PowerShell",
  };
  const packageId = packages[tool];
  if (packageId === undefined) return undefined;
  return {
    adapterVersion: INSTALL_ADAPTER_VERSION,
    tool,
    source: `winget 官方源 / ${packageId}`,
    sourceUrl:
      tool === "sqlcmd"
        ? "https://learn.microsoft.com/sql/tools/sqlcmd/sqlcmd-download-install"
        : tool === "pwsh"
          ? "https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows"
          : tool === "mysql"
            ? "https://dev.mysql.com/doc/mysql-installation-excerpt/8.4/en/windows-installation.html"
            : "https://www.postgresql.org/download/windows/",
    command: "winget",
    args: [
      "install",
      "--id",
      packageId,
      "--exact",
      "--accept-package-agreements",
      "--accept-source-agreements",
    ],
    permission: "winget 可能请求管理员授权并修改 PATH",
    downloadImpact: "下载并安装数据库厂商客户端软件",
    manager: "winget",
  };
}

function brewPlan(tool: ToolId): InstallationPlan | undefined {
  const packages: Partial<Record<ToolId, string[]>> = {
    mysql: ["install", "mysql-client"],
    psql: ["install", "libpq"],
    pg_dump: ["install", "libpq"],
    sqlcmd: ["install", "sqlcmd"],
    pwsh: ["install", "--cask", "powershell"],
  };
  const args = packages[tool];
  if (args === undefined) return undefined;
  return {
    adapterVersion: INSTALL_ADAPTER_VERSION,
    tool,
    source: `Homebrew 官方仓库 / ${args.at(-1)}`,
    sourceUrl:
      tool === "mysql"
        ? "https://formulae.brew.sh/formula/mysql-client"
        : tool === "psql" || tool === "pg_dump"
          ? "https://formulae.brew.sh/formula/libpq"
          : tool === "pwsh"
            ? "https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-macos"
            : "https://learn.microsoft.com/sql/tools/sqlcmd/sqlcmd-download-install",
    command: "brew",
    args,
    permission: "当前 Homebrew 前缀写权限，可能修改 PATH 提示",
    downloadImpact: "下载并安装数据库客户端及依赖",
    manager: "Homebrew",
  };
}

function linuxPlan(tool: ToolId, manager: "apt" | "dnf"): InstallationPlan | undefined {
  const packages: Partial<Record<ToolId, string>> =
    manager === "apt"
      ? {
          mysql: "mysql-client",
          psql: "postgresql-client",
          pg_dump: "postgresql-client",
          sqlcmd: "mssql-tools18",
          pwsh: "powershell",
        }
      : {
          mysql: "community-mysql",
          psql: "postgresql",
          pg_dump: "postgresql",
          sqlcmd: "mssql-tools18",
          pwsh: "powershell",
        };
  const packageName = packages[tool];
  if (packageName === undefined) return undefined;
  const elevated =
    typeof process.getuid === "function" && process.getuid() === 0 ? manager : "sudo";
  const args =
    elevated === manager
      ? manager === "apt"
        ? ["install", "-y", packageName]
        : ["install", "-y", packageName]
      : manager === "apt"
        ? ["apt-get", "install", "-y", packageName]
        : ["dnf", "install", "-y", packageName];
  return {
    adapterVersion: INSTALL_ADAPTER_VERSION,
    tool,
    source: `${manager} 已配置的软件源 / ${packageName}`,
    sourceUrl:
      tool === "mysql"
        ? "https://dev.mysql.com/doc/mysql-installation-excerpt/8.4/en/linux-installation.html"
        : tool === "psql" || tool === "pg_dump"
          ? "https://www.postgresql.org/download/linux/"
          : tool === "pwsh"
            ? "https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-linux"
            : "https://learn.microsoft.com/sql/tools/sqlcmd/sqlcmd-download-install",
    command: elevated,
    args,
    permission: elevated === "sudo" ? "需要 sudo 管理员授权" : "需要系统包写权限",
    downloadImpact: "下载并安装系统数据库客户端包及依赖",
    manager,
  };
}
