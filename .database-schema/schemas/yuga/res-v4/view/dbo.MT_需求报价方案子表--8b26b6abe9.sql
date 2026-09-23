SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [MT_需求报价方案子表] AS
SELECT 
    [ID],
    [FGC_Creator],
    [FGC_CreateDate],
    [FGC_LastModifier],
    [FGC_LastModifyDate],
    [报价方案主表ID],
    [报价子表ID],
    [三方识别码]
FROM [需求报价方案子表];
