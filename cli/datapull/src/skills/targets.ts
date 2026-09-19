import { join } from "node:path";
import {
  AGENTS,
  getAgentDefinition,
  normalizeAgentId,
  resolveAgentSkillsDirectory,
  type AgentEnvironment,
  type AgentId,
} from "./agents.js";

export { AGENTS, type AgentId } from "./agents.js";
export type SkillScope = "user" | "project";

export interface SkillTarget {
  agent: AgentId;
  scope: SkillScope;
  path: string;
  scopeRoot: string;
}

export function parseSkillTarget(
  value: string,
  projectRoot: string,
  options: AgentEnvironment = {},
): SkillTarget {
  const [agentValue, scopeValue, extra] = value.split(":");
  const agent = agentValue === undefined ? undefined : normalizeAgentId(agentValue);
  if (extra !== undefined || agent === undefined || !isScope(scopeValue)) {
    throw new Error(`无效 Skill 目标：${value}，格式应为 <agent>:<user|project>。`);
  }
  return resolveSkillTarget(agent, scopeValue, projectRoot, options);
}

export function allSkillTargets(
  projectRoot: string,
  options: AgentEnvironment = {},
): SkillTarget[] {
  return AGENTS.flatMap((agent) => {
    const scopes: SkillScope[] = getAgentDefinition(agent).supportsUserScope
      ? ["user", "project"]
      : ["project"];
    return scopes.map((scope) => resolveSkillTarget(agent, scope, projectRoot, options));
  });
}

export function resolveSkillTarget(
  agent: AgentId,
  scope: SkillScope,
  projectRoot: string,
  options: AgentEnvironment = {},
): SkillTarget {
  const resolved = resolveAgentSkillsDirectory(agent, scope, projectRoot, {
    ...options,
    projectRoot,
  });
  return {
    agent,
    scope,
    path: join(resolved.directory, "datapull"),
    scopeRoot: resolved.scopeRoot,
  };
}

export function uniqueSkillTargets(targets: readonly SkillTarget[]): SkillTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = target.path.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isScope(value: string | undefined): value is SkillScope {
  return value === "user" || value === "project";
}
