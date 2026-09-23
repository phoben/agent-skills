SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[报价大数据视图] AS SELECT
	bj.ID AS DataID,
	'SST-RES' AS [SystemName],
	gys.[公司名称] AS [QuotationVendor],
	xqd.ID AS [DocumentNumber],
	xqd.[业务代码] AS [BusinessName],
	mg.[线路地址] AS [Address],
	CONCAT_WS (
		',',
		NULLIF ( mg.[线路类型], '' ),
		NULLIF ( mg.[IP地址个数], '' ),
		NULLIF ( mg.[带宽], '' ) 
	) AS [Tag],
  bj.[币种] AS [CURRENCT],
	CAST ( bj.[一次性费用_含税价] AS DECIMAL ( 18, 2 ) ) AS [OTC],
	CAST ( bj.[一次性费用_税率] AS DECIMAL ( 18, 2 ) ) AS [OTC-TR],
	CAST ( bj.[周期费用_含税价] AS DECIMAL ( 18, 2 ) ) AS [MRC],
	CAST ( bj.[周期费用_税率] AS DECIMAL ( 18, 2 ) ) AS [MRC-TR],
	'CNY' AS [Currency],
	bj.[报价描述] AS [Remarks],
	main.[报价时间] AS [QuotationDate] 
FROM
	[dbo].[报价历史记录子表] bj
	LEFT JOIN [供应商表] gys ON bj.[供应商ID] = gys.[ID]
	LEFT JOIN [询价需求单] xqd ON bj.[需求单ID] = xqd.[ID]
	LEFT JOIN [报价历史记录主表] main ON bj.[主表ID] = main.[ID]
	LEFT JOIN [需求详情合并视图] mg ON bj.[三方识别码] = mg.[三方识别码]
