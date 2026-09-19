import { z } from "zod";
import { databaseProviders } from "../providers/builtin.js";
import { DATABASE_PROVIDER_IDS } from "../providers/ids.js";

const referenceSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/u);
const segmentSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !/[<>:"/\\|?*\u0000-\u001f]/u.test(value));

export const connectionSchema = z
  .object({
    alias: segmentSchema,
    engine: z.enum(DATABASE_PROVIDER_IDS),
    authMode: z.enum(["password", "url", "integrated"]),
    host: z.string().trim().min(1).optional(),
    port: z.number().int().min(1).max(65_535).optional(),
    username: z.string().optional(),
    credentialRef: referenceSchema.optional(),
    urlRef: referenceSchema.optional(),
    sslMode: z.string().trim().min(1).optional(),
    recentDatabases: z.array(segmentSchema).default([]),
    favoriteDatabases: z.array(segmentSchema).default([]),
    tls: z
      .object({
        encrypt: z.literal(true),
        trustServerCertificate: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((connection, context) => {
    const provider = databaseProviders.get(connection.engine);
    if (!provider.manifest.authModes.includes(connection.authMode)) {
      context.addIssue({
        code: "custom",
        message: `${provider.manifest.displayName} 不支持认证方式 ${connection.authMode}。`,
      });
    }
    if (connection.authMode === "url" && connection.urlRef === undefined) {
      context.addIssue({ code: "custom", message: "URL 认证需要 urlRef。" });
    }
    if (connection.authMode === "password") {
      for (const field of ["host", "username", "credentialRef"] as const) {
        if (connection[field] === undefined) {
          context.addIssue({ code: "custom", message: `密码认证需要 ${field}。` });
        }
      }
    }
    if (provider.manifest.tls.trustServerCertificate) {
      if (connection.tls?.encrypt !== true) {
        context.addIssue({
          code: "custom",
          message: "SQL Server 必须启用加密。",
        });
      }
    }
  });

export const globalConfigSchema = z
  .object({
    version: z.literal(1),
    onboarding: z
      .object({ skillPrompted: z.boolean() })
      .strict()
      .default({ skillPrompted: false }),
    connections: z.array(connectionSchema),
  })
  .strict()
  .superRefine((config, context) => {
    const aliases = new Set<string>();
    for (const connection of config.connections) {
      const key = connection.alias.toLocaleLowerCase("en-US");
      if (aliases.has(key)) {
        context.addIssue({ code: "custom", message: `连接别名重复：${connection.alias}` });
      }
      aliases.add(key);
    }
  });

export type ParsedGlobalConfig = z.infer<typeof globalConfigSchema>;
