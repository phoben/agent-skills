SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[询价模板库_展开视图] AS SELECT  
    xj.[ID],
    xj.[模板名称],
    xj.[业务代码],
    xj.[报表名称],
    gysjb.[供应商级别编码],
		gysjb.[运营商编码],
    xj.[启用]
FROM
    [询价模板库] xj
    LEFT JOIN [询价模板库_支持供应商级别] gysjb ON 
        xj.[ID] = gysjb.[模板ID]
