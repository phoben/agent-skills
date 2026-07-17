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
      hooks: relativeList(path.join(baseDir, "hooks"), () => true),
      scripts: relativeList(path.join(baseDir, "scripts"), () => true),
      templates: relativeList(path.join(baseDir, "templates"), () => true)
    }
  };
}

function summarizeKimiTargets() {
  const kimiCodeDir = path.join(rootDir, ".kimi-code");
  return {
    path: kimiCodeDir,
    exists: exists(kimiCodeDir),
    skills: listSkillNames(path.join(kimiCodeDir, "skills")),
    mcpJson: exists(path.join(kimiCodeDir, "mcp.json")),
    agentsMd: exists(path.join(kimiCodeDir, "AGENTS.md")),
    rootAgentsMd: exists(path.join(rootDir, "AGENTS.md")),
    pluginManifest: exists(path.join(rootDir, "kimi.plugin.json")),
    hiddenPluginManifest: exists(path.join(rootDir, ".kimi-plugin", "plugin.json"))
  };
}

function summarizeSharedSkills() {
  const baseDir = path.join(rootDir, ".agents", "skills");
  return {
    path: baseDir,
    exists: exists(baseDir),
    skills: listSkillNames(baseDir)
  };
}

function makeSuggestions(claudeWorkspace, plugins, kimiTargets, sharedSkills) {
  const suggestions = [];
  const sourcePlugins = plugins.filter((item) => item.exists);

  if (claudeWorkspace.exists && !kimiTargets.exists) {
    suggestions.push("发现 `.claude` 但未发现 `.kimi-code`，建议优先规划项目级迁移。");
  }

  if (sourcePlugins.length > 0 && !kimiTargets.pluginManifest && !kimiTargets.hiddenPluginManifest) {
    suggestions.push("发现来源 plugin 目录但未发现 Kimi plugin manifest，建议优先生成 `kimi.plugin.json`。");
  }

  if (kimiTargets.pluginManifest || kimiTargets.hiddenPluginManifest) {
    suggestions.push("已存在 Kimi plugin manifest，建议先做差异分析，不要直接覆盖。");
  }

  if (sharedSkills.exists && sharedSkills.skills.length > 0) {
    suggestions.push("发现 `.agents/skills`，迁移时需检查与 `.kimi-code/skills` 的同名覆盖关系。");
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
const sharedSkills = summarizeSharedSkills();

const payload = {
  rootDir,
  scannedAt: new Date().toISOString(),
  claudeWorkspace,
  plugins,
  kimiTargets,
  sharedSkills,
  suggestions: makeSuggestions(claudeWorkspace, plugins, kimiTargets, sharedSkills)
};

if (summaryOnly) {
  console.log("来源盘点摘要");
  console.log("================");
  console.log(`.claude: ${claudeWorkspace.exists ? "存在" : "不存在"}`);
  console.log(`.claude-plugin: ${plugins[0].exists ? "存在" : "不存在"}`);
  console.log(`.codex-plugin: ${plugins[1].exists ? "存在" : "不存在"}`);
  console.log(`.kimi-code: ${kimiTargets.exists ? "存在" : "不存在"}`);
  console.log(`kimi.plugin.json: ${kimiTargets.pluginManifest ? "存在" : "不存在"}`);
  console.log(`.kimi-plugin/plugin.json: ${kimiTargets.hiddenPluginManifest ? "存在" : "不存在"}`);
  console.log(`.agents/skills: ${sharedSkills.exists ? "存在" : "不存在"}`);
  console.log("");
  console.log("建议动作:");
  for (const item of payload.suggestions) {
    console.log(`- ${item}`);
  }
} else {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
