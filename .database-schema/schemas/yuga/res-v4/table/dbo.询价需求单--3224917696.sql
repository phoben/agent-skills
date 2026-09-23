SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[询价需求单](
	[业务代码] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[项目类型] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[第三方业务识别码] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[指定运营商_S] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[指定供应商级别_S] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[申请人] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[采购负责人] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[申请折扣] [float] NULL,
	[关键提醒信息] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[外部流转附件] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[内部流转附件] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[是否公开客户信息] [tinyint] NULL,
	[客户中文名] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[客户英文名] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[状态] [int] NULL,
	[计划截止日期] [datetime] NULL,
	[紧急程度] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Creator] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_UpdateHelp] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Rowversion] [datetime] NULL,
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[备注] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[所属公司] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[业务营运管理部经理] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[客户关系部经理] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[客户经理] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[报价可见] [bit] NULL,
	[参与人] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[委托标记] [bigint] NULL,
	[项目ID] [bigint] NULL,
	[销售负责人] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[报价齐套] [bigint] NULL,
	[是否署名] [bigint] NULL,
	[中文署名] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[英文署名] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[订单编号] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[需求名称] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[客户邮箱] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[推送SO标记] [bigint] NULL,
	[SO返回信息] [nvarchar](max) COLLATE Chinese_PRC_CI_AI_KS_WS NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
CREATE NONCLUSTERED INDEX [[状态]]] ON [dbo].[询价需求单]
(
	[状态] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
SET ANSI_PADDING ON
GO
CREATE NONCLUSTERED INDEX [联合索引] ON [dbo].[询价需求单]
(
	[申请人] ASC,
	[采购负责人] ASC,
	[状态] ASC,
	[参与人] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
SET ANSI_PADDING ON
GO
CREATE NONCLUSTERED INDEX [业务代码] ON [dbo].[询价需求单]
(
	[业务代码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
SET ANSI_PADDING ON
GO
CREATE NONCLUSTERED INDEX [IX_询价需求单_业务代码_创建日期] ON [dbo].[询价需求单]
(
	[业务代码] ASC,
	[FGC_CreateDate] ASC
)
INCLUDE([ID]) WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
GO
ALTER TABLE [dbo].[询价需求单] ADD  CONSTRAINT [DF__询价需求单__报价可见__4F47C5E3]  DEFAULT ((0)) FOR [报价可见]
GO
ALTER TABLE [dbo].[询价需求单] ADD  CONSTRAINT [DK_询价需求单_19e6c357c80b477cbd9e092436c3122f]  DEFAULT ((0)) FOR [是否署名]
