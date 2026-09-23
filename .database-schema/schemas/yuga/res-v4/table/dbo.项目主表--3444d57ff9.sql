SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[项目主表](
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[FGC_Creator] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Rowversion] [timestamp] NOT NULL,
	[FGC_UpdateHelp] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[项目名称] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[客户中文名] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[客户英文名] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[申请人] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[采购负责人] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[参与人] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[计划截止日期] [datetime] NULL,
	[内部流转附件] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[外部流转附件] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[报价可见] [bit] NULL,
	[委托标记] [bigint] NULL,
	[状态] [bigint] NULL,
	[关键信息提醒] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[是否公开客户信息] [bit] NULL,
	[备注] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[项目需求] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[流程实例ID] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
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
ALTER TABLE [dbo].[项目主表] ADD  CONSTRAINT [DK_项目主表_1631ee560bad48608ea2c7a1338ce59b]  DEFAULT ((0)) FOR [报价可见]
GO
ALTER TABLE [dbo].[项目主表] ADD  CONSTRAINT [DK_项目主表_48725fdab0014feb9522ce82956a51ec]  DEFAULT ((0)) FOR [状态]
