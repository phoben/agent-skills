SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[MT_报价历史记录主表] AS SELECT 
    [ID],
    [需求单ID],
    [任务ID],
    [是否整单报价],
    [报价状态],
    [货期],
    [报价有效期天数],
    [报价有效期日期]
FROM [报价历史记录主表];
