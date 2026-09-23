SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[工作量统计视图] AS WITH
-- 主单基础信息
orders AS (
    SELECT T1.ID, T1.FGC_CreateDate, T1.业务代码
    FROM dbo.询价需求单 AS T1
),
-- 单据数量：按主单自身创建日期统计
base AS (
    SELECT
        YEAR(o.FGC_CreateDate)  AS 年度,
        MONTH(o.FGC_CreateDate) AS 月份,
        o.业务代码                AS 业务代码,
        COUNT(DISTINCT o.ID)     AS 单据数量
    FROM orders AS o
    GROUP BY YEAR(o.FGC_CreateDate), MONTH(o.FGC_CreateDate), o.业务代码
),
-- 查询次数：按列队记录自身创建日期统计（不随需求单日期，排除类型='报价催促'）
q_inquiry AS (
    SELECT
        YEAR(T2.FGC_CreateDate)  AS 年度,
        MONTH(T2.FGC_CreateDate) AS 月份,
        o.业务代码                AS 业务代码,
        COUNT(*)                  AS 查询次数
    FROM dbo.询价列队表 AS T2
    INNER JOIN orders AS o ON o.ID = T2.需求单ID
    WHERE ISNULL(T2.[类型], '') <> N'报价催促'
    GROUP BY YEAR(T2.FGC_CreateDate), MONTH(T2.FGC_CreateDate), o.业务代码
),
-- 线路数量：按线路明细自身创建日期统计（不随需求单日期，按需求ID去重）
q_lines AS (
    SELECT
        YEAR(T3.创建日期)        AS 年度,
        MONTH(T3.创建日期)       AS 月份,
        o.业务代码                AS 业务代码,
        COUNT(DISTINCT T3.需求ID) AS 线路数量
    FROM dbo.需求详情合并视图 AS T3
    INNER JOIN orders AS o ON o.ID = T3.需求单ID
    GROUP BY YEAR(T3.创建日期), MONTH(T3.创建日期), o.业务代码
),
-- 报价数量：按报价记录自身创建日期统计（不随需求单日期）
q_quote AS (
    SELECT
        YEAR(T4.FGC_CreateDate)  AS 年度,
        MONTH(T4.FGC_CreateDate) AS 月份,
        o.业务代码                AS 业务代码,
        COUNT(*)                  AS 报价数量
    FROM dbo.报价历史记录主表 AS T4
    INNER JOIN orders AS o ON o.ID = T4.需求单ID
    GROUP BY YEAR(T4.FGC_CreateDate), MONTH(T4.FGC_CreateDate), o.业务代码
),
-- 任务次数：按任务自身创建日期统计（不随需求单日期）
q_task AS (
    SELECT
        YEAR(T5.FGC_CreateDate)  AS 年度,
        MONTH(T5.FGC_CreateDate) AS 月份,
        o.业务代码                AS 业务代码,
        COUNT(*)                  AS 任务次数
    FROM dbo.询价任务表 AS T5
    INNER JOIN orders AS o ON o.ID = T5.需求单ID
		WHERE
			T5.状态 >= 2
    GROUP BY YEAR(T5.FGC_CreateDate), MONTH(T5.FGC_CreateDate), o.业务代码
),
-- 业务类型字典：按业务代码去重取业务名称（避免字典重复导致统计数量翻倍）
dic AS (
    SELECT 业务代码, MAX(业务名称) AS 业务名称
    FROM dbo.dic业务类型表
    GROUP BY 业务代码
),
-- 汇总所有出现过的（年度, 月份, 业务代码）组合
dim AS (
    SELECT 年度, 月份, 业务代码 FROM base
    UNION
    SELECT 年度, 月份, 业务代码 FROM q_inquiry
    UNION
    SELECT 年度, 月份, 业务代码 FROM q_lines
    UNION
    SELECT 年度, 月份, 业务代码 FROM q_quote
    UNION
    SELECT 年度, 月份, 业务代码 FROM q_task
)
SELECT
    d.年度,
    d.月份,
    ISNULL(dic.业务名称, d.业务代码)         AS 业务名称,  -- 字典未匹配到的业务代码保留原代码，避免被错误合并
    SUM(ISNULL(b.单据数量, 0))               AS 单据数量,  -- 仅按主单创建日期统计
    SUM(ISNULL(qi.查询次数, 0))              AS 查询次数,  -- 按列队记录自身创建日期统计
    SUM(ISNULL(ql.线路数量, 0))              AS 线路数量,  -- 按线路明细自身创建日期统计
    SUM(ISNULL(qq.报价数量, 0))              AS 报价数量,  -- 按报价记录自身创建日期统计
    SUM(ISNULL(qt.任务次数, 0))              AS 任务次数   -- 按任务自身创建日期统计
FROM dim AS d
LEFT JOIN dic        AS dic ON dic.业务代码 = d.业务代码
LEFT JOIN base      AS b  ON b.年度  = d.年度 AND b.月份  = d.月份 AND b.业务代码  = d.业务代码
LEFT JOIN q_inquiry AS qi ON qi.年度 = d.年度 AND qi.月份 = d.月份 AND qi.业务代码 = d.业务代码
LEFT JOIN q_lines   AS ql ON ql.年度 = d.年度 AND ql.月份 = d.月份 AND ql.业务代码 = d.业务代码
LEFT JOIN q_quote   AS qq ON qq.年度 = d.年度 AND qq.月份 = d.月份 AND qq.业务代码 = d.业务代码
LEFT JOIN q_task    AS qt ON qt.年度 = d.年度 AND qt.月份 = d.月份 AND qt.业务代码 = d.业务代码
GROUP BY d.年度, d.月份, ISNULL(dic.业务名称, d.业务代码);
