SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[供应商表_合并视图] AS SELECT
	gys.ID AS ID,
	gys.公司名称 AS 公司名称,
	gys.业务分类 AS 业务分类,
	gys.级别编码 AS 级别编码,
	gys.是否禁用 AS 是否禁用,
	gys.是否常用 AS 是否常用,
    CASE   
        WHEN gys.是否禁用=0 THEN '启用'  
        
        ELSE '禁用' 
    END AS 状态,
	gys.模板_运营商编码 AS 模板运营商编码,
	STUFF((SELECT DISTINCT ',' + yys.运营商编码
	       FROM 供应商_支持运营商 yys
	       WHERE gys.ID = yys.供应商ID
	       FOR XML PATH('')), 1, 1, '') AS 运营商编码_S,
	STUFF((SELECT DISTINCT ',' + yw.业务代码
	       FROM 供应商_支持业务 yw
	       WHERE gys.ID = yw.供应商ID
	       FOR XML PATH('')), 1, 1, '') AS 业务代码_S
FROM
	供应商表 gys
GROUP BY
	gys.ID,
	gys.公司名称,
	gys.业务分类,
	gys.级别编码,
	gys.模板_运营商编码,
	gys.是否禁用,
	gys.是否常用;
