SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[需求详情_other](
	[三方识别码] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[需求单ID] [bigint] NOT NULL,
	[询价任务ID] [bigint] NOT NULL,
	[其他附件] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[报价锁定] [bigint] NULL,
	[最低报价ID] [bigint] NULL,
	[客户名] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[客户地址] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[联系人] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[联系电话] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[服务类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[具体需求描述] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[其他特别要求] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[客户英文名] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[一次性费用] [float] NULL,
	[一次性费用_税率] [float] NULL,
	[周期费用] [float] NULL,
	[周期税率] [float] NULL,
	[指定服务商] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifier] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[报价描述] [nvarchar](512) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Creator] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_UpdateHelp] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Rowversion] [datetime] NULL,
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[信天月租费目标价] [float] NULL,
	[信天一次性费用目标价] [float] NULL,
	[线路标识] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[PM是否公开] [bigint] NULL,
	[币种] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[地址ID] [bigint] NULL,
	[计算最优价来源] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
 CONSTRAINT [UK_需求详情_other_fdd57a2c51c549cfa8e94d0e1590feaa] UNIQUE NONCLUSTERED 
(
	[三方识别码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
CREATE NONCLUSTERED INDEX [IX_需求详情_uvpn_需求单ID] ON [dbo].[需求详情_other]
(
	[需求单ID] ASC,
	[询价任务ID] ASC
)
INCLUDE([最低报价ID],[三方识别码]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
ALTER TABLE [dbo].[需求详情_other] ADD  CONSTRAINT [DK_需求详情_other_67d418a35fca46c99137197df738f0a1]  DEFAULT ((0.06)) FOR [一次性费用_税率]
GO
ALTER TABLE [dbo].[需求详情_other] ADD  CONSTRAINT [DK_需求详情_other_f780e31a88f545eaa8f52fd9aae225df]  DEFAULT ((0.06)) FOR [周期税率]
GO
ALTER TABLE [dbo].[需求详情_other] ADD  CONSTRAINT [DK_需求详情_other_28366ab461614215a023511d69d0c2f8]  DEFAULT (N'自动') FOR [计算最优价来源]
