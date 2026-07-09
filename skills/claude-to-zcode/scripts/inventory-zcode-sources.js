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
  console.log("  node inventory-zcode-sources.js [目录]");
  console.log("  node inventory-zcode-sources.js [目录] --summary");
  console.log("");
  console.log("说明:");
  console.log("  盘点工作区与插件来源目录，帮助判断 ZCode 迁移的输入边界。");
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
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

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries
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
      templates: relativeList(path.join(baseDir, "templates"), () => true),
      hooks: relativeList(path.join(baseDir, "hooks"), () => true),
      scripts: relativeList(path.join(baseDir, "scripts"), () => true)
    },
    configFiles: {
      settingsJson: exists(path.join(baseDir, "settings.json")),
      configJson: exists(path.join(baseDir, "config.json"))
    }
  };
}

function summarizePlugin(name) {
  const baseDir = path.join(rootDir, name);
  const manifestPath = path.join(baseDir, "plugin.json");
  let manifestKeys = [];

  if (exists(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      manifestKeys = Object.keys(manifest).sort();
    } catch {
      manifestKeys = ["<plugin.json 无法解析>"];
    }
  }

  return {
    name,
    path: baseDir,
    exists: exists(baseDir),
    manifestExists: exists(manifestPath),
    manifestKeys,
    resources: {
      skills: listSkillNames(path.join(baseDir, "skills")),
      commands: relativeList(path.join(baseDir, "commands"), (filePath) => filePath.endsWith(".md")),
      hooks: relativeList(path.join(baseDir, "hooks"), () => true),
      scripts: relativeList(path.join(baseDir, "scripts"), () => true),
      templates: relativeList(path.join(baseDir, "templates"), () => true)
    }
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

function makeSuggestions(workspaces, plugins, sharedSkills) {
  const suggestions = [];
  const claude = workspaces.find((item) => item.name === ".claude");
  const zcode = workspaces.find((item) => item.name === ".zcode");
  const zcodePlugin = plugins.find((item) => item.name === ".zcode-plugin");
  const pluginSources = plugins.filter((item) => item.exists && item.name !== ".zcode-plugin");

  if (claude && claude.exists && (!zcode || !zcode.exists)) {
    suggestions.push("发现 `.claude` 但未发现 `.zcode`，建议优先规划工作区迁移。");
  }

  if (claude && claude.exists && zcode && zcode.exists) {
    suggestions.push("同时发现 `.claude` 与 `.zcode`，建议先做差异分析，不要直接覆盖。");
  }

  if (pluginSources.length > 0 && (!zcodePlugin || !zcodePlugin.exists)) {
    suggestions.push("发现来源插件目录但未发现 `.zcode-plugin`，建议规划插件包迁移。");
  }

  if (zcodePlugin && zcodePlugin.exists && !zcodePlugin.manifestExists) {
    suggestions.push("已发现 `.zcode-plugin` 目录但缺少 `plugin.json`，插件迁移需要先补 manifest。");
  }

  if (sharedSkills.exists && sharedSkills.skills.length > 0) {
    suggestions.push("发现 `.agents/skills`，迁移时需检查与 `.zcode/skills` 的同名覆盖关系。");
  }

  if (suggestions.length === 0) {
    suggestions.push("未发现明显冲突，可继续做资源级盘点与分类。");
  }

  return suggestions;
}

function countSummary(items) {
  return {
    skills: items.resources.skills.length,
    commands: items.resources.commands.length,
    agents: items.resources.agents ? items.resources.agents.length : 0,
    templates: items.resources.templates.length,
    hooks: items.resources.hooks.length,
    scripts: items.resources.scripts.length
  };
}

const workspaces = [".claude", ".zcode"].map(summarizeWorkspace);
const plugins = [".claude-plugin", ".codex-plugin", ".zcode-plugin"].map(summarizePlugin);
const sharedSkills = summarizeSharedSkills();
const payload = {
  rootDir,
  scannedAt: new Date().toISOString(),
  workspaces,
  plugins,
  sharedSkills,
  suggestions: makeSuggestions(workspaces, plugins, sharedSkills)
};

if (summaryOnly) {
  console.log("来源盘点摘要");
  console.log("================");

  for (const workspace of workspaces) {
    const stat = safeStat(workspace.path);
    console.log(`${workspace.name}: ${workspace.exists ? "存在" : "不存在"}`);
    if (workspace.exists && stat && stat.isDirectory()) {
      const summary = countSummary(workspace);
      console.log(`  skills=${summary.skills}, commands=${summary.commands}, agents=${summary.agents}, templates=${summary.templates}, hooks=${summary.hooks}, scripts=${summary.scripts}`);
    }
  }

  for (const plugin of plugins) {
    console.log(`${plugin.name}: ${plugin.exists ? "存在" : "不存在"}`);
    if (plugin.exists) {
      console.log(`  plugin.json: ${plugin.manifestExists ? "存在" : "不存在"}`);
      console.log(`  skills=${plugin.resources.skills.length}, commands=${plugin.resources.commands.length}, hooks=${plugin.resources.hooks.length}, scripts=${plugin.resources.scripts.length}, templates=${plugin.resources.templates.length}`);
    }
  }

  console.log(`.agents/skills: ${sharedSkills.exists ? "存在" : "不存在"}`);
  if (sharedSkills.exists) {
    console.log(`  skills=${sharedSkills.skills.length}`);
  }

  console.log("");
  console.log("建议动作:");
  for (const item of payload.suggestions) {
    console.log(`- ${item}`);
  }
} else {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
