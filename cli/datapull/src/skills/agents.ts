import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const AGENT_REGISTRY_SOURCE = {
  repository: "vercel-labs/skills",
  version: "1.7.0",
  commit: "7407f3893ad4dceab546ac002c3ef806e4000c73",
} as const;

type UserRoot =
  | "home"
  | "config"
  | "codex"
  | "claude"
  | "vibe"
  | "hermes"
  | "autohand"
  | "grok"
  | "sarvam"
  | "openclaw";

type DetectionRoot =
  | UserRoot
  | "project"
  | "appData"
  | "flatpakConfig"
  | "absolute";

interface DetectionPath {
  root: DetectionRoot;
  path: string;
}

interface AgentDefinitionSource {
  id: string;
  displayName: string;
  projectSkillsDir: string;
  userRoot?: UserRoot;
  userSkillsDir?: string;
  detect?: readonly DetectionPath[];
  hiddenFromUniversalList?: boolean;
  hiddenFromUniversalPrompt?: boolean;
}

export interface AgentDefinition {
  id: AgentId;
  displayName: string;
  projectSkillsDir: string;
  supportsUserScope: boolean;
  universalProject: boolean;
  hiddenFromUniversalList: boolean;
  hiddenFromUniversalPrompt: boolean;
}

export interface AgentEnvironment {
  homeDir?: string;
  projectRoot?: string;
  env?: NodeJS.ProcessEnv;
  pathExists?: (path: string) => boolean;
}

