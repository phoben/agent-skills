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
  console.log("  node analyze-zcode-diff.js [目录]");
  console.log("  node analyze-zcode-diff.js [目录] --summary");
  console.log("");
  console.log("说明:");
  console.log("  对比来源配置与目标 ZCode 目录，输出可迁移项、冲突项和需协议转换项。");
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
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

function toRelative(baseDir, filePath) {
  return path.relative(baseDir, filePath).replace(/\\/g, "/");
}

function listSkillFiles(baseDir) {
  if (!exists(baseDir)) {
    return new Map();
  }

  const map = new Map();
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillFile = path.join(baseDir, entry.name, "SKILL.md");
    if (exists(skillFile)) {
      map.set(`${entry.name}/SKILL.md`, skillFile);
    }
  }

  return map;
}

function listFiles(baseDir, predicate) {
  const map = new Map();
  for (const filePath of walkFiles(baseDir)) {
    if (!predicate(filePath)) {
      continue;
    }
    map.set(toRelative(baseDir, filePath), filePath);
  }
  return map;
}

function compareMaps(options) {
  const {
    category,
    sourceLabel,
    targetLabel,
    sourceBase,
    targetBase,
    sourceMap,
    targetMap,
    groups,
    forceProtocolConversion
  } = options;

  for (const [relativePath, sourcePath] of sourceMap.entries()) {
    const targetPath = targetMap.get(relativePath) || path.join(targetBase, relativePath);
    const targetExists = targetMap.has(relativePath) || exists(targetPath);

    if (forceProtocolConversion) {
      groups.needsProtocolConversion.push({
        category,
        source: path.join(sourceLabel, relativePath).replace(/\\/g, "/"),
        target: path.join(targetLabel, relativePath).replace(/\\/g, "/"),
        reason: "该资源属于结构或协议敏感类型，不能按纯复制处理。"
      });
      continue;
    }

    if (!targetExists) {
      groups.toAdd.push({
        category,
        source: path.join(sourceLabel, relativePath).replace(/\\/g, "/"),
        target: path.join(targetLabel, relativePath).replace(/\\/g, "/"),
        reason: "目标缺失，可新增。"
      });
      continue;
    }

    const sourceContent = readText(sourcePath);
    const targetContent = readText(targetPath);

    if (sourceContent !== null && targetContent !== null && sourceContent === targetContent) {
      groups.same.push({
        category,
        source: path.join(sourceLabel, relativePath).replace(/\\/g, "/"),
        target: path.join(targetLabel, relativePath).replace(/\\/g, "/"),
        reason: "内容一致，可跳过。"
      });
    } else {
      groups.conflicts.push({
        category,
        source: path.join(sourceLabel, relativePath).replace(/\\/g, "/"),
        target: path.join(targetLabel, relativePath).replace(/\\/g, "/"),
        reason: "同名目标已存在但内容不同，需人工确认。"
      });
    }
  }
}

function comparePluginManifest(sourcePluginDir, groups) {
  const sourcePath = path.join(rootDir, sourcePluginDir, "plugin.json");
  const targetPath = path.join(rootDir, ".zcode-plugin", "plugin.json");
  if (!exists(sourcePath)) {
    return;
  }

  if (!exists(targetPath)) {
    groups.needsProtocolConversion.push({
      category: "plugin-manifest",
      source: `${sourcePluginDir}/plugin.json`,
      target: ".zcode-plugin/plugin.json",
      reason: "来源 manifest 需要归一化到 ZCode 插件位置与字段结构。"
    });
    return;
  }

  const sourceContent = readText(sourcePath);
  const targetContent = readText(targetPath);
  if (sourceContent === targetContent) {
    groups.same.push({
      category: "plugin-manifest",
      source: `${sourcePluginDir}/plugin.json`,
      target: ".zcode-plugin/plugin.json",
      reason: "manifest 内容一致。"
    });
  } else {
    groups.needsProtocolConversion.push({
      category: "plugin-manifest",
      source: `${sourcePluginDir}/plugin.json`,
      target: ".zcode-plugin/plugin.json",
      reason: "manifest 存在差异，需要按 ZCode 插件规范重新整理。"
    });
  }
}

