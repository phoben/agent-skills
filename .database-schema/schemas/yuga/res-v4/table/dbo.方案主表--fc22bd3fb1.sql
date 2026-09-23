SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[方案主表](
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[方案名称] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[方案描述] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[OTC总价] [float] NULL,
	[状态] [bigint] NULL,
	[项目ID] [bigint] NULL,
	[报价附件] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[币种] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Creator] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Rowversion] [timestamp] NOT NULL,
	[FGC_UpdateHelp] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[流程实例ID] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[方案附件] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[是否显示报价] [bit] NULL,
	[MRC总价] [float] NULL,
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
ALTER TABLE [dbo].[方案主表] ADD  CONSTRAINT [DK_方案主表_a353c9b2483f4e399ce93b0eb6df2d34]  DEFAULT ((-1)) FOR [状态]
GO
ALTER TABLE [dbo].[方案主表] ADD  CONSTRAINT [DK_方案主表_8e9bf9419de84522b9f43afb6e700e12]  DEFAULT ((0)) FOR [是否显示报价]
