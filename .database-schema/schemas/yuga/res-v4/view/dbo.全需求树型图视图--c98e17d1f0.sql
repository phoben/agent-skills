SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[全需求树型图视图] AS WITH C1 AS (
	SELECT
		a.ID AS ID,
		'' AS PID,
		(
			a.[业务代码] + '-' + a.[客户中文名] + '-' + a.[项目类型] + ' (' + CAST ( COUNT ( b.ID ) AS nvarchar ) + ')' 
		) AS 标题,
		'需求单' AS 类型 
	FROM
		[询价需求单] a
		LEFT JOIN [询价任务表] b ON a.ID= b.[需求单ID]
	WHERE
		a.状态 >= 4 
	GROUP BY
		a.ID,
		a.[业务代码],
		a.[客户中文名],
		a.[项目类型] 
	) 
	
SELECT * FROM C1	

UNION ALL

SELECT
	a.ID AS ID,
	a.[需求单ID] AS PID,
	a.[任务名称] + ' (' + CAST ( COUNT ( b.ID ) AS nvarchar ) + ')' AS 标题,
	'任务' AS 类型 
FROM
	[询价任务表] a
	LEFT JOIN [询价列队表] b ON a.ID = b.[询价任务ID] 
	WHERE a.[需求单ID] IN (SELECT ID FROM C1)
GROUP BY
	a.ID,
	a.[需求单ID],
	a.[任务名称] 
	
	UNION ALL
SELECT
	a.ID AS ID,
	a.[询价任务ID] AS PID,
	( ISNULL( b.[公司名称], '未知供应商' ) ) AS 标题,
	'列队' AS 类型 
FROM
	[询价列队表] a
	LEFT JOIN [供应商表] b ON b.ID = a.[供应商ID ]
	WHERE a.[需求单ID] IN (SELECT ID FROM C1)
GROUP BY
	a.ID,
	a.[询价任务ID],
	b.[公司名称] 
	
UNION ALL
	
SELECT
	a.ID AS ID,
	a.[列队ID] AS PID,
	ISNULL( a.报价标题, '第1次' ) AS 标题,
	'报价' AS 类型
FROM [报价历史记录主表] a
WHERE a.[需求单ID] IN (SELECT ID FROM C1);
