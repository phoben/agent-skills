SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[V_需求单报价主表状态统计] AS SELECT
[需求单ID],
[任务ID],
[报价状态],
concat(status.[状态名],'(',count(main.ID),')') AS 标题
FROM	[报价历史记录主表] main
LEFT JOIN [dic_报价状态表] status ON main.[报价状态] = status.[报价状态码]
GROUP BY [需求单ID],[任务ID],[报价状态],status.[状态名];