function addSharedSkillChecks(groups) {
  const sharedDir = path.join(rootDir, ".agents", "skills");
  const zcodeDir = path.join(rootDir, ".zcode", "skills");
  const sharedSkills = listSkillFiles(sharedDir);
  const zcodeSkills = listSkillFiles(zcodeDir);

  for (const [relativePath, sharedPath] of sharedSkills.entries()) {
    const zcodePath = zcodeSkills.get(relativePath);
    if (!zcodePath) {
      continue;
    }

    const sharedContent = readText(sharedPath);
    const zcodeContent = readText(zcodePath);
    if (sharedContent !== zcodeContent) {
      groups.needsManualConfirmation.push({
        category: "shared-skill-shadow",
        source: `.agents/skills/${relativePath}`,
        target: `.zcode/skills/${relativePath}`,
        reason: "发现共享 skill 与工作区 skill 同名但内容不同，需确认覆盖关系。"
      });
    }
  }
}

const groups = {
  toAdd: [],
  same: [],
  conflicts: [],
  needsProtocolConversion: [],
  needsManualConfirmation: []
};

compareMaps({
  category: "workspace-skills",
  sourceLabel: ".claude/skills",
  targetLabel: ".zcode/skills",
  sourceBase: path.join(rootDir, ".claude", "skills"),
  targetBase: path.join(rootDir, ".zcode", "skills"),
  sourceMap: listSkillFiles(path.join(rootDir, ".claude", "skills")),
  targetMap: listSkillFiles(path.join(rootDir, ".zcode", "skills")),
  groups,
  forceProtocolConversion: false
});

compareMaps({
  category: "workspace-commands",
  sourceLabel: ".claude/commands",
  targetLabel: ".zcode/commands",
  sourceBase: path.join(rootDir, ".claude", "commands"),
  targetBase: path.join(rootDir, ".zcode", "commands"),
  sourceMap: listFiles(path.join(rootDir, ".claude", "commands"), (filePath) => filePath.endsWith(".md")),
  targetMap: listFiles(path.join(rootDir, ".zcode", "commands"), (filePath) => filePath.endsWith(".md")),
  groups,
  forceProtocolConversion: false
});

compareMaps({
  category: "workspace-agents",
  sourceLabel: ".claude/agents",
  targetLabel: ".zcode/agents",
  sourceBase: path.join(rootDir, ".claude", "agents"),
  targetBase: path.join(rootDir, ".zcode", "agents"),
  sourceMap: listFiles(path.join(rootDir, ".claude", "agents"), (filePath) => filePath.endsWith(".md")),
  targetMap: listFiles(path.join(rootDir, ".zcode", "agents"), (filePath) => filePath.endsWith(".md")),
  groups,
  forceProtocolConversion: false
});

compareMaps({
  category: "workspace-templates",
  sourceLabel: ".claude/templates",
  targetLabel: ".zcode/templates",
  sourceBase: path.join(rootDir, ".claude", "templates"),
  targetBase: path.join(rootDir, ".zcode", "templates"),
  sourceMap: listFiles(path.join(rootDir, ".claude", "templates"), () => true),
  targetMap: listFiles(path.join(rootDir, ".zcode", "templates"), () => true),
  groups,
  forceProtocolConversion: false
});

compareMaps({
  category: "workspace-hooks",
  sourceLabel: ".claude/hooks",
  targetLabel: ".zcode/hooks",
  sourceBase: path.join(rootDir, ".claude", "hooks"),
  targetBase: path.join(rootDir, ".zcode", "hooks"),
  sourceMap: listFiles(path.join(rootDir, ".claude", "hooks"), () => true),
  targetMap: listFiles(path.join(rootDir, ".zcode", "hooks"), () => true),
  groups,
  forceProtocolConversion: true
});

if (exists(path.join(rootDir, ".claude", "settings.json"))) {
  groups.needsProtocolConversion.push({
    category: "workspace-config",
    source: ".claude/settings.json",
    target: ".zcode/config.json",
    reason: "需要从 Claude 配置结构转换到 ZCode 的 hooks.events 与 mcp.servers。"
  });
}

