# 提交分析

逐个读取候选提交的 message、文件列表和实际 diff，不凭提交标题或同一路径直接决定覆盖：

```powershell
git show --stat --summary <commit>
git diff <commit>~1 <commit> -- <path>
git diff --ignore-cr-at-eol <lastCommit>..HEAD -- <path>
git diff --ignore-cr-at-eol HEAD <remote>/<branch> -- <path>
```

## 分类

- **建议融合**：适用于本项目的安全修复、缺陷修复、通用模块、系统能力、基础组件或明确兼容的依赖变更。
- **建议跳过**：业务示例、未保留模块、与本项目架构不适用的能力，以及上游框架同步类 Harness。
- **提炼规范**：上游 Skill、说明或 Harness 文件中的长期工程规则；进入 Harness 分流，不原样复制。
- **需要决策**：配置、数据库、认证、密钥、部署、生成模板、公共接口、依赖大版本或本项目已深度定制文件。

路径只是线索。`ruoyi-common`、系统模块、通用组件也可能与本项目定制冲突；业务目录中的安全修复也不能仅因目录名称自动跳过。

## 每项结论必须包含

- 来源提交与实际改动目的。
- 本项目对应文件和从同步基线以来的本地变化。
- 适用性、标识符、配置、数据和兼容风险。
- 建议动作：融合、跳过、提炼规范或等待决策。
- 最小验证方式和可识别的回滚点。

涉及 `.claude/`、`.agents/`、`.codex/`、`.trellis/`、`AGENTS.md`、Skills、Commands、Hooks 或 Agents 时，必须转入 [Harness 分流](harness.md)。

完成标准：范围内每个提交及其受影响文件都有证据支持的处理结论，不存在“默认合并”的未审文件。
