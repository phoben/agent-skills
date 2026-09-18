import { homedir } from "node:os";
import { join } from "node:path";

export interface ConfigPaths {
  root: string;
  config: string;
  credentials: string;
  backups: string;
}

export function getConfigPaths(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): ConfigPaths {
  const override = env.DATAPULL_CONFIG_HOME;
  let root: string;
  if (override !== undefined && override.trim().length > 0) root = override;
  else if (platform === "win32") {
    root = join(env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "datapull");
  } else if (platform === "darwin") {
    root = join(homedir(), "Library", "Application Support", "datapull");
  } else {
    root = join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "datapull");
  }
  return {
    root,
    config: join(root, "config.json"),
    credentials: join(root, "credentials.env"),
    backups: join(root, "backups"),
  };
}
