# 任务与会话剩余行为审计

2026-11-04，审计当前 0.2.4 源码。范围为 R6、A6、A10、A11、A12；只读检查，未改产品源码，未读取实际聊天、打开聊天、发送消息或写 GitHub。既有桌面清单仍标 0.2.0，只能作为待操作步骤，不能作为当前版本通过证据。

## 明确结论与最小顺序

先修持久身份与工作区修改入口，再补歧义/历史的受控恢复，最后补任务引用显示。已有新草稿链接、默认提示词、精确 nonce 唯一匹配及重复打开保护可继续复用，不必重写任务系统。实际工作区、新草稿可编辑且未发送、原未发送草稿是否被宿主保留，仍需要真实桌面点检。

## 有代码依据的功能缺口

| 事项 | 当前行为与依据 | 最小建议 |
| --- | --- | --- |
| 同账号升级或配置变化后旧关联不可恢复 | `src/host/bridge.mjs:15` 指纹包含 codexHome、auth.json/config.toml 的 size/mtime；`:101` identity 为连接指纹加 RPC accountId 的 hash。`services/issue-tasks.mjs:36` 用其再次构造 SQLite scope，`:56` 还校验记录的 codexIdentity。`test/bridge.test.mjs:60` 明确预期同 accountId 在 config mtime 变化后 identity 不同。因此配置改动、安装导致 config 更新、认证文件更新，都可能令同账号看不到原任务与绑定。 | 连接指纹继续做重连和旧响应失效；新增稳定持久身份，用规范 codexHome 与当前只读 RPC 返回的 accountId 计算。不能用易变 mtime 或插件版本作为持久归属。任务记录明确身份格式版本。兼容限制见下节。 |
| 有效工作区绑定无法在页面修改 | 服务有 `bind`，`ui/store.mjs:370` 也可调用。但 `ui/app.mjs:583` 会话菜单只有另建/查看；`:542` 只要 binding.valid 就直接打开，不提供重新选择。A10 的“绑定可修改”因此尚缺页面入口。 | 增加“更改工作区”入口，单独选择并保存绑定；取消不改绑定、不生成请求。更改默认绑定不能移动已有聊天：原关联按其原工作区返回，另建时用新绑定。 |
| 另建后旧关联保留在数据中，但无法操作 | `services/issue-tasks.mjs:155` 保留 historyRequestIds，projection 返回 history。`ui/app.mjs:522` 仅显示历史条数，没有查看/返回历史入口；默认 open 只恢复 current。另建新草稿后，旧 linked 仍在库里，但页面无法返回它。 | 从当前 Issue 的已归属 history 展示有限元数据，提供“返回此会话”。服务只接受本 scope、本 Issue 索引中已有 requestId；返回前重验目录、thread cwd/projectId 和当前双身份。不得开放任意 thread ID 导航。 |
| 歧义只阻止自动认领，缺少核对恢复 | check 在 `services/issue-tasks.mjs:228` 写 ambiguous，但只保存 checkedCandidates/coverage，没有候选 ID/元数据；验证动作也只有 latest/bind/open/check（`:15`）。`ui/app.mjs:520` 建议打开 GitHub 核对会话，GitHub 无法辨认 Codex 会话。当前只能重查等待候选集变化，或另建。 | 检查结果只返回已按同 cwd/project/time/完整首条 nonce 核实的候选元数据，不返回聊天正文。用户明确选一个后，服务在同自有请求上重新读取并核验该候选完整 nonce/工作区/双身份，再持久关联；迟到或失效候选拒绝，不按“最近”选择。 |
| 页面把请求 ID 写成任务引用 | `services/issue-tasks.mjs:146` requestId 与 nonce 分开创建，提示词首行使用 nonce；projection 只返回 requestId。`ui/app.mjs:522` 将 task.id/requestId 标为“任务引用”。此 UUID 与关联检查要求保留的首行 UUID 不同。 | 返回单独 `reference=taskMarker(nonce)`，显示完整首行引用；requestId 如保留则称“请求标识”。提示成员改写开发指令时保留首行，避免按错误 UUID 修复引用。 |

另有恢复限制：当前未关联请求在 24 小时后会被 `REQUEST_EXPIRED` 阻止检查（`services/issue-tasks.mjs:182`）。默认 open 又优先保留旧请求，用户需明确另建。这是现有行为，不等于存储丢失；本轮可先把“已过期/保留原草稿/另建”表达清楚，延长或增加过期恢复应单独定义扫描边界，不擅自全量扫描聊天。

## 稳定身份与旧数据兼容

