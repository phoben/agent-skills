SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[MT_报价历史记录子表] AS SELECT 
    [三方识别码],
    [需求单ID],
    [询价任务ID],
		[主表ID],
    [一次性费用_税率],
    [周期费用_税率],
    [周期单位],
    [报价描述],
    [FGC_CreateDate],
    [FGC_LastModifier],
    [FGC_LastModifyDate],
    [FGC_Creator],
    [ID],
    [一次性费用_含税价],
    [周期费用_含税价],
    [一次性费用],
    [周期费用],
    [币种]
FROM [报价历史记录子表];
