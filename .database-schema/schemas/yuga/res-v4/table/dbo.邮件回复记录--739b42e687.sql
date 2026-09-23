SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[邮件回复记录](
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[FGC_Creator] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Rowversion] [timestamp] NOT NULL,
	[FGC_UpdateHelp] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[需求单ID] [bigint] NULL,
	[任务ID] [bigint] NULL,
	[列队ID] [bigint] NULL,
	[标题] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[正文] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[附件] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[邮件源文件] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[回复日期] [datetime] NULL,
	[供应商ID] [bigint] NULL,
	[发件人] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[抄送] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[收件人] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[密送] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[Html内容] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[回复对象] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[回复地址] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[UID] [bigint] NULL,
	[报价ID] [bigint] NULL,
	[已读] [bit] NULL,
	[MessageId] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[eml文件] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
UNIQUE NONCLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
