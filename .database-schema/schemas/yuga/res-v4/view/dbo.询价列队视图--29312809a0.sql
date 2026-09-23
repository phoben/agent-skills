SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[询价列队视图] AS SELECT
	ld.ID AS ID,
	ld.需求单ID AS 需求单ID,
	ld.询价任务ID AS 询价任务ID,
	ld.供应商ID AS 供应商ID,
	ld.目标邮箱 AS 目标邮箱,
	ld.邮件标题 AS 邮件标题,
	ld.附件内容 AS 附件内容,
	ld.邮件内容 AS 邮件内容,
	ld.发送状态 AS 发送状态,
	ld.发送时间 AS 发送时间,
	xq.业务代码 AS 业务代码,
	CASE WHEN rw.状态 = xq.状态 THEN 1 ELSE 0 END AS 可执行状态
FROM
	询价列队表 ld
	LEFT JOIN 询价任务表 rw ON ld.询价任务ID = rw.ID
	JOIN 询价需求单 xq ON rw.需求单ID = xq.ID AND ld.需求单ID = xq.ID
