SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[品牌统计视图] AS /*
 视图：品牌统计视图
 用途：按年度统计设备采购方案的品牌数量与金额
 对应视图：sql-ga/品牌统计视图.sql（原库：采用方案表→需求单主表→设备采购询价需求单）
 数据范围：
   - 询价需求单.业务代码 = 设备采购
   - 需求详情_设备维保、设备服务不纳入统计（与原视图一致，原视图仅覆盖设备采购业务）
 关联说明：
   - 方案ID = 需求报价方案主表.ID；明细ID = 需求报价方案子表.ID
   - 明细行经 需求报价方案子表.三方识别码 关联 需求详情_设备采购（品牌、数量、折后总价）
   - 统计年度 = 需求报价方案主表.FGC_CreateDate 所在年份
   - 仅统计已确认采用的方案：需求报价方案主表.状态 = 1（0=未采用，1=已采用）
 数据库：SQL Server 2019
*/
WITH CTE_品牌明细 AS (
	SELECT
		p.[ID] AS [采用方案ID],
		p.[FGC_CreateDate],
		d.[业务代码],
		d.[ID] AS [询价需求单ID],
		x.[ID] AS [需求详情ID],
		x.[品牌],
		x.[数量],
		x.[折后总价]
	FROM [dbo].[需求报价方案主表] p
	INNER JOIN [dbo].[询价需求单] d
		ON d.[ID] = p.[需求单ID]
	   AND d.[业务代码] = N'设备采购'
	INNER JOIN [dbo].[需求报价方案子表] s
		ON s.[报价方案主表ID] = p.[ID]
	INNER JOIN [dbo].[需求详情_设备采购] x
		ON x.[三方识别码] = s.[三方识别码]
	WHERE x.[品牌] IS NOT NULL
	  AND x.[品牌] <> ''
	  AND x.[折后总价] > 0
	  AND p.[状态] = 1	-- 0=未采用，1=已采用
)
SELECT
	YEAR(CTE.[FGC_CreateDate]) AS [年度],
	LOWER(CTE.[品牌]) AS [品牌],
	CAST(SUM(CTE.[数量]) AS int) AS [数量],
	CAST(ROUND(SUM(CTE.[折后总价]), 3) AS DECIMAL(18, 3)) AS [金额]
FROM CTE_品牌明细 AS CTE
GROUP BY
	YEAR(CTE.[FGC_CreateDate]),
	LOWER(CTE.[品牌])
