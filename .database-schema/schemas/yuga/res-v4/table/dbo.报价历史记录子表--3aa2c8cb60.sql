SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[报价历史记录子表](
	[三方识别码] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[供应商ID] [bigint] NOT NULL,
	[需求单ID] [bigint] NOT NULL,
	[询价任务ID] [bigint] NOT NULL,
	[一次性费用_税率] [decimal](18, 4) NULL,
	[周期费用_税率] [decimal](18, 4) NULL,
	[周期单位] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[报价描述] [nvarchar](1900) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Creator] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_UpdateHelp] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Rowversion] [datetime] NULL,
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[主表ID] [bigint] NULL,
	[邮件UID] [bigint] NULL,
	[一次性费用_含税价] [money] NULL,
	[周期费用_含税价] [money] NULL,
	[一次性费用]  AS (round([一次性费用_含税价]-[一次性费用_含税价]*[一次性费用_税率],(2))) PERSISTED,
	[最优报价] [bigint] NULL,
	[是否有历史更低价] [bigint] NULL,
	[异常信息] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[周期费用]  AS (round([周期费用_含税价]+[周期费用_含税价]*[周期费用_税率],(2))) PERSISTED,
	[币种] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[设备采购_三方识别码]  AS ([三方识别码]),
	[设备维保_三方识别码]  AS ([三方识别码]),
	[设备服务_三方识别码]  AS ([三方识别码]),
	[服务性采购_三方识别码]  AS ([三方识别码]),
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
SET ANSI_PADDING ON
GO
CREATE NONCLUSTERED INDEX [三方识别码] ON [dbo].[报价历史记录子表]
(
	[三方识别码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
SET ANSI_PADDING ON
GO
CREATE NONCLUSTERED INDEX [IX_报价历史_识别码_供应商] ON [dbo].[报价历史记录子表]
(
	[三方识别码] ASC,
	[供应商ID] ASC
)
INCLUDE([ID]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
CREATE NONCLUSTERED INDEX [IX_报价历史记录子表_主表ID] ON [dbo].[报价历史记录子表]
(
	[主表ID] ASC
)
INCLUDE([ID],[供应商ID],[一次性费用_税率],[周期费用_税率],[一次性费用_含税价],[周期费用_含税价],[报价描述]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
ALTER TABLE [dbo].[报价历史记录子表] ADD  CONSTRAINT [DK_报价历史记录子表_531e64ab990a4a6c8e57c2df34c34b0b]  DEFAULT ((0)) FOR [最优报价]
