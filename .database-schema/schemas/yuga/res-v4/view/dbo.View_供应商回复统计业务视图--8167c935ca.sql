SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[View_供应商回复统计业务视图] AS
WITH inquirySum AS (
    SELECT
        xq.业务代码,
        ld.供应商ID,
        ld.询价任务ID,
        COUNT(*) AS 查询次数
    FROM [dbo].[询价列队表] ld
    LEFT JOIN [dbo].[询价任务表] rw ON ld.询价任务ID = rw.ID
    JOIN [dbo].[询价需求单] xq ON rw.需求单ID = xq.ID
    WHERE ld.[父ID] IS NULL
    GROUP BY xq.业务代码, ld.供应商ID, ld.询价任务ID
),
InquiryStats AS (
    SELECT
        业务代码,
        供应商ID,
        ISNULL(SUM(CASE WHEN 查询次数 > 0 THEN 1 ELSE 0 END), 0) AS 查询次数
    FROM inquirySum
    GROUP BY 业务代码, 供应商ID
),
ReplySum AS (
    SELECT
        xq.业务代码,
        a.供应商ID,
        a.任务ID,
        COUNT(*) AS 回复次数
    FROM [dbo].[邮件回复记录] a
    LEFT JOIN [询价列队表] ld ON ld.ID = a.[列队ID]
    LEFT JOIN [dbo].[询价任务表] rw ON a.任务ID = rw.ID
    JOIN [dbo].[询价需求单] xq ON rw.需求单ID = xq.ID
    WHERE a.任务ID IS NOT NULL AND ld.[父ID] IS NULL
    GROUP BY xq.业务代码, a.供应商ID, a.任务ID
),
ReplyStats AS (
    SELECT
        业务代码,
        供应商ID,
        ISNULL(SUM(CASE WHEN 回复次数 > 0 THEN 1 ELSE 0 END), 0) AS 回复次数
    FROM ReplySum
    GROUP BY 业务代码, 供应商ID
),
MedianResponseTime AS (
    SELECT
        xq.业务代码,
        r.供应商ID,
        DATEDIFF(DAY, i.发送时间, r.回复日期) AS ResponseTime
    FROM [dbo].[邮件回复记录] r
    JOIN [dbo].[询价列队表] i ON r.列队ID = i.ID
    LEFT JOIN [dbo].[询价任务表] rw ON i.询价任务ID = rw.ID
    JOIN [dbo].[询价需求单] xq ON rw.需求单ID = xq.ID
),
MedianSUM AS (
    SELECT
        业务代码,
        供应商ID,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ResponseTime) OVER (PARTITION BY 业务代码, 供应商ID) AS 中位数回复天数
    FROM MedianResponseTime
),
MedianCalc AS (
    SELECT
        业务代码,
        供应商ID,
        MAX(中位数回复天数) AS 中位数回复天数
    FROM MedianSUM
    GROUP BY 业务代码, 供应商ID
)
SELECT
    dic.业务名称,
    i.供应商ID,
    g.公司名称,
    ISNULL(i.查询次数, 0) AS 查询次数,
    ISNULL(r.回复次数, 0) AS 回复次数,
    CASE
        WHEN ISNULL(i.查询次数, 0) = 0 THEN 0
        ELSE ROUND(CAST(ISNULL(r.回复次数, 0) AS float) / ISNULL(i.查询次数, 0), 2)
    END AS 回复率,
    m.中位数回复天数
FROM InquiryStats i
LEFT JOIN ReplyStats r ON i.业务代码 = r.业务代码 AND i.供应商ID = r.供应商ID
LEFT JOIN MedianCalc m ON i.业务代码 = m.业务代码 AND i.供应商ID = m.供应商ID
LEFT JOIN [供应商表] g ON i.供应商ID = g.ID
LEFT JOIN [dic业务类型表] dic ON i.业务代码 = dic.业务代码
