SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[邮件往来记录视图] AS SELECT
  CONCAT('收件_', [ID]) AS 主键识别码,
  UID AS [UID],
  [需求单ID],
  [任务ID],
  [列队ID],
  [供应商ID],
  [报价ID],
  [发件人],
  [收件人],
  [标题],
  [Html内容] AS 正文,
  [附件],
  [回复日期] AS 时间,
  [已读],
  [MessageId],
  '' AS FGC_Creator,
  '收件' AS 收发类型,
  (
    CASE
      WHEN 报价ID > 0 THEN '报价成功'
      ELSE '尚无报价'
    END
  ) AS 状态
FROM
  [邮件回复记录] a
GROUP BY
  ID,
  UID,
  [需求单ID],
  [任务ID],
  [列队ID],
  [供应商ID],
  [报价ID],
  [发件人],
  [收件人],
  [标题],
  [Html内容],
  [附件],
  [回复日期],
  [已读],
  [MessageId]
UNION ALL
SELECT
  CONCAT('询价_', a.ID) AS 主键识别码,
  NULL AS [UID],
  [需求单ID],
  [询价任务ID] AS [任务ID],
  a.ID AS [列队ID],
  [供应商ID],
  '' AS 报价ID,
  '' AS 发件人,
  [目标邮箱] AS 收件人,
  [邮件标题] AS 标题,
  [邮件内容] AS 正文,
  [附件内容] AS 附件,
  [发送时间] AS 时间,
  '1' AS [已读],
	[MessageId],
  '' AS FGC_Creator,
  '发件' AS 收发类型,
  b.状态值 AS 状态
FROM
  [询价列队表] a
  LEFT JOIN [dic_询价列队状态] b ON a.发送状态 = b.状态码;
