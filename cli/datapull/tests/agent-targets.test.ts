import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENTS,
  AGENT_REGISTRY_SOURCE,
  detectInstalledAgents,
  listAgentDefinitions,
  listUniversalProjectAgents,
  resolveAgentSkillsDirectory,
} from "../src/skills/agents.js";
import {
  parseSkillTarget,
  resolveSkillTarget,
  uniqueSkillTargets,
} from "../src/skills/targets.js";

describe("Agent Skill 目标注册表", () => {
  it("完整记录上游 v1.7.0 平台快照并识别共享项目目录", () => {
    expect(AGENT_REGISTRY_SOURCE).toMatchObject({
      repository: "vercel-labs/skills",
      version: "1.7.0",
    });
    expect(AGENTS).toHaveLength(79);
    expect(listUniversalProjectAgents()).toHaveLength(20);
    expect(listUniversalProjectAgents().map((agent) => agent.id)).toEqual(
      expect.arrayContaining([
        "codex",
        "cursor",
        "gemini-cli",
        "github-copilot",
        "opencode",
      ]),
    );
  });

  it("共享组只合并项目路径，用户级仍按平台分别解析", () => {
    const projectRoot = join("C:", "workspace");
    const homeDir = join("C:", "Users", "tester");
    const codexProject = resolveSkillTarget("codex", "project", projectRoot, {
      homeDir,
    });
    const cursorProject = resolveSkillTarget("cursor", "project", projectRoot, {
      homeDir,
    });
    const codexUser = resolveSkillTarget("codex", "user", projectRoot, {
      homeDir,
      env: {},
    });
    const cursorUser = resolveSkillTarget("cursor", "user", projectRoot, {
      homeDir,
      env: {},
    });

    expect(codexProject.path).toBe(cursorProject.path);
    expect(codexProject.path).toBe(
      join(projectRoot, ".agents", "skills", "datapull"),
    );
    expect(codexUser.path).toBe(join(homeDir, ".codex", "skills", "datapull"));
    expect(cursorUser.path).toBe(
      join(homeDir, ".cursor", "skills", "datapull"),
    );
  });

  it("每个平台注册项都能解析项目路径，声明用户级时也能解析用户路径", () => {
    const projectRoot = join("C:", "workspace");
    const homeDir = join("C:", "Users", "tester");
    for (const agent of listAgentDefinitions({ includeInternal: true })) {
      const projectTarget = resolveSkillTarget(
        agent.id,
        "project",
        projectRoot,
        {
          homeDir,
          env: {},
        },
      );
      expect(projectTarget.path.endsWith(join("skills", "datapull"))).toBe(
        true,
      );
      if (agent.supportsUserScope) {
        const userTarget = resolveSkillTarget(agent.id, "user", projectRoot, {
          homeDir,
          env: {},
        });
        expect(userTarget.path.endsWith(join("skills", "datapull"))).toBe(true);
      }
    }
  });

  it("多个共享平台目标只保留一次实体写入", () => {
    const projectRoot = join("C:", "workspace");
    const targets = uniqueSkillTargets([
      resolveSkillTarget("codex", "project", projectRoot),
      resolveSkillTarget("cursor", "project", projectRoot),
      resolveSkillTarget("opencode", "project", projectRoot),
    ]);

    expect(targets).toHaveLength(1);
    expect(targets[0]?.path).toBe(
      join(projectRoot, ".agents", "skills", "datapull"),
    );
  });

  it("保留 claude 旧 ID，同时接受上游 claude-code 别名", () => {
    const projectRoot = join("C:", "workspace");
    const legacy = parseSkillTarget("claude:user", projectRoot, {
      homeDir: join("C:", "Users", "tester"),
      env: {},
    });
    const upstream = parseSkillTarget("claude-code:user", projectRoot, {
      homeDir: join("C:", "Users", "tester"),
      env: {},
    });

    expect(upstream).toEqual(legacy);
    expect(upstream.agent).toBe("claude");
  });

  it("区分 Trae 与 Trae CN 用户目录，并支持 Agent 环境变量覆盖", () => {
    const projectRoot = join("C:", "workspace");
    const homeDir = join("C:", "Users", "tester");
    expect(
      resolveAgentSkillsDirectory("trae", "user", projectRoot, {
        homeDir,
        env: {},
      }).directory,
    ).toBe(join(homeDir, ".trae", "skills"));
    expect(
      resolveAgentSkillsDirectory("trae-cn", "user", projectRoot, {
        homeDir,
        env: {},
      }).directory,
    ).toBe(join(homeDir, ".trae-cn", "skills"));
    expect(
      resolveAgentSkillsDirectory("codex", "user", projectRoot, {
        homeDir,
        env: { CODEX_HOME: join(homeDir, "custom-codex") },
      }).directory,
    ).toBe(join(homeDir, "custom-codex", "skills"));
  });

  it("不为上游未提供用户级目录的平台虚构路径", () => {
    expect(() =>
      resolveAgentSkillsDirectory("eve", "user", join("C:", "workspace"), {
        homeDir: join("C:", "Users", "tester"),
        env: {},
      }),
    ).toThrow("Eve 不支持用户级 Skill 安装");
  });

  it("只根据无副作用的配置痕迹推荐平台", async () => {
    const homeDir = join("C:", "Users", "tester");
    const markers = new Set([join(homeDir, ".codex"), join(homeDir, ".cline")]);
    const detected = await detectInstalledAgents({
      homeDir,
      projectRoot: join("C:", "workspace"),
      env: {},
      pathExists: (path) => markers.has(path),
    });

    expect(detected).toEqual(expect.arrayContaining(["codex", "cline"]));
    expect(detected).not.toContain("cursor");
    expect(detected).not.toContain("universal");
  });
});