// 注册表基于上游 v1.7.0 快照移植；DataPull 保留 claude 作为历史稳定 ID。
const SOURCES = [
  agent(
    "aider-desk",
    "AiderDesk",
    ".aider-desk/skills",
    "home",
    ".aider-desk/skills",
    [home(".aider-desk")],
  ),
  agent("amp", "Amp", ".agents/skills", "config", "agents/skills", [
    config("amp"),
  ]),
  agent(
    "antigravity",
    "Antigravity",
    ".agents/skills",
    "home",
    ".gemini/antigravity/skills",
    [home(".gemini/antigravity")],
    false,
    true,
  ),
  agent(
    "antigravity-cli",
    "Antigravity CLI",
    ".agents/skills",
    "home",
    ".gemini/antigravity-cli/skills",
    [home(".gemini/antigravity-cli")],
    false,
    true,
  ),
  agent("astrbot", "AstrBot", "data/skills", "home", ".astrbot/data/skills", [
    project("data/skills"),
    home(".astrbot"),
  ]),
  agent(
    "autohand-code",
    "Autohand Code CLI",
    ".autohand/skills",
    "autohand",
    "skills",
    [root("autohand")],
  ),
  agent("augment", "Augment", ".augment/skills", "home", ".augment/skills", [
    home(".augment"),
  ]),
  agent("bob", "IBM Bob", ".bob/skills", "home", ".bob/skills", [home(".bob")]),
  agent("claude", "Claude Code", ".claude/skills", "claude", "skills", [
    root("claude"),
  ]),
  agent("openclaw", "OpenClaw", "skills", "openclaw", "skills", [
    home(".openclaw"),
    home(".clawdbot"),
    home(".moltbot"),
  ]),
  agent("cline", "Cline", ".agents/skills", "home", ".agents/skills", [
    home(".cline"),
  ]),
  agent(
    "codearts-agent",
    "CodeArts Agent",
    ".codeartsdoer/skills",
    "home",
    ".codeartsdoer/skills",
    [home(".codeartsdoer")],
  ),
  agent(
    "codebuddy",
    "CodeBuddy",
    ".codebuddy/skills",
    "home",
    ".codebuddy/skills",
    [project(".codebuddy"), home(".codebuddy")],
  ),
  agent(
    "codemaker",
    "Codemaker",
    ".codemaker/skills",
    "home",
    ".codemaker/skills",
    [home(".codemaker")],
  ),
  agent(
    "codestudio",
    "Code Studio",
    ".codestudio/skills",
    "home",
    ".codestudio/skills",
    [home(".codestudio")],
  ),
  agent("codex", "Codex", ".agents/skills", "codex", "skills", [
    root("codex"),
    absolute("/etc/codex"),
  ]),
  agent(
    "command-code",
    "Command Code",
    ".commandcode/skills",
    "home",
    ".commandcode/skills",
    [home(".commandcode")],
  ),
  agent(
    "continue",
    "Continue",
    ".continue/skills",
    "home",
    ".continue/skills",
    [project(".continue"), home(".continue")],
  ),
  agent(
    "cortex",
    "Cortex Code",
    ".cortex/skills",
    "home",
    ".snowflake/cortex/skills",
    [home(".snowflake/cortex")],
  ),
  agent("crush", "Crush", ".crush/skills", "home", ".config/crush/skills", [
    home(".config/crush"),
  ]),
  agent("cursor", "Cursor", ".agents/skills", "home", ".cursor/skills", [
    home(".cursor"),
  ]),
  agent(
    "deepagents",
    "Deep Agents",
    ".agents/skills",
    "home",
    ".deepagents/agent/skills",
    [home(".deepagents")],
    false,
    true,
  ),
  agent(
    "devin",
    "Devin for Terminal",
    ".devin/skills",
    "config",
    "devin/skills",
    [config("devin")],
  ),
  agent(
    "dexto",
    "Dexto",
    ".agents/skills",
    "home",
    ".agents/skills",
    [home(".dexto")],
    false,
    true,
  ),
  agent("droid", "Droid", ".agents/skills", "home", ".factory/skills", [
    home(".factory"),
  ]),
  agent("eve", "Eve", "agent/skills", undefined, undefined, [project("agent")]),
  agent(
    "firebender",
    "Firebender",
    ".agents/skills",
    "home",
    ".firebender/skills",
    [home(".firebender")],
    false,
    true,
  ),
  agent("forgecode", "ForgeCode", ".forge/skills", "home", ".forge/skills", [
    home(".forge"),
  ]),
  agent("fx", "fx", ".fx/skills", "home", ".fx/skills", [home(".fx")]),
  agent(
    "gemini-cli",
    "Gemini CLI",
    ".agents/skills",
    "home",
    ".gemini/skills",
    [home(".gemini")],
  ),
  agent(
    "github-copilot",
    "GitHub Copilot",
    ".agents/skills",
    "home",
    ".copilot/skills",
    [home(".copilot")],
  ),
  agent("goose", "Goose", ".goose/skills", "config", "goose/skills", [
    config("goose"),
  ]),
  agent("grok", "Grok Build", ".grok/skills", "grok", "skills", [root("grok")]),
  agent("hermes-agent", "Hermes Agent", ".hermes/skills", "hermes", "skills", [
    root("hermes"),
  ]),
  agent(
    "inference-sh",
    "inference.sh",
    ".inferencesh/skills",
    "home",
    ".inferencesh/skills",
    [home(".inferencesh")],
  ),
  agent("jazz", "Jazz", ".jazz/skills", "home", ".jazz/skills", [
    home(".jazz"),
    project(".jazz"),
  ]),
  agent("junie", "Junie", ".junie/skills", "home", ".junie/skills", [
    home(".junie"),
  ]),
  agent("iflow-cli", "iFlow CLI", ".iflow/skills", "home", ".iflow/skills", [
    home(".iflow"),
  ]),
  agent("kilo", "Kilo Code", ".agents/skills", "home", ".kilo/skills", [
    home(".kilo"),
    home(".kilocode"),
  ]),
  agent(
    "kimchi",
    "Kimchi",
    ".kimchi/skills",
    "home",
    ".config/kimchi/harness/skills",
    [home(".config/kimchi")],
  ),
  agent(
    "kimi-code-cli",
    "Kimi Code CLI",
    ".agents/skills",
    "home",
    ".agents/skills",
    [home(".kimi-code"), home(".kimi")],
  ),
  agent("kiro-cli", "Kiro CLI", ".kiro/skills", "home", ".kiro/skills", [
    home(".kiro"),
  ]),
  agent("kode", "Kode", ".kode/skills", "home", ".kode/skills", [
    home(".kode"),
  ]),
  agent("lingma", "Lingma", ".lingma/skills", "home", ".lingma/skills", [
    home(".lingma"),
  ]),
  agent(
    "loaf",
    "Loaf",
    ".agents/skills",
    "home",
    ".agents/skills",
    [home(".loaf")],
    false,
    true,
  ),
  agent("mcpjam", "MCPJam", ".mcpjam/skills", "home", ".mcpjam/skills", [
    home(".mcpjam"),
  ]),
  agent(
    "minimax-code",
    "MiniMax Code",
    ".minimax/skills",
    "home",
    ".minimax/skills",
    [home(".minimax"), absolute("/Applications/MiniMax Code.app")],
  ),
  agent("mistral-vibe", "Mistral Vibe", ".vibe/skills", "vibe", "skills", [
    root("vibe"),
  ]),
  agent("moxby", "Moxby", ".moxby/skills", "home", ".moxby/skills", [
    home(".moxby"),
  ]),
  agent("mux", "Mux", ".mux/skills", "home", ".mux/skills", [home(".mux")]),
  agent("opencode", "OpenCode", ".agents/skills", "config", "opencode/skills", [
    config("opencode"),
  ]),
  agent(
    "openhands",
    "OpenHands",
    ".openhands/skills",
    "home",
    ".openhands/skills",
    [home(".openhands")],
  ),
  agent("ona", "Ona", ".ona/skills", "home", ".ona/skills", [home(".ona")]),
  agent("pi", "Pi", ".pi/skills", "home", ".pi/agent/skills", [
    home(".pi/agent"),
  ]),
  agent(
    "posit-assistant",
    "Posit Assistant",
    ".posit/assistant/skills",
    "home",
    ".posit/assistant/skills",
    [home(".posit/assistant"), home(".positai")],
  ),
  agent("qoder", "Qoder", ".qoder/skills", "home", ".qoder/skills", [
    home(".qoder"),
  ]),
  agent("qoder-cn", "Qoder CN", ".qoder/skills", "home", ".qoder-cn/skills", [
    home(".qoder-cn"),
  ]),
  agent("qwen-code", "Qwen Code", ".qwen/skills", "home", ".qwen/skills", [
    home(".qwen"),
  ]),
  agent(
    "replit",
    "Replit",
    ".agents/skills",
    "config",
    "agents/skills",
    [project(".replit")],
    true,
  ),
  agent(
    "reasonix",
    "Reasonix",
    ".reasonix/skills",
    "home",
    ".reasonix/skills",
    [home(".reasonix")],
  ),
  agent("rovodev", "Rovo Dev", ".rovodev/skills", "home", ".rovodev/skills", [
    home(".rovodev"),
  ]),
  agent("roo", "Roo Code", ".roo/skills", "home", ".roo/skills", [
    home(".roo"),
  ]),
  agent(
    "sarvam-code",
    "Sarvam Code",
    ".agents/skills",
    "sarvam",
    "skills",
    [root("sarvam")],
    false,
    true,
  ),
  agent(
    "tabnine-cli",
    "Tabnine CLI",
    ".tabnine/agent/skills",
    "home",
    ".tabnine/agent/skills",
    [home(".tabnine")],
  ),
  agent(
    "terramind",
    "Terramind",
    ".terramind/skills",
    "home",
    ".terramind/skills",
    [home(".terramind")],
  ),
  agent(
    "tinycloud",
    "Tinycloud",
    ".tinycloud/skills",
    "home",
    ".tinycloud/skills",
    [home(".tinycloud")],
  ),
  agent("trae", "Trae", ".trae/skills", "home", ".trae/skills", [
    home(".trae"),
  ]),
  agent("trae-cn", "Trae CN", ".trae/skills", "home", ".trae-cn/skills", [
    home(".trae-cn"),
  ]),
  agent("warp", "Warp", ".agents/skills", "home", ".agents/skills", [
    home(".warp"),
  ]),
  agent(
    "windsurf",
    "Windsurf",
    ".windsurf/skills",
    "home",
    ".codeium/windsurf/skills",
    [home(".codeium/windsurf")],
  ),
  agent("zed", "Zed", ".agents/skills", "home", ".agents/skills", [
    config("zed"),
    appData("Zed"),
    flatpakConfig("zed"),
  ]),
  agent("zcode", "ZCode", ".zcode/skills", "home", ".zcode/skills", [
    home(".zcode"),
    absolute("/Applications/ZCode.app"),
  ]),
  agent(
    "zencoder",
    "Zencoder",
    ".zencoder/skills",
    "home",
    ".zencoder/skills",
    [home(".zencoder")],
  ),
  agent("zenflow", "Zenflow", ".zencoder/skills", "home", ".zencoder/skills", [
    home(".zencoder"),
  ]),
  agent("neovate", "Neovate", ".neovate/skills", "home", ".neovate/skills", [
    home(".neovate"),
  ]),
  agent("pochi", "Pochi", ".pochi/skills", "home", ".pochi/skills", [
    home(".pochi"),
  ]),
  agent(
    "promptscript",
    "PromptScript",
    ".agents/skills",
    undefined,
    undefined,
    [project(".promptscript"), project("promptscript.yaml")],
    false,
    true,
  ),
  agent("adal", "AdaL", ".adal/skills", "home", ".adal/skills", [
    home(".adal"),
  ]),
  agent(
    "universal",
    "Universal",
    ".agents/skills",
    "config",
    "agents/skills",
    [],
    true,
  ),
] as const satisfies readonly AgentDefinitionSource[];

