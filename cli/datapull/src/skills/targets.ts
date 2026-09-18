import { homedir } from "node:os";
import { join } from "node:path";

export const AGENTS = ["codex", "claude", "cursor", "trae"] as const;
export type AgentId = (typeof AGENTS)[number];
export type SkillScope = "user" | "project";

export interface SkillTarget {
  agent: AgentId;
  scope: SkillScope;
  path: string;
}

export function parseSkillTarget(value: string, projectRoot: string): SkillTarget {
  const [agentValue, scopeValue, extra] = value.split(":");
  if (extra !== undefined || !isAgent(agentValue) || !isScope(scopeValue)) {
    throw new Error(`无效 Skill 目标：${value}，格式应为 <agent>:<user|project>。`);
  }
  return resolveSkillTarget(agentValue, scopeValue, projectRoot);
}

export function allSkillTargets(projectRoot: string): SkillTarget[] {
  return AGENTS.flatMap((agent) => [
    resolveSkillTarget(agent, "user", projectRoot),
    resolveSkillTarget(agent, "project", projectRoot),
  ]);
}

export function resolveSkillTarget(
  agent: AgentId,
  scope: SkillScope,
  projectRoot: string,
  platform = process.platform,
): SkillTarget {
  const root = scope === "user" ? homedir() : projectRoot;
  const parts: Record<AgentId, string[]> = {
    codex: [".agents", "skills", "datapull"],
    claude: [".claude", "skills", "datapull"],
    cursor: [".cursor", "skills", "datapull"],
    trae:
      scope === "project"
        ? [".trae", "skills", "datapull"]
        : platform === "win32"
          ? [".trae-cn", "skills", "datapull"]
          : [".trae-cn", "skills", "datapull"],
  };
  return { agent, scope, path: join(root, ...parts[agent]) };
}

function isAgent(value: string | undefined): value is AgentId {
  return value !== undefined && AGENTS.includes(value as AgentId);
}

function isScope(value: string | undefined): value is SkillScope {
  return value === "user" || value === "project";
}
