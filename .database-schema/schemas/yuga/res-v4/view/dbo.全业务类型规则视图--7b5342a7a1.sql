SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[全业务类型规则视图] AS WITH C1 AS (
	SELECT
		b.业务代码,
		b.业务名称,
		s.value AS 供应商级别,
		d.value AS 运营商 
	FROM
		[dbo].[dic业务类型表] b CROSS APPLY STRING_SPLIT ( b.[允许供应商级别], ',' ) s
		INNER JOIN [dbo].[dic供应商级别表] g ON s.value = g.[级别编码] CROSS APPLY STRING_SPLIT ( b.[允许运营商], ',' ) d
		INNER JOIN [dbo].[dic运营商表] h ON d.value = h.[编码] 
	),
	C2 AS (
	SELECT
		C1.*,
		c.团队名称,
		(
		SELECT
			STUFF(
				(
				SELECT
					',' + CAST ( ID AS NVARCHAR ( 255 ) ) 
				FROM
					[dbo].[询价模板库_展开视图] 
				WHERE
					C1.业务代码 IN ( SELECT VALUE FROM STRING_SPLIT ( [业务代码], ',' ) ) 
					AND EXISTS ( SELECT 1 FROM STRING_SPLIT ( C1.运营商, ',' ) WHERE VALUE IN ( SELECT VALUE FROM STRING_SPLIT ( [运营商编码], ',' ) ) ) 
					AND EXISTS ( SELECT 1 FROM STRING_SPLIT ( C1.供应商级别, ',' ) WHERE VALUE IN ( SELECT VALUE FROM STRING_SPLIT ( [供应商级别编码], ',' ) ) ) 
				ORDER BY
					ID FOR XML PATH ( '' ) 
				),
				1,
				1,
				'' 
			) AS [符合条件的ID] 
		) AS [匹配模板ID] 
	FROM
		C1
		LEFT JOIN [团队业务分配表] c ON C1.业务代码 = c.业务代码 
		AND C1.供应商级别 = c.供应商级别 
	)
	SELECT
	业务代码,
	业务名称,
	供应商级别,
	运营商,
	团队名称,
	[匹配模板ID],
	(SELECT count(*) FROM [供应商表_展开视图] gys WHERE gys.级别编码 = C2.供应商级别 AND gys.业务代码 = C2.业务代码 AND gys.运营商编码 = C2.运营商) AS 供应商数量,
	(
		CAST (
			(
			SELECT
			CASE		
				WHEN
					CHARINDEX( ',', [匹配模板ID] ) > 0 THEN
						SUBSTRING ( [匹配模板ID], 1, CHARINDEX( ',', [匹配模板ID] ) - 1 ) ELSE [匹配模板ID] 
					END 
					) AS bigint 
				) 
			) AS [默认模板ID]
	FROM
	C2