export type AgentId = (typeof SOURCES)[number]["id"];

export const AGENTS: readonly AgentId[] = Object.freeze(
  SOURCES.map((source) => source.id),
);

const SOURCE_BY_ID = new Map(SOURCES.map((source) => [source.id, source]));

const ALIASES: Readonly<Record<string, AgentId>> = {
  "claude-code": "claude",
};

export function normalizeAgentId(value: string): AgentId | undefined {
  const normalized = ALIASES[value] ?? value;
  return SOURCE_BY_ID.has(normalized as AgentId)
    ? (normalized as AgentId)
    : undefined;
}

export function getAgentDefinition(agentId: AgentId): AgentDefinition {
  const source = requiredSource(agentId);
  return {
    id: agentId,
    displayName: source.displayName,
    projectSkillsDir: source.projectSkillsDir,
    supportsUserScope: source.userRoot !== undefined,
    universalProject:
      source.projectSkillsDir === ".agents/skills" &&
      source.hiddenFromUniversalList !== true,
    hiddenFromUniversalList: source.hiddenFromUniversalList === true,
    hiddenFromUniversalPrompt: source.hiddenFromUniversalPrompt === true,
  };
}

export function listAgentDefinitions(
  options: { includeInternal?: boolean } = {},
): AgentDefinition[] {
  return AGENTS.filter(
    (agentId) => options.includeInternal === true || agentId !== "universal",
  ).map(getAgentDefinition);
}

