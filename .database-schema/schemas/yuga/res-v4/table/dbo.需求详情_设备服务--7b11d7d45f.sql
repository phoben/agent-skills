SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[需求详情_设备服务](
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[FGC_Creator] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Rowversion] [timestamp] NOT NULL,
	[FGC_UpdateHelp] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[设备类型] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[服务描述] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[SLA] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[城市] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[是否工作日] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[人天数量] [decimal](10, 1) NULL,
	[需求单ID] [bigint] NOT NULL,
	[是否采用] [bigint] NULL,
	[人天单价] [money] NULL,
	[总价] [money] NULL,
	[税率] [decimal](18, 4) NULL,
	[币种] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[备注] [nvarchar](1900) COLLATE Chinese_PRC_CI_AS NULL,
	[报价记录主表ID] [bigint] NULL,
	[报价供应商ID] [bigint] NULL,
	[是否匹配供应商] [bigint] NULL,
	[异常信息] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[SST说明] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[单位] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[计算总价]  AS ([总价]),
	[线路标识] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[三方识别码] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[询价任务ID] [bigint] NULL,
	[报价锁定] [bigint] NULL,
 CONSTRAINT [PK__人工需求单__3214EC27FB3E60F5] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
 CONSTRAINT [UK_需求详情_设备服务_2832cc099f8046838e340d8021e1d4f4] UNIQUE NONCLUSTERED 
(
	[三方识别码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
 CONSTRAINT [UQ__人工需求单__3214EC26BCDAB7BC] UNIQUE NONCLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
ALTER TABLE [dbo].[需求详情_设备服务] ADD  DEFAULT ((0)) FOR [是否匹配供应商]
