export const ENGINES = ["mysql", "postgresql", "sqlserver"] as const;
export type Engine = (typeof ENGINES)[number];

export const AUTH_MODES = ["password", "url", "integrated"] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

export interface ConnectionConfig {
  alias: string;
  engine: Engine;
  authMode: AuthMode;
  host?: string | undefined;
  port?: number | undefined;
  username?: string | undefined;
  credentialRef?: string | undefined;
  urlRef?: string | undefined;
  sslMode?: string | undefined;
  recentDatabases: string[];
  favoriteDatabases: string[];
  tls?:
    | {
    encrypt: true;
    trustServerCertificate: false;
      }
    | undefined;
}

export interface GlobalConfig {
  version: 1;
  onboarding: {
    skillPrompted: boolean;
  };
  connections: ConnectionConfig[];
}

export interface ResolvedConnection extends ConnectionConfig {
  database?: string | undefined;
  password?: string | undefined;
  secretUrl?: string | undefined;
}

export interface DatabaseObject {
  type: string;
  schema?: string | undefined;
  name: string;
  identity?: string | undefined;
  ddl: string;
}

export interface PullResult {
  connectionAlias: string;
  engine: Engine;
  database: string;
  projectRoot: string;
  outputPath: string;
  updatedTypes: string[];
  preservedTypes: string[];
  objectCounts: Record<string, number>;
}
