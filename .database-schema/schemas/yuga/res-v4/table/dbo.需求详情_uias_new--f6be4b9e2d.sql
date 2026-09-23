SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[需求详情_uias_new](
	[三方识别码] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[需求单ID] [bigint] NOT NULL,
	[询价任务ID] [bigint] NOT NULL,
	[报价锁定] [bigint] NULL,
	[最低报价ID] [bigint] NULL,
	[客户名] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[线路安装地址] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[Line_installation_address_EN] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[联系人] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[联系电话] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[线路类型] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[带宽] [int] NULL,
	[IP地址类型] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[IP地址个数] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[是否有海外访问需求] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[优化出口方向] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[海外WEB地址] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[特殊应用需求] [nvarchar](1024) COLLATE Chinese_PRC_CI_AS NULL,
	[接入端口类型] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[IP网段个数] [nvarchar](1024) COLLATE Chinese_PRC_CI_AS NULL,
	[服务提供商] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[特别需求] [nvarchar](1024) COLLATE Chinese_PRC_CI_AS NULL,
	[周期费用指导价] [float] NULL,
	[一次性费用] [float] NULL,
	[一次性费用_税率] [float] NULL,
	[周期费用] [float] NULL,
	[报价描述] [nvarchar](512) COLLATE Chinese_PRC_CI_AS NULL,
	[周期税率] [float] NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Creator] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_UpdateHelp] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Rowversion] [datetime] NULL,
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[一次性费用指导价] [float] NULL,
	[线路标识] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[PM是否公开] [bigint] NULL,
	[币种] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[地址ID] [bigint] NULL,
	[计算最优价来源] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
 CONSTRAINT [UK_需求详情_uias_new_83e2eadbefc1473ea5f643417f49154b] UNIQUE NONCLUSTERED 
(
	[三方识别码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
CREATE NONCLUSTERED INDEX [IX_需求详情_uias_new_需求单ID] ON [dbo].[需求详情_uias_new]
(
	[需求单ID] ASC,
	[询价任务ID] ASC
)
INCLUDE([最低报价ID],[三方识别码]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
ALTER TABLE [dbo].[需求详情_uias_new] ADD  CONSTRAINT [DK_需求详情_uias_new_5457eb30e7474f7182cb06aa73adaffa]  DEFAULT ((0.06)) FOR [一次性费用_税率]
GO
ALTER TABLE [dbo].[需求详情_uias_new] ADD  CONSTRAINT [DK_需求详情_uias_new_a841f7d3cdd14ac095577f85fa65f327]  DEFAULT ((0.06)) FOR [周期税率]
GO
ALTER TABLE [dbo].[需求详情_uias_new] ADD  CONSTRAINT [DK_需求详情_uias_new_44f6b670f3354a7c9b114afad0610912]  DEFAULT (N'自动') FOR [计算最优价来源]
