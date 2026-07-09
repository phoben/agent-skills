#!/usr/bin/env node
/**
 * 扫描项目中的常见工程化配置目录，并输出结构化清单。
 *
 * 用法：
 *   node inventory-source-configs.js
 *   node inventory-source-configs.js <projectRoot>
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(process.argv[2] || process.cwd());

const sources = [
  { key: 'claude', root: '.claude' },
  { key: 'codex', root: '.codex' },
  { key: 'zcode', root: '.zcode' },
  { key: 'agents', root: path.join('.agents', 'skills') }
];

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

function isDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function listEntries(targetPath) {
  if (!isDirectory(targetPath)) return [];
  return fs.readdirSync(targetPath, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    isDirectory: entry.isDirectory(),
    isFile: entry.isFile()
  }));
}

function countMarkdownFiles(targetPath) {
  if (!isDirectory(targetPath)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      count += countMarkdownFiles(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      count += 1;
    }
  }
  return count;
}

function countSkillDirs(targetPath) {
  if (!isDirectory(targetPath)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(targetPath, entry.name, 'SKILL.md');
    if (exists(skillPath)) count += 1;
  }
  return count;
}

function countHookScripts(targetPath) {
  if (!isDirectory(targetPath)) return 0;
  return fs
    .readdirSync(targetPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => /\.(cjs|mjs|js|ps1|sh)$/i.test(entry.name)).length;
}

function summarizeSource(source) {
  const rootPath = path.join(projectRoot, source.root);
  if (!exists(rootPath)) {
    return {
      source: source.key,
      root: source.root,
      exists: false
    };
  }

  const summary = {
    source: source.key,
    root: source.root,
    exists: true,
    counts: {},
    directCopyCandidates: [],
    transformCandidates: [],
    manualReviewCandidates: []
  };

  if (source.key === 'claude') {
    summary.counts.skills = countSkillDirs(path.join(rootPath, 'skills'));
    summary.counts.commands = countMarkdownFiles(path.join(rootPath, 'commands'));
    summary.counts.agents = countMarkdownFiles(path.join(rootPath, 'agents'));
    summary.counts.hooks = countHookScripts(path.join(rootPath, 'hooks'));
    summary.directCopyCandidates.push('.claude/skills -> .trae/skills 或 .agents/skills');
    summary.transformCandidates.push('.claude/settings.json -> .trae/hooks.json / .trae/mcp.json');
    summary.manualReviewCandidates.push('.claude/agents -> 需要双轨判定');
  } else if (source.key === 'codex') {
    summary.counts.skills = countSkillDirs(path.join(rootPath, 'skills'));
    summary.counts.hooks = countHookScripts(path.join(rootPath, 'hooks'));
    summary.transformCandidates.push('.codex/skills -> 区分 skill 还是 command');
    summary.transformCandidates.push('.codex/hooks.json -> .trae/hooks.json');
    summary.manualReviewCandidates.push('.codex/agents -> 先判断实际格式');
  } else if (source.key === 'zcode') {
    summary.counts.skills = countSkillDirs(path.join(rootPath, 'skills'));
    summary.counts.commands = countMarkdownFiles(path.join(rootPath, 'commands'));
    summary.counts.agents = countMarkdownFiles(path.join(rootPath, 'agents'));
    summary.counts.hooks = countHookScripts(path.join(rootPath, 'hooks'));
    summary.directCopyCandidates.push('.zcode/commands -> .trae/commands');
    summary.transformCandidates.push('.zcode/config.json -> .trae/hooks.json / .trae/mcp.json');
    summary.manualReviewCandidates.push('.zcode/agents -> 需要双轨判定');
  } else if (source.key === 'agents') {
    summary.counts.skills = countSkillDirs(rootPath);
    summary.directCopyCandidates.push('.agents/skills -> 保持共享层');
    summary.transformCandidates.push('.agents/skills -> .trae/skills 覆盖版');
  }

  return summary;
}

function detectConflicts(summaries) {
  const nameMap = new Map();
  const conflicts = [];

  for (const summary of summaries) {
    if (!summary.exists) continue;
    const scanRoots = [];
    if (summary.source === 'agents') {
      scanRoots.push(path.join(projectRoot, summary.root));
    } else {
      scanRoots.push(path.join(projectRoot, summary.root, 'skills'));
      scanRoots.push(path.join(projectRoot, summary.root, 'agents'));
    }

    for (const scanRoot of scanRoots) {
      if (!isDirectory(scanRoot)) continue;
      for (const entry of listEntries(scanRoot)) {
        if (!entry.isDirectory) continue;
        const key = entry.name;
        const hit = {
          source: summary.source,
          path: path.relative(projectRoot, path.join(scanRoot, entry.name))
        };
        if (!nameMap.has(key)) {
          nameMap.set(key, [hit]);
        } else {
          nameMap.get(key).push(hit);
        }
      }
    }
  }

  for (const [name, hits] of nameMap.entries()) {
    if (hits.length > 1) {
      conflicts.push({ name, hits });
    }
  }

  return conflicts;
}

const summaries = sources.map(summarizeSource);
const result = {
  projectRoot,
  detectedSources: summaries,
  conflicts: detectConflicts(summaries),
  recommendations: [
    '先区分哪些资源是直接复制，哪些需要结构转换。',
    '对 agents 一律补充双轨落点判定。',
    '对 hooks 和 mcp 配置单独生成迁移清单。',
    '迁移后使用校验脚本检查 .trae 结构完整性。'
  ]
};

console.log(JSON.stringify(result, null, 2));
