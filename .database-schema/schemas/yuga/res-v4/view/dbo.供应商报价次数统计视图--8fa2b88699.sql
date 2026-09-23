SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[供应商报价次数统计视图] AS /*
 视图：供应商报价次数统计视图
 用途：按 业务ID / 业务名称 / 年度 / 供应商 统计报价金额与报价次数
 参照：sql-ga\供应商报价次数统计视图.sql
 差异说明：
   - 业务ID 由 业务代码 映射：设备采购=2、设备维保=3、设备服务=4、服务性采购=10；
   - 业务名称取自 dic业务类型表.类型，仅统计 业务分类=2 的业务；
     （按业务代码去重取 MAX，避免字典重复行导致统计数量翻倍）
     其中 业务代码=服务性采购 的业务名称固定为“服务”
     （对应 dic业务类型表 中该记录的业务名称值）；
   - sql-ga 中报价历史记录主表直接存「供应商税号」，sql-v4 中只有「供应商ID」，
     故按 供应商ID 分组；
   - 金额字段对应 sql-v4 报价历史记录主表.报价金额（sql-ga 为 总金额）。
 数据库：SQL Server 2019
*/
WITH
-- 报价记录 + 需求单业务代码
报价历史业务表 AS (
	SELECT
		a.*,
		b.[业务代码]
	FROM [dbo].[报价历史记录主表] a
	JOIN [dbo].[询价需求单] b ON a.[需求单ID] = b.ID
),
-- 业务类型字典：仅 业务分类=2 的业务，按业务代码去重取「类型」作为业务名称
dic AS (
	SELECT
		[业务代码],
		MAX([类型]) AS [业务名称]
	FROM [dbo].[dic业务类型表]
	WHERE [业务分类] = 2
	GROUP BY [业务代码]
)
SELECT
	CASE yw.[业务代码]
		WHEN N'设备采购' THEN 2
		WHEN N'设备维保' THEN 3
		WHEN N'设备服务' THEN 4
		WHEN N'服务性采购' THEN 10
	END AS [业务ID],
	CASE yw.[业务代码] WHEN N'服务性采购' THEN N'服务' ELSE dic.[业务名称] END AS [业务名称],
	YEAR(yw.[报价时间]) AS [年度],
	yw.[供应商ID],
	SUM(yw.[报价金额]) AS 金额,
	COUNT(*) AS 数量
FROM [报价历史业务表] yw
INNER JOIN dic ON dic.[业务代码] = yw.[业务代码]
GROUP BY
	yw.[业务代码],
	dic.[业务名称],
	YEAR(yw.[报价时间]),
	yw.[供应商ID]
