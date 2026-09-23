SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[需求详情_uvpn_t2](
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[三方识别码] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[需求单ID] [bigint] NOT NULL,
	[询价任务ID] [bigint] NOT NULL,
	[其他附件] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[报价锁定] [bigint] NULL,
	[最低报价ID] [bigint] NULL,
	[客户名] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[安装地址] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[联系人] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[联系电话] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[uvpn_loca_loop_bandwidth] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[uvpn_port_cdr_bandwidth] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[uvpn_ports_cdr_diamond_qos] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[Port_B_W] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[Internet_B_W] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[Model] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[Qty] [float] NULL,
	[Network_Report] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[Standard_NMS] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[周期费用指导价] [float] NULL,
	[一次性费用] [float] NULL,
	[一次性费用_税率] [float] NULL,
	[周期费用] [float] NULL,
	[周期税率] [float] NULL,
	[报价描述] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Creator] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Rowversion] [timestamp] NOT NULL,
	[FGC_UpdateHelp] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[一次性费用指导价] [float] NULL,
	[线路标识] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[币种] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
 CONSTRAINT [UK_需求详情_uvpn_t2_234db174d64d4c4cb64c51c45ccca78c] UNIQUE NONCLUSTERED 
(
	[三方识别码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
UNIQUE NONCLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
SET ANSI_PADDING ON
GO
CREATE NONCLUSTERED INDEX [[三方识别码]]] ON [dbo].[需求详情_uvpn_t2]
(
	[三方识别码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
CREATE NONCLUSTERED INDEX [[最低报价ID]]] ON [dbo].[需求详情_uvpn_t2]
(
	[最低报价ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
CREATE NONCLUSTERED INDEX [IX_需求详情_uvpn_需求单ID] ON [dbo].[需求详情_uvpn_t2]
(
	[需求单ID] ASC,
	[询价任务ID] ASC
)
INCLUDE([最低报价ID],[三方识别码]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
