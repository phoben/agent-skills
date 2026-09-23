SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[询价需求单视图] AS WITH TaskCounts AS (
    SELECT
        [需求单ID],
        COUNT(*) AS 任务轮次
    FROM
        dbo.询价任务表
    GROUP BY
        [需求单ID]
),
-- 每个需求单取出最大轮次（最后一轮）
LastRoundTaskInfo AS (
    SELECT
        [需求单ID],
        MAX([轮次]) AS 最大轮次
    FROM dbo.询价任务表
    GROUP BY [需求单ID]
),
-- 统计最后一轮、报价状态=0 的报价数量
LastRoundZeroQuote AS (
    SELECT
        lrt.[需求单ID],
        COUNT(q.ID) AS 最后一轮报价数量
    FROM LastRoundTaskInfo lrt
    INNER JOIN dbo.询价任务表 task
        ON lrt.[需求单ID] = task.[需求单ID]
        AND lrt.最大轮次 = task.[轮次]
    -- 报价状态筛选放JOIN内，保留无报价记录（COUNT自动算0）
    LEFT JOIN dbo.[报价历史记录主表] q
        ON task.ID = q.任务ID
        AND q.报价状态 = 0
    GROUP BY lrt.[需求单ID]
),
DetailCounts AS (
    SELECT
       [需求单ID],
        COUNT([三方识别码]) AS 线路数量
    FROM
        dbo.需求详情合并视图
    GROUP BY
       [需求单ID]
),
-- 修复：不使用不存在的「需求ID」，通过任务表关联需求单统计报价数据
GysCounts AS (
    SELECT
        task.[需求单ID],
        COUNT(DISTINCT q.ID) AS 报价次数,
        COUNT(DISTINCT q.供应商ID) AS 供应商数量
    FROM dbo.询价任务表 task
    LEFT JOIN dbo.[报价历史记录主表] q
        ON task.ID = q.任务ID
    GROUP BY task.[需求单ID]
),
QueryCounts AS (
    SELECT
        [需求单ID],
        COUNT(ID) AS 查询次数
    FROM
        dbo.[询价列队表]
    WHERE
        ISNULL([类型], '') <> N'报价催促'
    GROUP BY
        [需求单ID]
)
-- 主查询
SELECT
    xq.ID,
	xq.[项目ID],
    xq.业务代码,
    dic.业务名称, -- 通过业务代码关联字典表 dic业务类型表，取业务名称
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
	ISNULL(query.查询次数, 0) AS 查询次数,
    ISNULL(lrzq.最后一轮报价数量, 0) AS 最后一轮报价数量
FROM
    dbo.询价需求单 AS xq
    -- 业务代码关联字典表，取业务名称（左连接，字典无匹配时保留需求单记录，业务名称为NULL）
    LEFT JOIN dbo.dic业务类型表 AS dic ON xq.业务代码 = dic.业务代码
    LEFT JOIN TaskCounts AS tc ON xq.ID = tc.[需求单ID]
	LEFT JOIN DetailCounts AS dt ON xq.ID = dt.[需求单ID]
	LEFT JOIN GysCounts AS gys ON xq.ID = gys.[需求单ID]
	LEFT JOIN QueryCounts AS query ON xq.ID = query.[需求单ID]
    LEFT JOIN LastRoundZeroQuote lrzq ON xq.ID = lrzq.[需求单ID]
