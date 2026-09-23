SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[需求详情_general](
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[FGC_Creator] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Rowversion] [timestamp] NOT NULL,
	[FGC_UpdateHelp] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[三方识别码] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[线路标识] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[需求单ID] [bigint] NULL,
	[询价任务ID] [bigint] NULL,
	[报价锁定] [bigint] NULL,
	[最低报价ID] [bigint] NULL,
	[需求描述] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[指定服务商] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[一次性费用指导价] [float] NULL,
	[周期费用指导价] [float] NULL,
	[一次性费用] [float] NULL,
	[一次性费用_税率] [float] NULL,
	[周期费用] [float] NULL,
	[周期税率] [float] NULL,
	[报价描述] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[PM是否公开] [bigint] NULL,
	[币种] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[地址ID] [bigint] NULL,
	[计算最优价来源] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[Address_中文] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[Address_英文] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[统一服务项] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
 CONSTRAINT [UK_需求详情_general_61ec9ccb67124b448dcbbfeada009276] UNIQUE NONCLUSTERED 
(
	[三方识别码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
UNIQUE NONCLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
CREATE NONCLUSTERED INDEX [IX_需求详情_uvpn_需求单ID] ON [dbo].[需求详情_general]
(
	[需求单ID] ASC,
	[询价任务ID] ASC
)
INCLUDE([最低报价ID],[三方识别码]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
ALTER TABLE [dbo].[需求详情_general] ADD  CONSTRAINT [DK_需求详情_general_34ddef478c424d85b72a96c233d49968]  DEFAULT (N'自动') FOR [计算最优价来源]
