SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[View_供应商回复统计] AS WITH inquirySum AS (
   SELECT
        YEAR(发送时间) AS 年份,
        DATEPART(QUARTER, 发送时间) AS 季度,
        供应商ID,
        询价任务ID,
				count(*) AS 查询次数
    FROM [dbo].[询价列队表]
		WHERE [父ID] IS NULL
    GROUP BY YEAR(发送时间), DATEPART(QUARTER, 发送时间), 供应商ID,询价任务ID
),
InquiryStats AS (
    SELECT 
		  年份,
			季度,
			供应商ID,
			ISNULL(SUM(CASE WHEN 查询次数>0 THEN 1 ELSE 0 END), 0) AS 查询次数 
		FROM inquirySum
		GROUP BY 年份,季度,供应商ID
),
ReplySum AS (
    SELECT
        YEAR(a.回复日期) AS 年份,
        DATEPART(QUARTER, a.回复日期) AS 季度,
        a.供应商ID,
        a.任务ID,
				count(*) AS 回复次数
    FROM [dbo].[邮件回复记录] a
		LEFT JOIN [询价列队表] ld ON ld.ID = a.[列队ID]
		WHERE 任务ID iS NOT NULL and ld.[父ID] IS NULL
    GROUP BY YEAR(a.回复日期), DATEPART(QUARTER, a.回复日期), a.供应商ID, a.任务ID
),
ReplyStats AS (
    SELECT
        年份,
        季度,
        供应商ID,
				ISNULL(SUM(CASE WHEN 回复次数>0 THEN 1 ELSE 0 END), 0) AS 回复次数
    FROM ReplySum
		GROUP BY 
		    年份,
        季度,
        供应商ID
),
MedianResponseTime AS (
    SELECT
        YEAR(r.回复日期) AS 年份,
        DATEPART(QUARTER, r.回复日期) AS 季度,
        r.供应商ID,
        DATEDIFF(DAY, i.发送时间, r.回复日期) AS ResponseTime
    FROM [dbo].[邮件回复记录] r
    JOIN [dbo].[询价列队表] i ON r.列队ID = i.ID
),
MedianSUM AS (
    SELECT
        年份,
        季度,
        供应商ID,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ResponseTime) OVER (PARTITION BY 年份, 季度, 供应商ID) AS 中位数回复天数
    FROM MedianResponseTime
),
MedianCalc AS (
		SELECT
				年份,
				季度,
				供应商ID,
				MAX(中位数回复天数) AS 中位数回复天数 -- 使用MAX或MIN都可以，因为所有值应该是相同的
		FROM MedianSUM
		GROUP BY 年份, 季度, 供应商ID
)
SELECT
    i.年份,
    i.季度,
    i.供应商ID,
		g.公司名称,
    ISNULL(i.查询次数, 0) AS 查询次数,
    ISNULL(r.回复次数, 0) AS 回复次数,
		CASE  WHEN ISNULL(i.查询次数, 0)>ISNULL(r.回复次数, 0) AND ISNULL(r.回复次数, 0)>0 THEN ROUND(CAST(ISNULL(r.回复次数, 0) as float)/ISNULL(i.查询次数, 0), 2)
	ELSE 
		CASE WHEN r.回复次数=0 THEN 0
		ELSE 1
		END
END AS 回复率,
    m.中位数回复天数
FROM InquiryStats i
LEFT JOIN ReplyStats r ON i.年份 = r.年份 AND i.季度 = r.季度 AND i.供应商ID = r.供应商ID
LEFT JOIN MedianCalc m ON i.年份 = m.年份 AND i.季度 = m.季度 AND i.供应商ID = m.供应商ID
LEFT JOIN [供应商表] g ON i.供应商ID=g.ID
GROUP BY i.年份, i.季度, i.供应商ID,g.公司名称,i.查询次数,r.回复次数, m.中位数回复天数
