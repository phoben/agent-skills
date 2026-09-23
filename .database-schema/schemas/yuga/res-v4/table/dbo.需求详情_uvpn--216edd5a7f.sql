SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[需求详情_uvpn](
	[三方识别码] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[需求单ID] [bigint] NOT NULL,
	[询价任务ID] [bigint] NOT NULL,
	[其他附件] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[报价锁定] [bigint] NULL,
	[最低报价ID] [bigint] NULL,
	[站点号] [bigint] NULL,
	[产品名称] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[电路标签] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[站点属性] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[接入电路类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[接入电路速率] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[CE所在城市] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[CE运营商] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[CE端口类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[CE提供方] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[PE接口速率] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[PE归属] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[是否经由CN2] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[月租收费方式] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[项目类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[ctvpn网号] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[装机地址] [nvarchar](1024) COLLATE Chinese_PRC_CI_AS NULL,
	[用户名称] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[用户英文名] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[用户地址] [nvarchar](1024) COLLATE Chinese_PRC_CI_AS NULL,
	[联系人] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[联系电话] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[COS类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[QOS等级_钻石] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[QOS等级_白金] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[QOS等级_金] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[QOS等级_银] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[QOS等级_铜] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[QOS等级_BE] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[站点利用率] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[开通测试要求] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[合同生效日期] [datetime] NULL,
	[合同终止日期] [datetime] NULL,
	[交付类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[AS号] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[平均故障时间] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[路由协议] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[要求完成时间] [datetime] NULL,
	[CE接口封装类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[设备购买方式] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[CE端口IP地址] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[PE端口IP地址] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[是否提供测试报告] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[Qos等级模式] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[带宽突发策略] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[最大传输字节] [bigint] NULL,
	[一次性一口价] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[CE端币种] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[PE端币种] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[CE端接入费用币种] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[网络使用费币种] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[国内长途币种] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[国际应付金额币种] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[国际对端结算金额币种] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[网络标示号] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[备注] [nvarchar](1024) COLLATE Chinese_PRC_CI_AS NULL,
	[购买云资源池] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[需求单类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[第一发展人编码] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[CE发展人编码] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[Port_B_W] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[Internet_B_W] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[Model] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[Qty] [float] NULL,
	[Network_Report] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[Standard_NMS] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
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
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[指定服务商] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[CE端口速率] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[PE所在城市] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[BFD功能] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[路由数目] [bigint] NULL,
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
 CONSTRAINT [UK_需求详情_uvpn_579c900cf9d44e6683c2c1ff62016deb] UNIQUE NONCLUSTERED 
(
	[三方识别码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
CREATE NONCLUSTERED INDEX [IX_需求详情_uvpn_需求单ID] ON [dbo].[需求详情_uvpn]
(
	[需求单ID] ASC,
	[询价任务ID] ASC
)
INCLUDE([最低报价ID],[三方识别码]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_07fc96519a854d15b21d129a25880003]  DEFAULT (N'IP虚拟专网') FOR [产品名称]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_17c40c53d56144908446357f3f25bc67]  DEFAULT (N'普通电路') FOR [电路标签]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_5c365848bb1e4e44a442dc8b737c5243]  DEFAULT (N'A') FOR [站点利用率]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_3678ca9f24f240b8b1c698b4618592d7]  DEFAULT (N'ping测试') FOR [开通测试要求]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_c16a43f4c66148be890fff0b2f3a9558]  DEFAULT (N'CE交付') FOR [交付类型]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_6baca54e7c7e4f838776abe3eccc9172]  DEFAULT (N'代购') FOR [设备购买方式]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_c7b5546b224d452790cb9b5e3e4d64dc]  DEFAULT (N'是') FOR [是否提供测试报告]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_63edd070af31439b8961d12f4753fb6d]  DEFAULT (N'绝对值') FOR [Qos等级模式]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_30b752ff03b64db596395995e2a4a593]  DEFAULT (N'标准') FOR [带宽突发策略]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_5e36c49f0fd145a7a40a704da06f81ca]  DEFAULT (N'否') FOR [一次性一口价]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_bd7730415fc442759c9b02529d300a78]  DEFAULT (N'人民币') FOR [CE端币种]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_9eaecf87570045f4b905433b1e604ad8]  DEFAULT (N'人民币') FOR [PE端币种]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_19735a0fb75d4f9bb9693d2b57f79dfb]  DEFAULT (N'人民币') FOR [CE端接入费用币种]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_7eb15d4773774655a55a0b4dff920f2d]  DEFAULT (N'人民币') FOR [网络使用费币种]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_0fac814d9e734dbe8237df4752e92de0]  DEFAULT (N'人民币') FOR [国内长途币种]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_0efe5d68e1b344de84cfd298eade6bba]  DEFAULT (N'人民币') FOR [国际应付金额币种]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_3b1085c45f92469289dd214016413019]  DEFAULT (N'人民币') FOR [国际对端结算金额币种]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_3dcb7ea1f3984f72a3b3b996dd001896]  DEFAULT (N'Ⅰ') FOR [网络标示号]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_173f87c363c046e89d2c70e6b36f3f41]  DEFAULT (N'否') FOR [购买云资源池]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_3a19a5cd5f93495085d83620a577e4cc]  DEFAULT (N'查询型需求单') FOR [需求单类型]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_1c11603b3450480e8336b9894cd3f267]  DEFAULT ((0.06)) FOR [一次性费用_税率]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_53f4eff785e64932bb827cdf50891015]  DEFAULT ((0.06)) FOR [周期税率]
GO
ALTER TABLE [dbo].[需求详情_uvpn] ADD  CONSTRAINT [DK_需求详情_uvpn_76c7b68768a44b418915d2f51e8a9f0c]  DEFAULT (N'自动') FOR [计算最优价来源]
