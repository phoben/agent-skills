SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[供应商汇总视图] AS WITH 
	供应商业务拼接表 AS(  
		SELECT    
		    a.供应商ID,   
		    STRING_AGG(a.业务代码,',') AS 业务类型列表, 
		    STRING_AGG(b.业务名称,',') AS 业务名称列表 
		FROM    
		    [供应商_支持业务] a 
		    JOIN [dic业务类型表] b ON a.业务代码=b.业务代码
		GROUP BY    
		    a.供应商ID
	),
	供应商品牌拼接表 AS(
		SELECT    
		    供应商ID,   
		    STRING_AGG(运营商编码, ',') AS 品牌列表  
		FROM    
		    [供应商_支持运营商]   
		GROUP BY    
		    供应商ID
	)
SELECT 
	ID AS 供应商ID,
	[公司名称],
	[业务分类],
	[联系邮箱],
	是否常用,
	是否禁用,
	供应商业务拼接表.业务类型列表,
	供应商业务拼接表.业务名称列表,
	供应商品牌拼接表.品牌列表,
	[模板_运营商编码],
	'' AS FGC_Creator
FROM [供应商表] 
LEFT JOIN 供应商业务拼接表 ON [供应商表].[ID]=供应商业务拼接表.供应商ID
LEFT JOIN 供应商品牌拼接表 ON [供应商表].[ID]=供应商品牌拼接表.供应商ID
