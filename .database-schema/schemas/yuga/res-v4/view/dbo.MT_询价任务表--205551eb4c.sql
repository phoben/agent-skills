SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [MT_询价任务表] AS
SELECT 
    [需求单ID],
    [任务名称],
    [轮次],
    [任务负责人],
    [任务计划开始时间],
    [任务计划结束时间],
    [任务实际开始时间],
    [任务实际结束时间],
    [流程实例ID],
    [状态],
    [FGC_CreateDate],
    [FGC_LastModifier],
    [FGC_LastModifyDate],
    [FGC_Creator],
    [ID],
    [备注]
FROM [询价任务表];
