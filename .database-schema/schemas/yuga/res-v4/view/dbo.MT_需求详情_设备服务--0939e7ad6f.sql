SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[MT_需求详情_设备服务] AS SELECT 
    [ID],
    [FGC_Creator],
    [FGC_CreateDate],
    [FGC_LastModifier],
    [FGC_LastModifyDate],
    [设备类型],
    [服务描述],
    [SLA],
    [城市],
    [是否工作日],
    [人天数量],
    [需求单ID],
    [人天单价],
    [备注],
    [报价记录主表ID],
    [SST说明],
    [单位],
    [三方识别码],
    [询价任务ID]
FROM [需求详情_设备服务];