export function listUniversalProjectAgents(
  options: { visibleOnly?: boolean } = {},
): AgentDefinition[] {
  return listAgentDefinitions().filter(
    (definition) =>
      definition.universalProject &&
      (options.visibleOnly !== true || !definition.hiddenFromUniversalPrompt),
  );
}

export function resolveAgentSkillsDirectory(
  agentId: AgentId,
  scope: "user" | "project",
  projectRoot: string,
  options: AgentEnvironment = {},
): { directory: string; scopeRoot: string } {
  const source = requiredSource(agentId);
  if (scope === "project") {
    return {
      directory: join(projectRoot, source.projectSkillsDir),
      scopeRoot: projectRoot,
    };
  }
  if (source.userRoot === undefined || source.userSkillsDir === undefined) {
    throw new Error(`${source.displayName} 不支持用户级 Skill 安装。`);
  }
  const roots = resolveRoots(options);
  const scopeRoot = resolveUserRoot(source.userRoot, roots);
  return {
    directory: join(scopeRoot, source.userSkillsDir),
    scopeRoot,
  };
}

export async function detectInstalledAgents(
  options: AgentEnvironment = {},
): Promise<AgentId[]> {
  const roots = resolveRoots(options);
  const pathExists = options.pathExists ?? existsSync;
  const installed = SOURCES.filter(
    (source) => source.id !== "universal",
  ).filter((source) => {
    if (source.id === "eve" && !evePackageDependency(roots.projectRoot))
      return false;
    return (source.detect ?? []).some((candidate) => {
      const base = resolveDetectionRoot(candidate.root, roots);
      return base !== undefined && pathExists(join(base, candidate.path));
    });
  });
  return installed.map((source) => source.id);
}

