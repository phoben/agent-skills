SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[View需求单主表视图] AS WITH TaskCounts AS (
    SELECT
        [需求单ID],
        COUNT(*) AS 任务轮次
    FROM
        dbo.询价任务表
    GROUP BY
        [需求单ID]
),
-- 使用 CTE 预先计算线路数量
DetailCounts AS (
    SELECT
       [需求单ID],
        COUNT([三方识别码]) AS 线路数量
    FROM
        dbo.需求详情合并视图
    GROUP BY
       [需求单ID]
),
-- 使用 CTE 预先计算供应商清单
GysCounts AS (
    SELECT
        [需求单ID] AS [需求单ID],
				COUNT(ID) AS 报价次数,
        COUNT(DISTINCT 供应商ID) AS 供应商数量
    FROM
        dbo.[报价历史记录主表]
    GROUP BY
        [需求单ID]
),
-- 使用 CTE 预先计算供应商清单
QueryCounts AS (
    SELECT
        [需求单ID] AS [需求单ID],
				COUNT(ID) AS 查询次数
    FROM
        dbo.[询价列队表]
    GROUP BY
        [需求单ID]
)
-- 主查询
SELECT
    xq.ID,
		xq.[项目ID],
    xq.业务代码,
		xq.项目类型,
    xq.[指定运营商_S],
    xq.[指定供应商级别_S],
    xq.采购负责人,
    xq.[参与人],
    xq.申请折扣,
    xq.第三方业务识别码,
    xq.状态,
    xq.申请人,
    xq.计划截止日期,
    xq.FGC_CreateDate AS 提交日期,
    xq.外部流转附件,
    xq.内部流转附件,
    xq.关键提醒信息,
    xq.备注,
    xq.是否公开客户信息,
    xq.客户中文名,
    xq.客户英文名,
    xq.紧急程度,
    xq.[所属公司],
		xq.[销售负责人],
    xq.[业务营运管理部经理],
    xq.[客户关系部经理],
    xq.[客户经理],
    xq.[报价可见],
    xq.[委托标记],
		xq.[报价齐套],
		xq.[需求名称],
		xq.[客户邮箱],
		xq.[订单编号],
		xq.[是否署名],
		xq.[中文署名],
		xq.[英文署名],
		xq.[推送SO标记],
		xq.[SO返回信息],
    xq.FGC_Creator,
    ISNULL(gys.报价次数, 0) AS 报价次数,
    ISNULL(gys.供应商数量, 0) AS 参与供应商,
    ISNULL(tc.任务轮次, 0) AS 任务轮次,
		ISNULL(dt.线路数量, 0) AS 线路统计,
		ISNULL(query.查询次数, 0) AS 查询次数
FROM
    dbo.询价需求单 AS xq
    LEFT JOIN TaskCounts AS tc ON xq.ID = tc.[需求单ID]
		LEFT JOIN DetailCounts AS dt ON xq.ID = dt.[需求单ID]
		LEFT JOIN GysCounts AS gys ON xq.ID = gys.[需求单ID]
		LEFT JOIN QueryCounts AS query ON xq.ID = query.[需求单ID]
		
-- 注意：这里不再需要 GROUP BY 子句了，因为我们已经对聚合数据进行了预处理
-- 并且每个 xq.ID 只会产生一行结果。
