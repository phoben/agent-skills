SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[需求详情_设备维保](
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[FGC_Creator] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Rowversion] [timestamp] NOT NULL,
	[FGC_UpdateHelp] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[设备型号] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[序列号] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[SLA] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[原服务到期日] [datetime] NULL,
	[服务起始时间] [datetime] NULL,
	[服务截止时间] [datetime] NULL,
	[服务时长] [decimal](18, 0) NULL,
	[维保服务类型] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[需求单ID] [bigint] NOT NULL,
	[是否采用] [bigint] NULL,
	[税率] [decimal](18, 4) NULL,
	[原厂服务维保金额] [money] NULL,
	[第三方维保金额] [money] NULL,
	[现场服务金额] [money] NULL,
	[币种] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[备注] [nvarchar](1900) COLLATE Chinese_PRC_CI_AS NULL,
	[报价供应商ID] [bigint] NULL,
	[报价记录主表ID] [bigint] NULL,
	[是否匹配供应商] [bigint] NULL,
	[总价] [float] NULL,
	[异常信息] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[城市] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[SST说明] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[计算总价]  AS ([总价]),
	[线路标识] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[三方识别码] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[询价任务ID] [bigint] NULL,
	[报价锁定] [bigint] NULL,
	[品牌] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
 CONSTRAINT [PK__维保需求单__3214EC27CB41CF75] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
 CONSTRAINT [UK_需求详情_设备维保_3d7fe7c4937246f18e297c576c40eb1c] UNIQUE NONCLUSTERED 
(
	[三方识别码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
 CONSTRAINT [UQ__维保需求单__3214EC266D2DE646] UNIQUE NONCLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
ALTER TABLE [dbo].[需求详情_设备维保] ADD  DEFAULT ((0)) FOR [是否匹配供应商]
