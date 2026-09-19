/**
 * 持久化配置支持的稳定 Provider ID；运行时能力与展示信息由 Registry 提供。
 */
export const DATABASE_PROVIDER_IDS = ["mysql", "postgresql", "sqlserver"] as const;
export type DatabaseProviderId = (typeof DATABASE_PROVIDER_IDS)[number];
