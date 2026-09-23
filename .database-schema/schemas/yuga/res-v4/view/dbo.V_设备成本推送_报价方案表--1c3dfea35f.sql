SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[V_设备成本推送_报价方案表] AS SELECT
    p.[需求单ID]                                          AS [需求单ID],
    p.[ID]                                               AS [方案ID],
    p.[报价方案名称]                                       AS [方案名称],
    p.[状态]                                             AS [确认采用],
    CONVERT(varchar(19), p.[FGC_LastModifyDate], 120)      AS [最后更新时间]
FROM [dbo].[需求报价方案主表] p
INNER JOIN [dbo].[询价需求单] d
    ON d.[ID] = p.[需求单ID]
   AND d.[业务代码] IN (N'设备采购', N'设备维保', N'设备服务')
   AND d.[状态] IN (5, 6)
WHERE p.[状态] IN (0, 1)
