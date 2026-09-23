SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[询价模板库_合并视图] AS SELECT  
    xj.[ID],
    xj.[模板名称],
    xj.[业务代码],       
    xj.[报表名称],
    MAX(xj.[启用]) AS [启用],
		STRING_AGG(CONCAT(gysjb.[供应商级别编码], ':', gysjb.[运营商编码]), ',') AS [允许供应商]
FROM  
    [询价模板库] xj   
    LEFT JOIN [询价模板库_支持供应商级别] gysjb ON xj.[ID]  = gysjb.[模板ID]   
GROUP BY   
    xj.[ID],    
    xj.[模板名称],    
    xj.[业务代码],               
    xj.[报表名称]
