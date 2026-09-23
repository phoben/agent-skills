SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[V_设备成本推送_设备采购明细]
AS
SELECT
    p.[需求单ID]                                         AS [需求单ID],
    p.[ID]                                              AS [方案ID],
    s.[ID]                                              AS [明细ID],
    p.[报价方案名称]                                       AS [方案名称],
    N'设备采购'                                           AS [业务代码],
    qs.[币种]                                            AS [币种],
    COALESCE(d.[客户中文名], d.[客户英文名])                 AS [客户名称],
    d.[申请人]                                           AS [申请人],
    d.[申请人]                                           AS [发起人],
    t.[任务名称]                                          AS [任务名称],
    d.[需求名称]                                          AS [项目名称],
    x.[品牌]                                             AS [品牌],
    x.[产品号]                                           AS [产品号],
    x.[描述]                                             AS [描述],
    x.[SST说明]                                          AS [SST说明],
    x.[合同时长]                                          AS [合同时长],
    x.[数量]                                             AS [数量],
    x.[列表单价]                                          AS [列表单价],
    x.[折扣]                                             AS [折扣],
    x.[折后单价]                                          AS [折后单价],
    qs.[一次性费用_税率]                                   AS [税率],
    qs.[一次性费用_含税价]                                 AS [总价],
    CONVERT(varchar(10), q.[报价时间], 23)                 AS [报价日期],
    CONVERT(varchar(10), q.[报价有效期日期], 23)            AS [报价有效期],
    q.[货期]                                             AS [货期],
    qs.[报价描述]                                         AS [备注]
FROM [dbo].[需求报价方案主表] p
INNER JOIN [dbo].[询价需求单] d
    ON d.[ID] = p.[需求单ID]
   AND d.[业务代码] = N'设备采购'
   AND d.[状态] IN (5, 6)
INNER JOIN [dbo].[需求报价方案子表] s
    ON s.[报价方案主表ID] = p.[ID]
INNER JOIN [dbo].[需求详情_设备采购] x
    ON x.[三方识别码] = s.[三方识别码]
INNER JOIN [dbo].[报价历史记录子表] qs
    ON qs.[ID] = s.[报价子表ID]
LEFT JOIN [dbo].[报价历史记录主表] q
    ON q.[ID] = qs.[主表ID]
LEFT JOIN [dbo].[询价任务表] t
    ON t.[ID] = p.[任务ID]
WHERE p.[状态] IN (0, 1)
