SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[供应商表_展开视图] AS SELECT
	gys.ID AS ID,
	gys.公司名称 AS 公司名称,
	gys.级别编码 AS 级别编码,
	gys.是否禁用 AS 是否禁用,
	gys.是否常用 AS 是否常用,
	yw.业务代码 AS 业务代码,
	yys.运营商编码 AS 运营商编码
FROM
	供应商表 gys
	LEFT JOIN 供应商_支持业务 yw ON gys.ID = yw.供应商ID
	LEFT JOIN 供应商_支持运营商 yys ON gys.ID = yys.供应商ID
