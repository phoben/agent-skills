SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[View_供应商回复统计年视图] AS WITH c1 AS(
SELECT
年份,
供应商ID,
公司名称,
查询次数,
回复次数,
PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY 中位数回复天数) OVER (PARTITION BY 年份,供应商ID,公司名称) AS 中位数回复天数
FROM View_供应商回复统计
),
c2 AS(
SELECT
				年份,
				供应商ID,
				公司名称,
				SUM(查询次数) AS 查询次数,
        SUM(回复次数) AS 回复次数,
				MAX(中位数回复天数) AS 中位数回复天数
		FROM c1
		GROUP BY 年份,供应商ID,公司名称

)
SELECT
年份,
供应商ID,
公司名称,
查询次数,
回复次数,
CASE  WHEN ISNULL(查询次数, 0)>ISNULL(回复次数, 0) AND ISNULL(回复次数, 0)>0 THEN ROUND(CAST(ISNULL(回复次数, 0) as float)/ISNULL(查询次数, 0), 2) 	ELSE 
		CASE WHEN 回复次数=0 THEN 0
		ELSE 1
		END
END AS 回复率,
中位数回复天数
FROM c2
