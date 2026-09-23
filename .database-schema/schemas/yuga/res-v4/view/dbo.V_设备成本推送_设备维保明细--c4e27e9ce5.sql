SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[V_设备成本推送_设备维保明细]
AS
SELECT
    p.[需求单ID]                                         AS [需求单ID],
    p.[ID]                                              AS [方案ID],
    s.[ID]                                              AS [明细ID],
    p.[报价方案名称]                                       AS [方案名称],
    N'设备维保'                                           AS [业务代码],
    qs.[币种]                                            AS [币种],
    COALESCE(d.[客户中文名], d.[客户英文名])                 AS [客户名称],
    d.[申请人]                                           AS [申请人],
    d.[申请人]                                           AS [发起人],
    t.[任务名称]                                          AS [任务名称],
    d.[需求名称]                                          AS [项目名称],
    x.[品牌]                                             AS [品牌],
    x.[设备型号]                                          AS [设备型号],
    x.[序列号]                                           AS [序列号],
    x.[SLA]                                              AS [SLA],
    x.[城市]                                             AS [城市],
    x.[维保服务类型]                                       AS [维保服务类型],
    CONVERT(varchar(10), x.[原服务到期日], 23)               AS [原服务到期日],
    CONVERT(varchar(10), x.[服务起始时间], 23)               AS [服务起始时间],
    CONVERT(varchar(10), x.[服务截止时间], 23)               AS [服务截止时间],
    x.[服务时长]                                          AS [服务时长],
    x.[SST说明]                                          AS [SST说明],
    x.[原厂服务维保金额]                                    AS [原厂服务维保金额],
    x.[第三方维保金额]                                     AS [第三方维保金额],
    x.[现场服务金额]                                      AS [现场服务金额],
    qs.[一次性费用_税率]                                   AS [税率],
    qs.[一次性费用_含税价]                                 AS [总价],
    CONVERT(varchar(10), q.[报价时间], 23)                 AS [报价日期],
    CONVERT(varchar(10), q.[报价有效期日期], 23)            AS [报价有效期],
    q.[货期]                                             AS [货期],
    qs.[报价描述]                                         AS [备注]
FROM [dbo].[需求报价方案主表] p
INNER JOIN [dbo].[询价需求单] d
    ON d.[ID] = p.[需求单ID]
   AND d.[业务代码] = N'设备维保'
   AND d.[状态] IN (5, 6)
INNER JOIN [dbo].[需求报价方案子表] s
    ON s.[报价方案主表ID] = p.[ID]
INNER JOIN [dbo].[需求详情_设备维保] x
    ON x.[三方识别码] = s.[三方识别码]
INNER JOIN [dbo].[报价历史记录子表] qs
    ON qs.[ID] = s.[报价子表ID]
LEFT JOIN [dbo].[报价历史记录主表] q
    ON q.[ID] = qs.[主表ID]
LEFT JOIN [dbo].[询价任务表] t
    ON t.[ID] = p.[任务ID]
WHERE p.[状态] IN (0, 1)