稳定身份建议使用版本化域分离，例如 `hash(['issue-hub-codex-identity-v2', normalizedCodexHome, rpcAccountId])`。Windows 路径大小写规则须统一。accountId 来自现有已授权的只读 RPC，并保留账号未知时拒绝任务操作；不读取或持久化认证 token。

旧 0.2.4 记录只有不可逆的旧 codexIdentity 与 githubAccountId，没有用于归属证明的原始 Codex accountId，也没有可重建旧 mtime 指纹的历史。不能因为 GitHub 账号相同、项目路径相同、UUID 像聊天，便把旧 scope 全部搬到新身份。config 已变化后的任意历史 hash 无法安全反推出当前账户归属。

安全的最小兼容路径是由 bridge 同一次当前 RPC 身份读取返回稳定 ID 和**当前精确 legacy hash**，只迁移这个已可证明旧作用域下的记录、索引及绑定；逐条核对 githubAccountId、codexIdentity、requestId/索引一致性，事务复制到新版本 scope，保留原记录或迁移回执，重复执行幂等。当前精确旧 hash 不匹配的历史资料保持原样，不枚举并自动认领。插件升级若已使 config mtime 变化，这条保守兼容路径也无法保证恢复此前已漂移的数据，交付时必须明说。

若产品必须恢复已漂移关联，需要另有明确的成员发起核对流程和当前宿主可验证的归属证据；本审计不提出直接扫其他 scope、任意聊天或改 Codex 私有数据库的绕行方案。

## 已有功能与真实桌面待验的区分

- 一次点击准备并打开草稿已实现：只用 `codex://new` 的 mode/path/prompt（`src/tasks.mjs:13`），没有 send 参数，也没有 turn/start。工作区键由服务发现并在打开前复核。A6 的实际桌面路径和草稿内容仍待验证。
- 新草稿默认开发提示词已含最新 Issue/全评论、AGENTS/规范、分析实施与验证，以及额外提交/推送/GitHub 写入授权边界（`services/issue-tasks.mjs:26`）。插件弹窗是只读 pre；“发送前可编辑”可在 Codex 草稿里完成，不必因此新增插件编辑器。真实桌面是否能按预期编辑且不自动发送仍待点检。
- 已实现请求持久 claim、默认复用已有请求、1500ms 连点去重、OS 回执未知不自动再开。现测试证明插件请求及本机历史保留，**没有证明宿主中原先未发送草稿未被新深链覆盖**。该项在 desktop-checklist 第 1、2、5 步仍待真实观察。
- 唯一完整 nonce 才 linked；同引用多匹配、候选分页不完整、初始项截断都不会自动关联。现存测试覆盖此边界，缺的是歧义核对后的可用恢复入口，不应删除已有保守判断。
- 双身份切换、旧页面 expectedIdentity、打开前目录和已关联 thread/read 复核已具备。新稳定身份仍必须保持旧连接在途响应拒绝，不能为了持久恢复放松读取生命周期隔离。

## 可验证计划

1. Bridge 隔离测试：同 codexHome/accountId 改 config mtime、auth 文件 mtime、重建服务后持久 ID 不变；旧在途仍 HOST_CONTEXT_CHANGED；accountId 或 codexHome 改变则 ID 不同，未知账号仍拒绝。
2. SQLite 兼容测试：精确当前 legacy scope 只迁移归属一致请求/索引/绑定；原值保留、重复迁移幂等；其他 legacy scope、其他 GitHub/Codex 账号不可见；格式异常或冲突时回滚并保留数据。不得用“同路径”作为归属证明。
3. 工作区操作测试：已有有效绑定可改，取消零副作用；改绑定不迁移旧请求，返回已有聊天仍原路径，明确另建采用新路径；失效重选且不打开任意路径。
4. 歧义/历史测试：仅自有候选可显示和选择；选择后重新核验 nonce、cwd、projectId、双身份及会话可用性；候选在途改变、伪造 ID、部分数据或删除均拒绝；旧历史不能被另建覆盖。
5. UI 操作测试：有效绑定的“更改工作区”、历史返回、歧义核对、取消与错误保留；实际任务引用与预填第一行相同，键盘与焦点可用。用隔离服务和模拟宿主完成，不打开真实聊天。
6. 最终桌面点检：成员保留旧未发送草稿，再用单/多工作区新建，核对项目、提示词可编辑、未自动发送和旧草稿保留；手动发送仅回复收到的消息并保留首行，再检查唯一关联与准确返回。版本、操作路径和结果单独记录。此步骤受当前禁止自动操作 Codex UI 的边界约束，代码或 fixture 不能替代。

本报告不标记 R6 或 A6/A10/A11/A12 整体通过，等待 root 明确本轮修复范围后再实施。
