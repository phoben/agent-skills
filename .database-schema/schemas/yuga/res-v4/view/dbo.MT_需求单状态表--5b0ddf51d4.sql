SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [MT_需求单状态表] AS
SELECT 
    [状态],
    [进度],
    [FGC_Creator],
    [FGC_CreateDate],
    [FGC_LastModifier],
    [FGC_LastModifyDate],
    [ID]
FROM [dic需求单状态表];
