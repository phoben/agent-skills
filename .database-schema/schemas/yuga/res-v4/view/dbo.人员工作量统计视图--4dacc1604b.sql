SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[人员工作量统计视图] AS SELECT
	CAST(q.[FGC_CreateDate] as date) AS [创建日期],
	main.[指定供应商级别_S] AS [供应商级别],
	dic.[业务名称] AS [业务名称],
	main.[采购负责人],
	COUNT ( q.ID ) AS 查询次数
FROM
	[dbo].[询价列队表] q
	LEFT JOIN [询价需求单] main ON main.ID = q.[需求单ID]
	LEFT JOIN [dic业务类型表] dic ON dic.[业务代码] = main.[业务代码]
WHERE
	ISNULL ( q.[类型], '' ) <> N'报价催促'
GROUP BY
	CAST(q.[FGC_CreateDate] as date),
	main.[指定供应商级别_S],
	dic.[业务名称],
	main.[采购负责人]
