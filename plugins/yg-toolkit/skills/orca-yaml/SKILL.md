---
name: orca-yaml
description: 解释、检查或编写 Orca 项目的 orca.yaml 配置，涵盖工作区脚本、终端、共享目录和环境配方；不替代云资源部署流程。
---

# Orca 配置指南

用于解释 Orca 的 `orca.yaml`、审查现有配置或根据用户需求编写配置。先区分用户只是咨询，还是已要求修改项目；只在授权范围内修改。配置文件通常位于 Git 仓库根目录，不要把密码、令牌等秘密写入其中。

## 使用方式

1. 明确目标 Orca 版本、运行平台和项目根目录；涉及现有项目时，先检查现有配置、相关脚本和工作区状态，保留无关内容。无法确认版本时说明限制。
2. 工作区脚本、终端、事项模板和共享目录的字段与行为见 [配置参考](references/configuration.md)。涉及独立环境时再读 [环境配方](references/environment-recipes.md)。
3. 参考资料是有日期的快照。配置行为可能随版本变化：优先核对目标版本内置说明、官方文档或源码；无法核实时标记未验证，不把未知字段当作有效配置。
4. 结合实际系统给出可执行示例；说明配置从主检出目录还是新工作区读取，以及执行时机、覆盖关系和实际影响。不要把其他工具的同名 `orca.yaml` 配置混入。
5. 修改后检查 YAML 语法、重复键、路径及平台命令；按需使用只读检查验证。`orca vm recipe doctor` 默认只检查静态配置，实际创建环境的 `--provision` 会执行创建和销毁，不能把静态通过当作运行成功。涉及云资源、交互登录或其他外部操作时遵守用户授权。

官方入口：[orca.yaml 参考](https://github.com/stablyai/orca/blob/main/docs/site/content/docs/model/orca-yaml.mdx)；本机可用 `orca --version` 和 `orca skills get orca-per-workspace-env` 查询版本及配方说明。
