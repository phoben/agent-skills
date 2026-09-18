# DataPull CLI 目录持有 Skill 唯一源码

DataPull Skill 的唯一源码位于 `cli/datapull/skill/`，构建与发布流程将同一内容同步到 YG Toolkit 插件目录和 NPM 包，禁止两处分别维护。这样既允许 CLI 首次运行时为用户安装内置 Skill，也允许用户先通过 Plugin 获得 Skill，再由 Skill 检查并引导补装 CLI；发布校验必须阻止同步副本与唯一源码不一致。
