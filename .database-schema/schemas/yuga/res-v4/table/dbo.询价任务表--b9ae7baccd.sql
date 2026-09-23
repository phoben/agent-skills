SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[询价任务表](
	[需求单ID] [bigint] NOT NULL,
	[任务名称] [nvarchar](24) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[轮次] [bigint] NULL,
	[任务负责人] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[任务计划开始时间] [datetime] NULL,
	[任务计划结束时间] [datetime] NULL,
	[任务实际开始时间] [datetime] NULL,
	[任务实际结束时间] [datetime] NULL,
	[流程实例ID] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[状态] [int] NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Creator] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_UpdateHelp] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Rowversion] [datetime] NULL,
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[异常提醒] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[备注] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
CREATE NONCLUSTERED INDEX [[需求单ID]]] ON [dbo].[询价任务表]
(
	[需求单ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
