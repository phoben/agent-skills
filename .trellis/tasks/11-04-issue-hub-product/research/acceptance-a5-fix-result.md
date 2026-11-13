# A5 来源信息与活动分页修复

2026-11-04，承接acceptance-plan-033与独立审计。沿用现有A布局与中性样式，没有操作真实业务库、聊天、浏览器或GitHub，没有提交推送。

## 先复现再修复

实际执行 `node --test test/product-ui-store.test.mjs test/product-ui-poll.test.mjs`，先得到52项中3项失败：

- 正文附件和关联PR均为空时sourceLinks返回空串，无法区分尚未读活动和完整读取后无结果。
- 首批活动后台到达后，关联PR已在投影中，但来源链接DOM仍为空。
- PR只在第二页活动出现时，loadMore只合并activities，没有重新派生relatedPr，导致漏链接。

修复局部渲染时又先建立一条红回归：当前焦点在“加载更多活动”按钮时，原renderDiscussionOnly的焦点保护阻止替换整个分页区，活动一直停留旧内容。通过显式分页控件参数解决，并保留其他阅读控件保护。

## 最小修改

- ui/app.mjs的sourceLinks分别显示正文附件与关联PR。附件为空明确暂无，正文尚未提供时显示未读取；PR区分活动未读、部分覆盖、不可用与完整读取后暂无。已有真实安全链接保留，标题继续转义，危险协议拒绝，链接按URL去重；没有编造附件或PR。
- hydrateIssue首批activity到达后，复用既有summaryPainter局部更新来源链接。评论输入、选区、焦点、正文和编辑表单不重建。
- ui/store.mjs首批和后续activity统一从真实sourceIsPr/sourceUrl派生relatedPr，按URL去重。分页coverage.loaded使用实际累计条数，不用末页数量冒充累计值。
- “加载更多活动”完成后局部更新讨论与来源链接，不再renderDetail。显式聚焦的分页按钮可替换，焦点返回新的分页按钮或活动标签；详情滚动保留。其他正在使用的讨论控件、保存中及编辑表单继续保护。
- 分页在途切换仓库、Issue或账号时不绘制旧结果。没有改变既有API、获取页数、缓存或写入协议。

## 验证与边界

三条原始红回归及聚焦分页红回归均已转绿，另加部分覆盖/不可用/危险链接与在途切Issue回归，共6条新增测试。

`node --test test/product-ui-store.test.mjs test/product-ui-poll.test.mjs test/product-ui-experience.test.mjs`：66项通过，0失败/跳过。

变更文件仅app.mjs、store.mjs、product-ui-poll.test.mjs、product-ui-store.test.mjs。summary.mjs和CSS没有修改。业务源码已冻结，主会话与独立check负责完整质量检查、升版构建安装及真实页面抽查；没有以受控DOM替代原生或第二台Windows验收。
