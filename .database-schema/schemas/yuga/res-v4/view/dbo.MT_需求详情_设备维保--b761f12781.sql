SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[MT_需求详情_设备维保] AS SELECT 
    [ID],
    [FGC_Creator],
    [FGC_CreateDate],
    [FGC_LastModifier],
    [FGC_LastModifyDate],
    [设备型号],
    [序列号],
    [SLA],
    [原服务到期日],
    [服务起始时间],
    [服务截止时间],
    [服务时长],
    [维保服务类型],
    [需求单ID],
    [原厂服务维保金额],
    [第三方维保金额],
    [现场服务金额],
    [备注],
    [报价记录主表ID],
    [城市],
    [SST说明],
    [三方识别码],
    [询价任务ID],
    [品牌]
FROM [需求详情_设备维保];
