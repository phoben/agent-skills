SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[需求报价方案主表](
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[FGC_Creator] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Rowversion] [timestamp] NOT NULL,
	[FGC_UpdateHelp] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[任务ID] [bigint] NULL,
	[需求单ID] [bigint] NULL,
	[报价方案名称] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[报价方案描述] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[状态] [bigint] NULL,
	[方案附件] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[报价附件] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[MRC总价] [float] NULL,
	[OTC总价] [float] NULL,
	[币种] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[备注] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[推送SO标记] [bigint] NULL,
	[SO返回信息] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
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
ALTER TABLE [dbo].[需求报价方案主表] ADD  CONSTRAINT [DK_需求报价方案主表_15e889d027dd4d7985243d199256b96f]  DEFAULT ((0)) FOR [状态]
