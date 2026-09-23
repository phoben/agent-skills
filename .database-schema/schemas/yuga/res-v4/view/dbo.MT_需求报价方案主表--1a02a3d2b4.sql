SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [MT_需求报价方案主表] AS
SELECT 
    [ID],
    [FGC_Creator],
    [FGC_CreateDate],
    [FGC_LastModifier],
    [FGC_LastModifyDate],
    [任务ID],
    [需求单ID],
    [报价方案名称],
    [报价方案描述],
    [状态],
    [方案附件],
    [报价附件],
    [MRC总价],
    [OTC总价],
    [币种],
    [备注]
FROM [需求报价方案主表];
