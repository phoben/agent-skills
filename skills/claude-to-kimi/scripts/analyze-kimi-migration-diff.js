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
  console.log("  node analyze-kimi-migration-diff.js [目录]");
  console.log("  node analyze-kimi-migration-diff.js [目录] --summary");
  console.log("");
  console.log("说明:");
  console.log("  对比 Claude 来源资源与 Kimi 目标目录，输出可迁移项、冲突项和需协议改写项。");
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

function listAgentFiles(baseDir) {
  return listFiles(baseDir, (filePath) => filePath.endsWith(".md"));
}

function compareMaps(options) {
  const {
    category,
    sourceLabel,
    targetLabel,
    targetBase,
    sourceMap,
    targetMap,
    groups,
    forceRewrite
  } = options;

  for (const [relativePath, sourcePath] of sourceMap.entries()) {
    const targetPath = targetMap.get(relativePath) || path.join(targetBase, relativePath);
    const targetExists = targetMap.has(relativePath) || exists(targetPath);

    if (forceRewrite) {
      groups.needsRewrite.push({
        category,
        source: path.join(sourceLabel, relativePath).replace(/\\/g, "/"),
        target: path.join(targetLabel, relativePath).replace(/\\/g, "/"),
        reason: "该资源属于协议敏感类型，需要按 Kimi 规则改写。"
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

function compareManifest(sourcePluginDir, groups) {
  const sourcePath = path.join(rootDir, sourcePluginDir, "plugin.json");
  const targetPath = path.join(rootDir, "kimi.plugin.json");
  const hiddenTargetPath = path.join(rootDir, ".kimi-plugin", "plugin.json");

  if (!exists(sourcePath)) {
    return;
  }

  if (!exists(targetPath) && !exists(hiddenTargetPath)) {
    groups.needsTransform.push({
      category: "plugin-manifest",
      source: `${sourcePluginDir}/plugin.json`,
      target: "kimi.plugin.json",
      reason: "来源 manifest 需要转换到 Kimi 的 manifest 位置与字段结构。"
    });
    return;
  }

  const actualTarget = exists(targetPath) ? targetPath : hiddenTargetPath;
  const actualTargetLabel = exists(targetPath) ? "kimi.plugin.json" : ".kimi-plugin/plugin.json";
  const sourceContent = readText(sourcePath);
  const targetContent = readText(actualTarget);

  if (sourceContent === targetContent) {
    groups.same.push({
      category: "plugin-manifest",
      source: `${sourcePluginDir}/plugin.json`,
      target: actualTargetLabel,
      reason: "manifest 内容一致。"
    });
  } else {
    groups.needsTransform.push({
      category: "plugin-manifest",
      source: `${sourcePluginDir}/plugin.json`,
      target: actualTargetLabel,
      reason: "manifest 存在差异，需要按 Kimi plugin 规范重新整理。"
    });
  }
}

function addAgentReviewWarnings(groups) {
  const sources = [
    ".claude/agents",
    ".claude-plugin/agents",
    ".codex-plugin/agents"
  ];

  for (const source of sources) {
    const sourceMap = listAgentFiles(path.join(rootDir, source));
    for (const [relativePath, fullPath] of sourceMap.entries()) {
      const content = readText(fullPath) || "";
      const normalizedSource = path.join(source, relativePath).replace(/\\/g, "/");

      if (!content.startsWith("---")) {
        groups.needsManualConfirmation.push({
          category: "agent-review",
          source: normalizedSource,
          target: ".agents/agents or .kimi-code/agents",
          reason: "来源 Agent 缺少 frontmatter，需要人工确认是否为合法 Kimi Agent 文件。"
        });
        continue;
      }

      if (!/^\s*description:/m.test(content)) {
        groups.needsManualConfirmation.push({
          category: "agent-review",
          source: normalizedSource,
          target: ".agents/agents or .kimi-code/agents",
          reason: "来源 Agent 缺少 `description` 字段，需要人工补齐后再迁移。"
        });
      }

      if (/\b(tools|disallowedTools|subagents|override)\s*:/m.test(content)) {
        groups.needsManualConfirmation.push({
          category: "agent-review",
          source: normalizedSource,
          target: ".agents/agents or .kimi-code/agents",
          reason: "来源 Agent 含工具权限或覆盖配置，建议人工确认 `tools`、`subagents`、`override` 语义。"
        });
      }
    }
  }
}

function addUnsupportedFieldWarnings(groups) {
  const manifests = [
    path.join(rootDir, ".claude-plugin", "plugin.json"),
    path.join(rootDir, ".codex-plugin", "plugin.json")
  ];

  const unsupportedFields = ["tools", "apps", "inject", "configFile"];

  for (const manifestPath of manifests) {
    if (!exists(manifestPath)) {
      continue;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      for (const key of unsupportedFields) {
        if (Object.prototype.hasOwnProperty.call(manifest, key)) {
          groups.needsManualConfirmation.push({
            category: "unsupported-plugin-field",
            source: path.relative(rootDir, manifestPath).replace(/\\/g, "/"),
            target: "kimi.plugin.json",
            reason: `发现来源 manifest 字段 \`${key}\`，Kimi 文档未公开支持该运行时字段。`
          });
        }
      }
    } catch {
      groups.needsManualConfirmation.push({
        category: "plugin-manifest-parse",
        source: path.relative(rootDir, manifestPath).replace(/\\/g, "/"),
        target: "kimi.plugin.json",
        reason: "来源 manifest 无法解析，需要先修复 JSON。"
      });
    }
  }
}

const groups = {
  toAdd: [],
  same: [],
  conflicts: [],
  needsTransform: [],
  needsRewrite: [],
  needsManualConfirmation: []
};

compareMaps({
  category: "workspace-skills",
  sourceLabel: ".claude/skills",
  targetLabel: ".agents/skills",
  targetBase: path.join(rootDir, ".agents", "skills"),
  sourceMap: listSkillFiles(path.join(rootDir, ".claude", "skills")),
  targetMap: listSkillFiles(path.join(rootDir, ".agents", "skills")),
  groups,
  forceRewrite: false
});

compareMaps({
  category: "shared-skills",
  sourceLabel: ".agents/skills",
  targetLabel: ".agents/skills",
  targetBase: path.join(rootDir, ".agents", "skills"),
  sourceMap: listSkillFiles(path.join(rootDir, ".agents", "skills")),
  targetMap: listSkillFiles(path.join(rootDir, ".agents", "skills")),
  groups,
  forceRewrite: false
});

compareMaps({
  category: "workspace-agents",
  sourceLabel: ".claude/agents",
  targetLabel: ".agents/agents",
  targetBase: path.join(rootDir, ".agents", "agents"),
  sourceMap: listAgentFiles(path.join(rootDir, ".claude", "agents")),
  targetMap: listAgentFiles(path.join(rootDir, ".agents", "agents")),
  groups,
  forceRewrite: false
});

for (const sourcePlugin of [".claude-plugin", ".codex-plugin"]) {
  compareManifest(sourcePlugin, groups);

  compareMaps({
    category: `${sourcePlugin}-skills`,
    sourceLabel: `${sourcePlugin}/skills`,
    targetLabel: "skills",
    targetBase: path.join(rootDir, "skills"),
    sourceMap: listSkillFiles(path.join(rootDir, sourcePlugin, "skills")),
    targetMap: listSkillFiles(path.join(rootDir, "skills")),
    groups,
    forceRewrite: false
  });

  compareMaps({
    category: `${sourcePlugin}-commands`,
    sourceLabel: `${sourcePlugin}/commands`,
    targetLabel: "commands",
    targetBase: path.join(rootDir, "commands"),
    sourceMap: listFiles(path.join(rootDir, sourcePlugin, "commands"), (filePath) => filePath.endsWith(".md")),
    targetMap: listFiles(path.join(rootDir, "commands"), (filePath) => filePath.endsWith(".md")),
    groups,
    forceRewrite: false
  });

  compareMaps({
    category: `${sourcePlugin}-hooks`,
    sourceLabel: `${sourcePlugin}/hooks`,
    targetLabel: "hooks",
    targetBase: path.join(rootDir, "hooks"),
    sourceMap: listFiles(path.join(rootDir, sourcePlugin, "hooks"), () => true),
    targetMap: listFiles(path.join(rootDir, "hooks"), () => true),
    groups,
    forceRewrite: true
  });

  compareMaps({
    category: `${sourcePlugin}-scripts`,
    sourceLabel: `${sourcePlugin}/scripts`,
    targetLabel: "scripts",
    targetBase: path.join(rootDir, "scripts"),
    sourceMap: listFiles(path.join(rootDir, sourcePlugin, "scripts"), () => true),
    targetMap: listFiles(path.join(rootDir, "scripts"), () => true),
    groups,
    forceRewrite: false
  });

  compareMaps({
    category: `${sourcePlugin}-agents`,
    sourceLabel: `${sourcePlugin}/agents`,
    targetLabel: ".agents/agents",
    targetBase: path.join(rootDir, ".agents", "agents"),
    sourceMap: listAgentFiles(path.join(rootDir, sourcePlugin, "agents")),
    targetMap: listAgentFiles(path.join(rootDir, ".agents", "agents")),
    groups,
    forceRewrite: false
  });
}

if (exists(path.join(rootDir, ".claude", "settings.json"))) {
  groups.needsTransform.push({
    category: "workspace-config",
    source: ".claude/settings.json",
    target: ".kimi-code/mcp.json and ~/.kimi-code/config.toml",
    reason: "Claude 配置需拆分到 Kimi 的 MCP 与 hooks 配置，不可直接复制。"
  });
}

addAgentReviewWarnings(groups);
addUnsupportedFieldWarnings(groups);

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
  console.log(`需结构转换: ${groups.needsTransform.length}`);
  console.log(`需协议改写: ${groups.needsRewrite.length}`);
  console.log(`需人工确认: ${groups.needsManualConfirmation.length}`);
  console.log("");

  for (const key of ["toAdd", "conflicts", "needsTransform", "needsRewrite", "needsManualConfirmation"]) {
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
