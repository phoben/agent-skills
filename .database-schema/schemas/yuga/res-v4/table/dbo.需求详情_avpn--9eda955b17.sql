SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[需求详情_avpn](
	[三方识别码] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[需求单ID] [bigint] NOT NULL,
	[询价任务ID] [bigint] NOT NULL,
	[其他附件] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[报价锁定] [bigint] NULL,
	[最低报价ID] [bigint] NULL,
	[产品名称] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[城市A] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[城市Z] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[需求单类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[速率] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[业务类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[A端端口类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[电路维护等级] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[A端用户名称] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[A端装机地址] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[A端联系人电话] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[A端一次性费用收款单位] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[是否为汇聚主点] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[变更类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[Z端端口类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[Z端装机地址] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[Z端联系人电话] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[Z端一次性费用收款单位] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[Z端设备来源] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[Z端运营商] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[A端参考电路接入类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[Z端用户名称] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[要求完成日期] [datetime] NULL,
	[备注] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[Z端用户英文名] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[原速率] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[移机原地址] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[原线路编号] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[CTVPN网号] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[A端联系人] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[Z端联系人] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
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
	[Z端地址ID] [bigint] NULL,
	[计算最优价来源] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
 CONSTRAINT [三方识别码] UNIQUE NONCLUSTERED 
(
	[三方识别码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
CREATE NONCLUSTERED INDEX [IX_需求详情_uvpn_需求单ID] ON [dbo].[需求详情_avpn]
(
	[需求单ID] ASC,
	[询价任务ID] ASC
)
INCLUDE([最低报价ID],[三方识别码]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
ALTER TABLE [dbo].[需求详情_avpn] ADD  CONSTRAINT [DK_需求详情_avpn_b8b84ef295504dceb267b0b51f0c96d6]  DEFAULT ((0.06)) FOR [一次性费用_税率]
GO
ALTER TABLE [dbo].[需求详情_avpn] ADD  CONSTRAINT [DK_需求详情_avpn_d0fabf080a224776b8512a4d91041e96]  DEFAULT ((0.06)) FOR [周期税率]
GO
ALTER TABLE [dbo].[需求详情_avpn] ADD  CONSTRAINT [DK_需求详情_avpn_be1b4f4e0e9545bab4e3fda0bcaa17c2]  DEFAULT (N'自动') FOR [计算最优价来源]
