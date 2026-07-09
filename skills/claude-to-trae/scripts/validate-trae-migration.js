#!/usr/bin/env node
/**
 * 校验迁移后的 Trae 目录是否具备最小完整性。
 *
 * 用法：
 *   node validate-trae-migration.js
 *   node validate-trae-migration.js <projectRoot>
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(process.argv[2] || process.cwd());
const traeRoot = path.join(projectRoot, '.trae');
const agentsRoot = path.join(projectRoot, '.agents', 'skills');

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

function collectFiles(targetPath, matcher) {
  const results = [];
  if (!isDirectory(targetPath)) return results;

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, matcher));
      continue;
    }
    if (entry.isFile() && matcher(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

function hasFrontmatter(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.startsWith('---\n') || content.startsWith('---\r\n');
  } catch {
    return false;
  }
}

function hasRuleHeaders(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes('alwaysApply:') && content.includes('description:');
  } catch {
    return false;
  }
}

const passed = [];
const warnings = [];
const missing = [];

if (exists(traeRoot)) {
  passed.push('.trae/ 目录存在');
} else {
  missing.push('.trae/ 目录不存在');
}

const skillsRoot = path.join(traeRoot, 'skills');
const rulesRoot = path.join(traeRoot, 'rules');
const commandsRoot = path.join(traeRoot, 'commands');
const hooksFile = path.join(traeRoot, 'hooks.json');
const mcpFile = path.join(traeRoot, 'mcp.json');

if (isDirectory(skillsRoot)) {
  passed.push('.trae/skills/ 目录存在');
} else {
  missing.push('.trae/skills/ 目录不存在');
}

if (isDirectory(rulesRoot)) {
  passed.push('.trae/rules/ 目录存在');
} else {
  warnings.push('.trae/rules/ 目录不存在，若本次迁移包含规则应补齐');
}

if (isDirectory(commandsRoot)) {
  passed.push('.trae/commands/ 目录存在');
} else {
  warnings.push('.trae/commands/ 目录不存在，若本次迁移包含命令应补齐');
}

if (exists(hooksFile)) {
  passed.push('.trae/hooks.json 存在');
} else {
  warnings.push('.trae/hooks.json 不存在，若本次迁移包含 hooks 应补齐');
}

if (exists(mcpFile)) {
  passed.push('.trae/mcp.json 存在');
} else {
  warnings.push('.trae/mcp.json 不存在，若本次迁移包含 MCP 应补齐');
}

const skillFiles = collectFiles(skillsRoot, (filePath) => path.basename(filePath) === 'SKILL.md');
if (skillFiles.length > 0) {
  passed.push(`发现 ${skillFiles.length} 个 Trae skill`);
  for (const filePath of skillFiles) {
    if (!hasFrontmatter(filePath)) {
      warnings.push(`skill 缺少 frontmatter: ${path.relative(projectRoot, filePath)}`);
    }
  }
} else if (isDirectory(skillsRoot)) {
  warnings.push('.trae/skills/ 存在，但未发现任何 SKILL.md');
}

const ruleFiles = collectFiles(rulesRoot, (filePath) => filePath.toLowerCase().endsWith('.md'));
if (ruleFiles.length > 0) {
  passed.push(`发现 ${ruleFiles.length} 个 Trae 规则文件`);
  for (const filePath of ruleFiles) {
    if (!hasFrontmatter(filePath)) {
      warnings.push(`规则缺少 frontmatter: ${path.relative(projectRoot, filePath)}`);
      continue;
    }
    if (!hasRuleHeaders(filePath)) {
      warnings.push(`规则缺少 alwaysApply 或 description: ${path.relative(projectRoot, filePath)}`);
    }
  }
}

const commandFiles = collectFiles(commandsRoot, (filePath) => filePath.toLowerCase().endsWith('.md'));
if (commandFiles.length > 0) {
  passed.push(`发现 ${commandFiles.length} 个 Trae 命令文件`);
}

const agentSkillFiles = collectFiles(agentsRoot, (filePath) => path.basename(filePath) === 'SKILL.md');
if (agentSkillFiles.length > 0) {
  passed.push(`发现 ${agentSkillFiles.length} 个共享 agent skill`);
}

const result = {
  projectRoot,
  summary: {
    passed: passed.length,
    warnings: warnings.length,
    missing: missing.length
  },
  passed,
  warnings,
  missing
};

console.log(JSON.stringify(result, null, 2));

if (missing.length > 0) {
  process.exit(1);
}
