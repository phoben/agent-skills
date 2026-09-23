SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[报价历史记录主表](
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[FGC_Creator] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Rowversion] [timestamp] NOT NULL,
	[FGC_UpdateHelp] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[需求单ID] [bigint] NULL,
	[任务ID] [bigint] NULL,
	[供应商ID] [bigint] NULL,
	[列队ID] [bigint] NULL,
	[报价时间] [datetime] NULL,
	[邮件UID] [bigint] NULL,
	[报价附件] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[报价标题] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[是否整单报价] [bit] NULL,
	[报价金额] [float] NULL,
	[方案附件] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[报价状态] [int] NULL,
	[货期] [decimal](18, 0) NULL,
	[报价有效期天数] [decimal](18, 0) NULL,
	[报价有效期日期] [datetime] NULL,
	[币种] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[备注] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[异常信息] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[报价方式] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
UNIQUE NONCLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
CREATE NONCLUSTERED INDEX [IX_报价历史记录主表_需求单ID] ON [dbo].[报价历史记录主表]
(
	[需求单ID] ASC
)
INCLUDE([ID],[是否整单报价]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
ALTER TABLE [dbo].[报价历史记录主表] ADD  DEFAULT ((0)) FOR [是否整单报价]
GO
ALTER TABLE [dbo].[报价历史记录主表] ADD  DEFAULT ((0)) FOR [报价状态]
