SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[项目需求审批历史视图] AS SELECT
'需求单' AS [分类],
com.[ID_] AS 流程记录ID,
xqd.项目ID,
xqd.业务代码,
rw.需求单ID,
rw.ID AS 询价任务ID,
rw.流程实例ID,
com.[TYPE_] AS 类型,
com.[TIME_] AS 创建时间,
com.[USER_ID_] AS 审批人,
com.[TASK_ID_] AS 流程任务ID,
com.[ACTION_] AS 操作,
com.[MESSAGE_] AS 备注,
com.[INTERNAL_COMMENT_] AS 系统备注,
com.[SIGNATURE_PAD_] AS 签名板,
concat('#',rw.需求单ID,'需求单(',xqd.业务代码,')',rw.[任务名称],'任务') AS [描述]
FROM [询价任务表] rw
LEFT JOIN (
    SELECT xm.ID AS 项目ID, xq.ID AS 需求单ID,xq.[业务代码] AS 业务代码 FROM [询价需求单视图] xq LEFT JOIN [项目主表] xm ON xq.项目ID = xm.ID
    ) xqd ON rw.需求单ID = xqd.需求单ID
LEFT JOIN [ACT_HI_COMMENT_View] com ON rw.流程实例ID = com.[PROC_INST_ID_]

UNION ALL

SELECT
'项目' AS [分类],
comment.ID_  AS 流程记录ID,
xm.ID AS 项目ID,
NULL AS 业务代码,
NULL AS 需求单ID,
NULL AS 询价任务ID,
comment.PROC_INST_ID_ AS 流程实例ID,
comment.[TYPE_] AS 类型,
comment.[TIME_] AS 创建时间,
comment.[USER_ID_] AS 审批人,
comment.[TASK_ID_] AS 流程任务ID,
comment.[ACTION_] AS 操作,
comment.[MESSAGE_] AS 备注,
comment.[INTERNAL_COMMENT_] AS 系统备注,
comment.[SIGNATURE_PAD_] AS 签名板,
concat('#',xm.ID,'项目(',xm.[项目名称],')') AS [描述]
FROM [ACT_HI_COMMENT_View] comment LEFT JOIN [项目主表] xm ON comment.PROC_INST_ID_ = xm.[流程实例ID]
WHERE xm.ID is not null
