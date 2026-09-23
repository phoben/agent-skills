SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[V_最新报价记录] AS WITH RankedQuotes AS (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY 三方识别码, 供应商ID, 需求单ID, 询价任务ID 
               ORDER BY FGC_CreateDate DESC
           ) AS RowNum
    FROM [dbo].[报价历史记录子表]
)
SELECT 
    [三方识别码],
    [供应商ID],
    [需求单ID],
    [询价任务ID],
    [一次性费用_税率],
    [周期费用_税率],
    [周期单位],
    [报价描述],
    [FGC_CreateDate],
    [FGC_LastModifier],
    [FGC_LastModifyDate],
    [FGC_Creator],
    [FGC_UpdateHelp],
    [FGC_Rowversion],
    [ID],
    [主表ID],
    [邮件UID],
    [币种],
    [一次性费用_含税价],
    [周期费用_含税价],
    [一次性费用],
    [周期费用],
    [最优报价],
    [是否有历史更低价],
    [异常信息]
FROM RankedQuotes
WHERE RowNum = 1
