import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { release } from "node:os";
import { ConfigStore } from "../config/store.js";
import { asDataPullError } from "../core/errors.js";
import { MINIMUM_NODE_VERSION } from "../core/runtime.js";
import { ToolManager } from "../tools/manager.js";
import { INSTALL_ADAPTER_VERSION } from "../tools/catalog.js";
import { discoverProjectRoot } from "../utils/path.js";

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export async function runDoctor(
  store: ConfigStore,
  tools = new ToolManager(),
): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [
    {
      name: "node",
      ok: true,
      detail: `Node.js ${process.versions.node}（最低 ${MINIMUM_NODE_VERSION.join(".")}）`,
    },
    platformCheck(await linuxDistribution()),
    {
      name: "install-adapter",
      ok: true,
      detail: `安装适配目录版本 ${INSTALL_ADAPTER_VERSION}`,
    },
  ];
  try {
    await store.read();
    await store.readCredentials();
    checks.push({ name: "config", ok: true, detail: store.paths.root });
  } catch (error) {
    const normalized = asDataPullError(error);
    checks.push({ name: "config", ok: false, detail: `${normalized.code}: ${normalized.message}` });
  }
  const root = await discoverProjectRoot();
  try {
    await access(root, constants.W_OK);
    checks.push({ name: "project", ok: true, detail: root });
  } catch {
    checks.push({ name: "project", ok: false, detail: `项目根目录不可写：${root}` });
  }
  for (const engine of ["mysql", "postgresql", "sqlserver"] as const) {
    const statuses = await tools.inspect(engine);
    checks.push({
      name: `tools:${engine}`,
      ok: statuses.every((status) => status.available),
      detail: statuses
        .map((status) => `${status.tool}=${status.available ? status.version ?? "available" : "missing"}`)
        .join("; "),
    });
  }
  return checks;
}

async function linuxDistribution(): Promise<string | undefined> {
  if (process.platform !== "linux") return undefined;
  try {
    const content = await readFile(join("/", "etc", "os-release"), "utf8");
    return content.match(/^ID=(?:"([^"]+)"|([^\n]+))$/mu)?.slice(1).find(Boolean);
  } catch {
    return undefined;
  }
}

function platformCheck(distribution?: string): DoctorCheck {
  if (process.platform === "win32") {
    return { name: "platform", ok: true, detail: `Windows ${release()}` };
  }
  if (process.platform === "darwin") return { name: "platform", ok: true, detail: "macOS" };
  if (process.platform === "linux") {
    const supported = ["ubuntu", "debian", "fedora"].includes(distribution ?? "");
    return {
      name: "platform",
      ok: supported,
      detail: supported ? `Linux ${distribution}` : `未验证的 Linux 发行版：${distribution ?? "unknown"}`,
    };
  }
  return { name: "platform", ok: false, detail: `不支持的平台：${process.platform}` };
}
