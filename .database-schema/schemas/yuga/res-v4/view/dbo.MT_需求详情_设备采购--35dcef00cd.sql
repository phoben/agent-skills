SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[MT_需求详情_设备采购] AS SELECT 
    [ID],
    [FGC_Creator],
    [FGC_CreateDate],
    [FGC_LastModifier],
    [FGC_LastModifyDate],
    [产品号],
    [描述],
    [数量],
    [需求单ID],
    [品牌],
    [列表单价],
    [折扣],
    [折后单价],
    [备注],
    [报价记录主表ID],
    [合同时长],
    [SST说明],
    [三方识别码],
    [询价任务ID]
FROM [需求详情_设备采购];
