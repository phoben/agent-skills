# repo-user-manual 上架包制作说明

## 做了什么

把工作区里的 `skills/repo-user-manual` 改造成符合 WorkBuddy 开放平台规范的技能上架包，输出了可直接上传的 zip、市场图标和提交材料。

## 关键改动

原始 `SKILL.md` 是通用 Agent Skill 格式，直接上传会导致平台解析失败或市场卡片空白。对照官方技能规范（https://open.workbuddy.cn/docs/skill）做了以下调整：

1. **补齐 frontmatter 必填字段**：新增 `display_name`（市场展示名称）、`display_name_en`、`description_zh`、`description_en`、`category`、`allowed-tools`、`user-invocable`、`disable-model-invocation`；`description` 改写为中英混合的「用途 + 触发词 + 不触发边界」。
2. **资源引用改为平台可解析写法**：正文里 `[xxx.md](references/xxx.md)` 改为 `@references/xxx.md`。
3. **补上脚本调用说明**：`scripts/manual_state.py` 原本只在 references 里描述，正文没有调用入口。新增了 `plan` / `snapshot` 两个子命令的示例，明确「人工复核通过后才写基线」。
4. **移除打包目录内的 `agents/openai.yaml`**：属非平台规范目录，避免校验歧义。
5. **新增 `CHANGELOG.md`**：给市场用户看的版本说明。

## 产出文件

| 文件 | 用途 |
|---|---|
| `dist/repo-user-manual.zip` | 上传到开放平台的技能包（18.5 KB / 上限 3 MB） |
| `dist/icon-512.jpg` / `icon-512.png` | 512×512 市场图标（19 KB / 113 KB，均低于 500 KB 上限） |
| `dist/上架提交材料.md` | 逐字段填写参考 + 介绍文案 + 推荐提示词 + 自查清单 |
| `dist/repo-user-manual/` | 打包源目录（改内容后重新打 zip 即可） |
| `dist/icon.html` | 图标源文件（改色改形后可重新渲染） |

## 校验结果

- 包内两级目录，无多余嵌套 ✅
- frontmatter 必填字段齐全，`description_zh` 151 字 ✅
- 无硬编码密钥 / Token / 临时文件 ✅
- 脚本无破坏性操作，仅读仓库并写 `docs/user-manual/` 下的元数据 ✅

## 下一步

1. 上传 zip、选分类（建议 效率工具 / 开发工具 / 知识与学习）、传图标、提交审核
2. 审核通过后选「公开发布」
3. 发布后在客户端实际安装跑一遍，确认市场描述与实际能力一致
