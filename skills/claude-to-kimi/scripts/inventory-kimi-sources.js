#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const rootArg = args.find((arg) => !arg.startsWith("--")) || ".";
const rootDir = path.resolve(process.cwd(), rootArg);
const summaryOnly = flags.has("--summary");

if (flags.has("--help")) {
  printHelp();
  process.exit(0);
}

function printHelp() {
  console.log("用法:");
  console.log("  node inventory-kimi-sources.js [目录]");
  console.log("  node inventory-kimi-sources.js [目录] --summary");
  console.log("");
  console.log("说明:");
  console.log("  盘点 Claude 来源目录与 Kimi 目标目录，帮助判断迁移输入边界。");
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function walkFiles(baseDir) {
  if (!exists(baseDir)) {
    return [];
  }

  const results = [];
  const stack = [baseDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function relativeList(baseDir, filterFn) {
  return walkFiles(baseDir)
    .filter(filterFn)
    .map((filePath) => path.relative(baseDir, filePath).replace(/\\/g, "/"))
    .sort();
}

function listSkillNames(dirPath) {
  if (!exists(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => exists(path.join(dirPath, name, "SKILL.md")))
    .sort();
}

function summarizeWorkspace(name) {
  const baseDir = path.join(rootDir, name);
  return {
    name,
    path: baseDir,
    exists: exists(baseDir),
    resources: {
      skills: listSkillNames(path.join(baseDir, "skills")),
      commands: relativeList(path.join(baseDir, "commands"), (filePath) => filePath.endsWith(".md")),
      agents: relativeList(path.join(baseDir, "agents"), (filePath) => filePath.endsWith(".md")),
      hooks: relativeList(path.join(baseDir, "hooks"), () => true),
      scripts: relativeList(path.join(baseDir, "scripts"), () => true)
    },
    configFiles: {
      settingsJson: exists(path.join(baseDir, "settings.json")),
      agentsMd: exists(path.join(baseDir, "AGENTS.md")),
      mcpJson: exists(path.join(baseDir, "mcp.json"))
    }
  };
}

function summarizePlugin(name) {
  const baseDir = path.join(rootDir, name);
  return {
    name,
    path: baseDir,
    exists: exists(baseDir),
    manifests: {
      pluginJson: exists(path.join(baseDir, "plugin.json")),
      kimiPluginJson: exists(path.join(baseDir, "kimi.plugin.json")),
      hiddenPluginJson: exists(path.join(baseDir, ".kimi-plugin", "plugin.json"))
    },
    resources: {
      skills: listSkillNames(path.join(baseDir, "skills")),
      commands: relativeList(path.join(baseDir, "commands"), (filePath) => filePath.endsWith(".md")),
      agents: relativeList(path.join(baseDir, "agents"), (filePath) => filePath.endsWith(".md")),
      hooks: relativeList(path.join(baseDir, "hooks"), () => true),
      scripts: relativeList(path.join(baseDir, "scripts"), () => true),
      templates: relativeList(path.join(baseDir, "templates"), () => true)
    }
  };
}

function summarizeKimiTargets() {
  return {
    sharedSkillsPath: path.join(rootDir, ".agents", "skills"),
    workspaceSkillsPath: path.join(rootDir, ".kimi-code", "skills"),
    sharedAgentsPath: path.join(rootDir, ".agents", "agents"),
    workspaceAgentsPath: path.join(rootDir, ".kimi-code", "agents"),
    workspacePath: path.join(rootDir, ".kimi-code"),
    sharedSkillsExists: exists(path.join(rootDir, ".agents", "skills")),
    workspaceExists: exists(path.join(rootDir, ".kimi-code")),
    skillsShared: listSkillNames(path.join(rootDir, ".agents", "skills")),
    skillsWorkspace: listSkillNames(path.join(rootDir, ".kimi-code", "skills")),
    agentsShared: relativeList(path.join(rootDir, ".agents", "agents"), (filePath) => filePath.endsWith(".md")),
    agentsWorkspace: relativeList(path.join(rootDir, ".kimi-code", "agents"), (filePath) => filePath.endsWith(".md")),
    mcpJson: exists(path.join(rootDir, ".kimi-code", "mcp.json")),
    workspaceAgentsMd: exists(path.join(rootDir, ".kimi-code", "AGENTS.md")),
    rootAgentsMd: exists(path.join(rootDir, "AGENTS.md")),
    pluginManifest: exists(path.join(rootDir, "kimi.plugin.json")),
    hiddenPluginManifest: exists(path.join(rootDir, ".kimi-plugin", "plugin.json"))
  };
}

function summarizeSharedResources() {
  const skillsBaseDir = path.join(rootDir, ".agents", "skills");
  const agentsBaseDir = path.join(rootDir, ".agents", "agents");
  return {
    skillsPath: skillsBaseDir,
    agentsPath: agentsBaseDir,
    exists: exists(path.join(rootDir, ".agents")),
    skillsExists: exists(skillsBaseDir),
    agentsExists: exists(agentsBaseDir),
    skills: listSkillNames(skillsBaseDir),
    agents: relativeList(agentsBaseDir, (filePath) => filePath.endsWith(".md"))
  };
}

function makeSuggestions(claudeWorkspace, plugins, kimiTargets, sharedResources) {
  const suggestions = [];
  const sourcePlugins = plugins.filter((item) => item.exists);
  const sourceAgentCount = claudeWorkspace.resources.agents.length
    + plugins.reduce((total, item) => total + item.resources.agents.length, 0);
  const sourceSkillCount = claudeWorkspace.resources.skills.length
    + plugins.reduce((total, item) => total + item.resources.skills.length, 0);

  if (sourceSkillCount > 0 && !kimiTargets.sharedSkillsExists) {
    suggestions.push("发现 Claude skills，但未发现 `.agents/skills`，建议优先规划共享 Skill 迁移。");
  }

  if (sourcePlugins.length > 0 && !kimiTargets.pluginManifest && !kimiTargets.hiddenPluginManifest) {
    suggestions.push("发现来源 plugin 目录但未发现 Kimi plugin manifest，建议优先生成 `kimi.plugin.json`。");
  }

  if (kimiTargets.pluginManifest || kimiTargets.hiddenPluginManifest) {
    suggestions.push("已存在 Kimi plugin manifest，建议先做差异分析，不要直接覆盖。");
  }

  if (sourceAgentCount > 0) {
    suggestions.push("发现来源 agents，建议优先判断是否可直接迁移到 `.agents/agents` 或 `.kimi-code/agents`。");
  }

  if (sharedResources.skillsExists && sharedResources.skills.length > 0) {
    suggestions.push("已存在 `.agents/skills`，迁移时需检查共享 Skill 的同名覆盖关系。");
  }

  if (sharedResources.agentsExists && sharedResources.agents.length > 0) {
    suggestions.push("已存在 `.agents/agents`，迁移 Agent 时需检查同名文件是否需要覆盖或合并。");
  }

  if (sourcePlugins.some((item) => item.resources.hooks.length > 0)) {
    suggestions.push("发现来源 plugin hooks，迁移时需要按 Kimi hook 协议重写，不建议直接复制。");
  }

  if (suggestions.length === 0) {
    suggestions.push("未发现明显冲突，可继续做资源级盘点与分类。");
  }

  return suggestions;
}

const claudeWorkspace = summarizeWorkspace(".claude");
const plugins = [".claude-plugin", ".codex-plugin"].map(summarizePlugin);
const kimiTargets = summarizeKimiTargets();
const sharedResources = summarizeSharedResources();

const payload = {
  rootDir,
  scannedAt: new Date().toISOString(),
  claudeWorkspace,
  plugins,
  kimiTargets,
  sharedResources,
  suggestions: makeSuggestions(claudeWorkspace, plugins, kimiTargets, sharedResources)
};

if (summaryOnly) {
  console.log("来源盘点摘要");
  console.log("================");
  console.log(`.claude: ${claudeWorkspace.exists ? "存在" : "不存在"}`);
  console.log(`.claude-plugin: ${plugins[0].exists ? "存在" : "不存在"}`);
  console.log(`.codex-plugin: ${plugins[1].exists ? "存在" : "不存在"}`);
  console.log(`.kimi-code: ${kimiTargets.workspaceExists ? "存在" : "不存在"}`);
  console.log(`kimi.plugin.json: ${kimiTargets.pluginManifest ? "存在" : "不存在"}`);
  console.log(`.kimi-plugin/plugin.json: ${kimiTargets.hiddenPluginManifest ? "存在" : "不存在"}`);
  console.log(`.agents/skills: ${kimiTargets.sharedSkillsExists ? "存在" : "不存在"}`);
  console.log(`.agents/agents: ${kimiTargets.agentsShared.length > 0 ? "存在" : "不存在或为空"}`);
  console.log(`.kimi-code/agents: ${kimiTargets.agentsWorkspace.length > 0 ? "存在" : "不存在或为空"}`);
  console.log("");
  console.log("建议动作:");
  for (const item of payload.suggestions) {
    console.log(`- ${item}`);
  }
} else {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
