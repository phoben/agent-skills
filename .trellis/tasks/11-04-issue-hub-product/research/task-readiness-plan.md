# 创建任务被工作区检查阻断

2026-11-04，用户报告0.3.0点击“创建任务”后没有打开聊天，页面同时显示“正在核对项目和工作区，请稍后再创建任务。”与“离线缓存，可继续保存本机草稿。”。继续当前已授权任务，不新建任务、不提交推送。

## 清单

- [x] 单测与真实stdio临时库bind复现CATALOG_CHECKING：缓存恢复checking=true，完整refresh后同目录bind通过；离线没有随此错误复现。
- [x] 补齐显式任务前目录核对及在途反馈，保留身份/工作区/remote验证；新增冷缓存及上下文竞态回归。
- [x] 独立209测试/49语法通过；最终0.3.2构建、包外stdio、本机安装、8文件哈希与安装后资源验证通过。
- [x] 规范及桌面复测步骤已更新，见task-readiness-verification-032.md。
- [x] 用户已回报0.3.2点击#5成功跳转新会话并预填提示词，真实阻断点复测通过。
- [ ] 原草稿保护、无自动发送、实际工作区及手动发送后的关联往返仍需明确观察；独立离线原因尚未复现，不能宣称根治全部网络故障。

## 变更边界

行为差距：页面已有可查看Issue和本机工作区，却不能完成创建任务前的工作区核对。实际根因是缓存恢复将目录标为checking，显式操作不主动完成核对。目录错误不改变GitHub在线状态，截图离线来自另一读取状态，目前未复现独立网络失败。修改范围为issue-tasks、store/任务控制器与对应测试；catalog的checking/remote守卫保持。不改变关联协议、不自动发送，也不修改GitHub。

## 反馈回路与假设

单测命令：`node --test --test-name-pattern="从首页缓存恢复后" test/product-tasks.test.mjs`。修复前1项失败，chooseWorkspace→catalog.resolveWorkspace报CATALOG_CHECKING，openUri使用spy，不真实打开聊天。

真实旧产物：`node .trellis/tasks/11-04-issue-hub-product/research/task-readiness-live-031.mjs --bind`。只有自有临时SQLite的绑定写入，不操作远端或聊天；fresh-full-refresh通过，reopened-cached-bootstrap报同文案，online始终true。结果保留在task-readiness-live-031-before-bind.json，最初仅latest的只读对照另存before.json。

假设按已展示的顺序验证：缓存恢复后缺少显式核对（单测和真实stdio已支持）；后台失败后没有恢复（补回归）；独立GitHub失败导致离线（未复现，不将任务成功当联网证明）。

实现代理负责最小修复，root负责真实只读stdio复现、构建安装和证据；独立trellis-check最后复核。原生Codex UI自动化仍禁止，不以浏览器或假openUri结果冒充用户聊天成功。
