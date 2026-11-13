# 项目发现固定三层：后端实施

代码工作区为`E:/Develop/agent-skills/.worktrees/issue-hub-discovery-policy-20261105`，基线3a777eb。用户本轮明确将默认扫描边界定义为产品范围，覆盖旧规范中深度触限即要求用户处理的行为。

## 变更

- 仅修改`packages/issue-hub/src/catalog.mjs`和`test/product-catalog.test.mjs`。
- 默认`maxDepth`从5改为3，登记根深度为0。登记根先执行原GitInspector，即使项目登记的是仓库内子目录也保留该目录作为工作区。
- 嵌套目录用`lstat(.git)`判断候选，只把Git目录、Git文件或链接标记交给原GitInspector读取remote。不直接解析config；普通源码目录不执行Git命令。标记使用lstat避免损坏链接误判为“没有.git”，是否为有效仓库仍由Git核验。
- 第3层仍核验Git标记，随后结束，不枚举其下一层源码目录。第4层及以后不在默认补充发现范围；若它们单独登记为桌面项目，则作为独立root正常核验。
- 正常深度边界不再生成DIRECTORY_DEPTH_LIMIT。1500目录保护及其内部DIRECTORY_LIMIT、真实Git/目录错误分类保留，由前端区分正常边界和可诊断错误。
- 原有依赖/构建排除、目录链接限制、重复root扫描复用、同仓库多路径、GitHub稳定映射与工作区重新验证规则保持。没有找到第一个仓库就停止，三层内的嵌套仓库仍会检查。

## 实际验证

先添加真实临时Git用例并对旧源码执行同一命令：

```text
node --test test/catalog.test.mjs test/product-catalog.test.mjs
旧源码：17项，13通过、4失败
```

失败精确对应正常边界仍产深度警告、默认仍发现第4层仓库、单独登记深root被旧深扫描重复触及。实施后这些断言转绿，另加入损坏.git文件在第3层仍返回真实Git读取失败分类的用例。

最终执行：

```text
node --test test/catalog.test.mjs test/product-catalog.test.mjs
18项通过，0失败、0跳过
npm run check
60个JavaScript模块语法检查通过
git diff --check
通过
```

真实临时仓库用例还覆盖普通.git目录、worktree.git文件和多个remote URL、三层内同仓库多路径、登记子目录保留cwd、独立登记更深root及重复root去重、外部目录链接不跟随、稳定ID归一与远端变化阻断。所有临时Git操作仅在测试自有目录，不访问GitHub。

## 交接

生产源码已冻结。主会话继续独立完整回归、真实本机只读项目比对、浏览器、统一构建及安装；本代理没有运行真实用户项目发现、读写业务库、操作原生Codex、安装插件、提交或推送。项目包没有独立lint或TypeScript配置，check仅作为JavaScript语法证据。