function agent<const TId extends string>(
  id: TId,
  displayName: string,
  projectSkillsDir: string,
  userRoot?: UserRoot,
  userSkillsDir?: string,
  detect: readonly DetectionPath[] = [],
  hiddenFromUniversalList = false,
  hiddenFromUniversalPrompt = false,
): AgentDefinitionSource & { id: TId } {
  return {
    id,
    displayName,
    projectSkillsDir,
    ...(userRoot === undefined ? {} : { userRoot }),
    ...(userSkillsDir === undefined ? {} : { userSkillsDir }),
    detect,
    hiddenFromUniversalList,
    hiddenFromUniversalPrompt,
  };
}

function home(path: string): DetectionPath {
  return { root: "home", path };
}

function config(path: string): DetectionPath {
  return { root: "config", path };
}

function project(path: string): DetectionPath {
  return { root: "project", path };
}

function appData(path: string): DetectionPath {
  return { root: "appData", path };
}

function flatpakConfig(path: string): DetectionPath {
  return { root: "flatpakConfig", path };
}

function absolute(path: string): DetectionPath {
  return { root: "absolute", path };
}

function root(value: UserRoot): DetectionPath {
  return { root: value, path: "" };
}

interface ResolvedRoots {
  home: string;
  config: string;
  projectRoot: string;
  appData?: string;
  flatpakConfig?: string;
  codex: string;
  claude: string;
  vibe: string;
  hermes: string;
  autohand: string;
  grok: string;
  sarvam: string;
  openclaw: string;
}

function resolveRoots(options: AgentEnvironment): ResolvedRoots {
  const homeDir = options.homeDir ?? homedir();
  const env = options.env ?? process.env;
  const pathExists = options.pathExists ?? existsSync;
  return {
    home: homeDir,
    config: env.XDG_CONFIG_HOME?.trim() || join(homeDir, ".config"),
    projectRoot: options.projectRoot ?? process.cwd(),
    ...(env.APPDATA?.trim() ? { appData: env.APPDATA.trim() } : {}),
    ...(env.FLATPAK_XDG_CONFIG_HOME?.trim()
      ? { flatpakConfig: env.FLATPAK_XDG_CONFIG_HOME.trim() }
      : {}),
    codex: env.CODEX_HOME?.trim() || join(homeDir, ".codex"),
    claude: env.CLAUDE_CONFIG_DIR?.trim() || join(homeDir, ".claude"),
    vibe: env.VIBE_HOME?.trim() || join(homeDir, ".vibe"),
    hermes: env.HERMES_HOME?.trim() || join(homeDir, ".hermes"),
    autohand: env.AUTOHAND_HOME?.trim() || join(homeDir, ".autohand"),
    grok: env.GROK_HOME?.trim() || join(homeDir, ".grok"),
    sarvam: env.SARVAM_HOME?.trim() || join(homeDir, ".sarvam"),
    openclaw: resolveOpenClawRoot(homeDir, pathExists),
  };
}

function resolveUserRoot(rootName: UserRoot, roots: ResolvedRoots): string {
  return roots[rootName];
}

function resolveDetectionRoot(
  rootName: DetectionRoot,
  roots: ResolvedRoots,
): string | undefined {
  if (rootName === "absolute") return "";
  if (rootName === "appData") return roots.appData;
  if (rootName === "flatpakConfig") return roots.flatpakConfig;
  if (rootName === "project") return roots.projectRoot;
  return roots[rootName];
}

function resolveOpenClawRoot(
  homeDir: string,
  pathExists: (path: string) => boolean,
): string {
  for (const directory of [".openclaw", ".clawdbot", ".moltbot"]) {
    const candidate = join(homeDir, directory);
    if (pathExists(candidate)) return candidate;
  }
  return join(homeDir, ".openclaw");
}

function evePackageDependency(projectRoot: string): boolean {
  try {
    const parsed = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };
    return (
      parsed.dependencies?.eve !== undefined ||
      parsed.devDependencies?.eve !== undefined
    );
  } catch {
    return false;
  }
}

function requiredSource(agentId: AgentId): AgentDefinitionSource {
  const source = SOURCE_BY_ID.get(agentId);
  if (source === undefined) throw new Error(`未知 Agent：${agentId}`);
  return source;
}
