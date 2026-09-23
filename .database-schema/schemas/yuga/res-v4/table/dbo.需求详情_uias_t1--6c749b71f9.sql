SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[需求详情_uias_t1](
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[FGC_Creator] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Rowversion] [timestamp] NOT NULL,
	[FGC_UpdateHelp] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[三方识别码] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[需求单ID] [bigint] NOT NULL,
	[询价任务ID] [bigint] NOT NULL,
	[用户名] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[报价锁定] [bigint] NULL,
	[最低报价ID] [bigint] NULL,
	[产品名称] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[电路标签] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[接入城市] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[申请数量] [float] NULL,
	[装机地址] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[联系人] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[联系电话] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[业务类型] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[国际出入口网络类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[接入方式] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[上行速率] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[下行速率] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[接入层级] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[IPv4路由方式] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[可用IPv4地址数量] [float] NULL,
	[全部IPv4地址数量] [float] NULL,
	[要求完成时间] [datetime] NULL,
	[月租费币种] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[网络月使用费] [float] NULL,
	[收款单位] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[需求单类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[第一发展人编码] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[周期费用指导价] [float] NULL,
	[一次性费用] [float] NULL,
	[一次性费用_税率] [float] NULL,
	[周期费用] [float] NULL,
	[周期税率] [float] NULL,
	[报价描述] [nvarchar](512) COLLATE Chinese_PRC_CI_AS NULL,
	[用户英文名] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[穿透类型] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[是否开通163QOS] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[IPv6路由方式] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[可用IPv6地址前缀数] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[IPv6地址信息] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[是否试用电路] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[试用期限_天_] [bigint] NULL,
	[_163QOS费] [float] NULL,
	[指定服务商] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
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
 CONSTRAINT [UK_需求详情_uias_t1_4212e8ac178c4a328b1e107331e44a1f] UNIQUE NONCLUSTERED 
(
	[三方识别码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
UNIQUE NONCLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
CREATE NONCLUSTERED INDEX [IX_需求详情_uvpn_需求单ID] ON [dbo].[需求详情_uias_t1]
(
	[需求单ID] ASC,
	[询价任务ID] ASC
)
INCLUDE([最低报价ID],[三方识别码]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
ALTER TABLE [dbo].[需求详情_uias_t1] ADD  CONSTRAINT [DK_需求详情_uias_t1_b1aae263d19e4f0db9ce3f8dd018a08f]  DEFAULT (N'互联网专线') FOR [产品名称]
GO
ALTER TABLE [dbo].[需求详情_uias_t1] ADD  CONSTRAINT [DK_需求详情_uias_t1_3e335b46e7414c5996d60181b52bf757]  DEFAULT (N'普通电路') FOR [电路标签]
GO
ALTER TABLE [dbo].[需求详情_uias_t1] ADD  CONSTRAINT [DK_需求详情_uias_t1_57b0af462343430c9be0cfe86cb3f6f4]  DEFAULT (N'静态') FOR [IPv4路由方式]
GO
ALTER TABLE [dbo].[需求详情_uias_t1] ADD  CONSTRAINT [DK_需求详情_uias_t1_fc97dec634764de79ecf4d21dab44195]  DEFAULT (N'人民币') FOR [月租费币种]
GO
ALTER TABLE [dbo].[需求详情_uias_t1] ADD  CONSTRAINT [DK_需求详情_uias_t1_2f4412f9376a491eae4a021fcd69d05f]  DEFAULT (N'查询型需求单') FOR [需求单类型]
GO
ALTER TABLE [dbo].[需求详情_uias_t1] ADD  CONSTRAINT [DK_需求详情_uias_t1_7301098d7a79478aaa69aabae6d05621]  DEFAULT (N'Y31000004473') FOR [第一发展人编码]
GO
ALTER TABLE [dbo].[需求详情_uias_t1] ADD  CONSTRAINT [DK_需求详情_uias_ct_t1_5816531d8f9e47209cff1dea9302f286]  DEFAULT ((0.06)) FOR [一次性费用_税率]
GO
ALTER TABLE [dbo].[需求详情_uias_t1] ADD  CONSTRAINT [DK_需求详情_uias_ct_t1_50166ab4194e4e3f8b7c2af94708db3e]  DEFAULT ((0.06)) FOR [周期税率]
GO
ALTER TABLE [dbo].[需求详情_uias_t1] ADD  CONSTRAINT [DK_需求详情_uias_t1_6357989a352f4924bf9a385e01e26227]  DEFAULT (N'自动') FOR [计算最优价来源]
