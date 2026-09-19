import { DataPullError } from "../core/errors.js";
import type { Engine } from "../types.js";
import type { DatabaseProvider, DatabaseProviderManifest } from "./provider.js";

export class DatabaseProviderRegistry {
  private readonly providers = new Map<Engine, DatabaseProvider>();
  private readonly aliases = new Map<string, Engine>();

  constructor(providers: readonly DatabaseProvider[]) {
    for (const provider of providers) this.register(provider);
    if (this.providers.size === 0) {
      throw new DataPullError("PROVIDER_REGISTRY_INVALID", "数据库 Provider Registry 不能为空。", 3);
    }
  }

  list(): readonly DatabaseProvider[] {
    return [...this.providers.values()];
  }

  manifests(): readonly DatabaseProviderManifest[] {
    return this.list().map((provider) => provider.manifest);
  }

  ids(): readonly Engine[] {
    return this.list().map((provider) => provider.manifest.id);
  }

  get(idOrAlias: Engine | string): DatabaseProvider {
    const normalized = normalizeIdentity(idOrAlias);
    const id = this.aliases.get(normalized) ?? normalized;
    const provider = this.providers.get(id as Engine);
    if (provider !== undefined) return provider;
    throw new DataPullError(
      "DATABASE_PROVIDER_NOT_FOUND",
      `未找到数据库 Provider：${idOrAlias}`,
      3,
      { providerId: idOrAlias, registeredProviders: this.ids() },
    );
  }

  has(idOrAlias: string): boolean {
    try {
      this.get(idOrAlias);
      return true;
    } catch (error) {
      if (error instanceof DataPullError && error.code === "DATABASE_PROVIDER_NOT_FOUND") {
        return false;
      }
      throw error;
    }
  }

  private register(provider: DatabaseProvider): void {
    validateManifest(provider.manifest);
    const id = provider.manifest.id;
    if (this.providers.has(id)) this.duplicate("Provider ID", id);
    this.providers.set(id, provider);
    for (const identity of [id, ...provider.manifest.aliases]) {
      const normalized = normalizeIdentity(identity);
      const existing = this.aliases.get(normalized);
      if (existing !== undefined) this.duplicate("Provider ID 或别名", identity);
      this.aliases.set(normalized, id);
    }
  }

  private duplicate(label: string, value: string): never {
    throw new DataPullError(
      "PROVIDER_REGISTRY_INVALID",
      `${label} 重复：${value}`,
      3,
    );
  }
}

function validateManifest(manifest: DatabaseProviderManifest): void {
  if (manifest.id.trim().length === 0 || manifest.displayName.trim().length === 0) {
    invalid(manifest.id, "ID 和显示名称不能为空");
  }
  if (!Number.isInteger(manifest.defaultPort) || manifest.defaultPort < 1 || manifest.defaultPort > 65_535) {
    invalid(manifest.id, "默认端口无效");
  }
  if (manifest.urlProtocols.length === 0 || manifest.tools.length === 0 || manifest.objects.length === 0) {
    invalid(manifest.id, "URL 协议、工具和对象定义不能为空");
  }
  if (manifest.authModes.length === 0) invalid(manifest.id, "认证方式不能为空");
  if (manifest.aliases.some((alias) => alias.trim().length === 0)) {
    invalid(manifest.id, "Provider 别名不能为空");
  }
  if (
    manifest.urlProtocols.some((protocol) => !/^[a-z][a-z0-9+.-]*:$/u.test(protocol))
  ) {
    invalid(manifest.id, "URL 协议必须是以冒号结尾的标准 scheme");
  }
  if (new Set(manifest.urlProtocols).size !== manifest.urlProtocols.length) {
    invalid(manifest.id, "URL 协议重复");
  }
  if (new Set(manifest.tools).size !== manifest.tools.length) {
    invalid(manifest.id, "工具声明重复");
  }
  const objectIds = new Set<string>();
  for (const object of manifest.objects) {
    if (objectIds.has(object.id)) invalid(manifest.id, `对象类型重复：${object.id}`);
    objectIds.add(object.id);
    if (object.id.trim().length === 0 || object.displayName.trim().length === 0) {
      invalid(manifest.id, "对象 ID 和显示名称不能为空");
    }
  }
  if (new Set(manifest.authModes).size !== manifest.authModes.length) {
    invalid(manifest.id, "认证方式重复");
  }
  if (!manifest.objects.some((object) => object.defaultSelected)) {
    invalid(manifest.id, "至少需要一个自定义范围默认对象");
  }
  if (
    manifest.authModes.includes("integrated") &&
    manifest.id !== "sqlserver"
  ) {
    invalid(manifest.id, "集成认证目前只允许由 SQL Server Provider 声明");
  }
  if (manifest.tls.trustServerCertificate && !manifest.tls.supported) {
    invalid(manifest.id, "不支持 TLS 的 Provider 不能声明信任服务器证书能力");
  }
}

function invalid(providerId: string, reason: string): never {
  throw new DataPullError(
    "PROVIDER_REGISTRY_INVALID",
    `数据库 Provider ${providerId || "<empty>"} 配置无效：${reason}。`,
    3,
  );
}

function normalizeIdentity(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}
