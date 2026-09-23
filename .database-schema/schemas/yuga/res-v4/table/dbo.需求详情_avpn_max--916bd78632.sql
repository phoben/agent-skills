SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[需求详情_avpn_max](
	[三方识别码] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[需求单ID] [bigint] NOT NULL,
	[询价任务ID] [bigint] NULL,
	[其他附件] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[报价锁定] [bigint] NULL,
	[最低报价ID] [bigint] NULL,
	[客户名称] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[甲端地址] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[甲端客户联系人电话] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[乙端地址] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[乙端客户联系人电话] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[带宽] [bigint] NULL,
	[接口类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[备注] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[客户英文名] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[指定服务商] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[甲端联系人] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[乙端联系人] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifier] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[一次性费用] [float] NULL,
	[一次性费用_税率] [float] NULL,
	[周期费用] [float] NULL,
	[周期税率] [float] NULL,
	[FGC_Creator] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[报价描述] [nvarchar](512) COLLATE Chinese_PRC_CI_AS NULL,
	[周期费用指导价] [float] NULL,
	[FGC_UpdateHelp] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Rowversion] [datetime] NULL,
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[一次性费用指导价] [float] NULL,
	[线路标识] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[币种] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
 CONSTRAINT [UK_需求详情_avpn_max_1ade2c2bc0dc42e9bab0f47cd7c4e023] UNIQUE NONCLUSTERED 
(
	[三方识别码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
CREATE NONCLUSTERED INDEX [IX_需求详情_uvpn_需求单ID] ON [dbo].[需求详情_avpn_max]
(
	[需求单ID] ASC,
	[询价任务ID] ASC
)
INCLUDE([最低报价ID],[三方识别码]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
ALTER TABLE [dbo].[需求详情_avpn_max] ADD  CONSTRAINT [DK_需求详情_avpn_max_621e76d0bd8247f586432e6382e995a0]  DEFAULT ((0.06)) FOR [一次性费用_税率]
GO
ALTER TABLE [dbo].[需求详情_avpn_max] ADD  CONSTRAINT [DK_需求详情_avpn_max_35183e08a5974937bc576a75e3c1826e]  DEFAULT ((0.06)) FOR [周期税率]