for (const sourcePlugin of [".claude-plugin", ".codex-plugin"]) {
  comparePluginManifest(sourcePlugin, groups);
  compareMaps({
    category: `${sourcePlugin}-skills`,
    sourceLabel: `${sourcePlugin}/skills`,
    targetLabel: ".zcode-plugin/skills",
    sourceBase: path.join(rootDir, sourcePlugin, "skills"),
    targetBase: path.join(rootDir, ".zcode-plugin", "skills"),
    sourceMap: listSkillFiles(path.join(rootDir, sourcePlugin, "skills")),
    targetMap: listSkillFiles(path.join(rootDir, ".zcode-plugin", "skills")),
    groups,
    forceProtocolConversion: false
  });
  compareMaps({
    category: `${sourcePlugin}-commands`,
    sourceLabel: `${sourcePlugin}/commands`,
    targetLabel: ".zcode-plugin/commands",
    sourceBase: path.join(rootDir, sourcePlugin, "commands"),
    targetBase: path.join(rootDir, ".zcode-plugin", "commands"),
    sourceMap: listFiles(path.join(rootDir, sourcePlugin, "commands"), (filePath) => filePath.endsWith(".md")),
    targetMap: listFiles(path.join(rootDir, ".zcode-plugin", "commands"), (filePath) => filePath.endsWith(".md")),
    groups,
    forceProtocolConversion: false
  });
  compareMaps({
    category: `${sourcePlugin}-hooks`,
    sourceLabel: `${sourcePlugin}/hooks`,
    targetLabel: ".zcode-plugin/hooks",
    sourceBase: path.join(rootDir, sourcePlugin, "hooks"),
    targetBase: path.join(rootDir, ".zcode-plugin", "hooks"),
    sourceMap: listFiles(path.join(rootDir, sourcePlugin, "hooks"), () => true),
    targetMap: listFiles(path.join(rootDir, ".zcode-plugin", "hooks"), () => true),
    groups,
    forceProtocolConversion: true
  });
  compareMaps({
    category: `${sourcePlugin}-templates`,
    sourceLabel: `${sourcePlugin}/templates`,
    targetLabel: ".zcode-plugin/templates",
    sourceBase: path.join(rootDir, sourcePlugin, "templates"),
    targetBase: path.join(rootDir, ".zcode-plugin", "templates"),
    sourceMap: listFiles(path.join(rootDir, sourcePlugin, "templates"), () => true),
    targetMap: listFiles(path.join(rootDir, ".zcode-plugin", "templates"), () => true),
    groups,
    forceProtocolConversion: false
  });
  compareMaps({
    category: `${sourcePlugin}-scripts`,
    sourceLabel: `${sourcePlugin}/scripts`,
    targetLabel: ".zcode-plugin/scripts",
    sourceBase: path.join(rootDir, sourcePlugin, "scripts"),
    targetBase: path.join(rootDir, ".zcode-plugin", "scripts"),
    sourceMap: listFiles(path.join(rootDir, sourcePlugin, "scripts"), () => true),
    targetMap: listFiles(path.join(rootDir, ".zcode-plugin", "scripts"), () => true),
    groups,
    forceProtocolConversion: false
  });
}

if (exists(path.join(rootDir, ".codex", "agents"))) {
  groups.needsManualConfirmation.push({
    category: "codex-agents",
    source: ".codex/agents",
    target: ".zcode/agents",
    reason: "Codex agents 通常为 TOML，需要确认如何转换为 ZCode markdown agent。"
  });
}

addSharedSkillChecks(groups);

const payload = {
  rootDir,
  analyzedAt: new Date().toISOString(),
  groups
};

if (summaryOnly) {
  console.log("差异分析摘要");
  console.log("================");
  console.log(`可新增: ${groups.toAdd.length}`);
  console.log(`内容一致: ${groups.same.length}`);
  console.log(`存在冲突: ${groups.conflicts.length}`);
  console.log(`需协议转换: ${groups.needsProtocolConversion.length}`);
  console.log(`需人工确认: ${groups.needsManualConfirmation.length}`);
  console.log("");

  for (const key of ["toAdd", "conflicts", "needsProtocolConversion", "needsManualConfirmation"]) {
    if (groups[key].length === 0) {
      continue;
    }
    console.log(`${key}:`);
    for (const item of groups[key]) {
      console.log(`- [${item.category}] ${item.source} -> ${item.target} (${item.reason})`);
    }
    console.log("");
  }
} else {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
