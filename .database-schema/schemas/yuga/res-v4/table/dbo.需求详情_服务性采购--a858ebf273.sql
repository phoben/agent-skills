SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[需求详情_服务性采购](
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[FGC_Creator] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Rowversion] [timestamp] NOT NULL,
	[FGC_UpdateHelp] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[需求单ID] [bigint] NOT NULL,
	[项目] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[项目描述] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[数量] [decimal](10, 2) NULL,
	[单位] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[单价] [money] NULL,
	[总价] [money] NULL,
	[发票类型] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[税率] [decimal](18, 4) NULL,
	[币种] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[SST说明] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[备注] [nvarchar](1900) COLLATE Chinese_PRC_CI_AS NULL,
	[是否采用] [bigint] NULL,
	[报价记录主表ID] [bigint] NULL,
	[报价供应商ID] [bigint] NULL,
	[异常信息] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[是否匹配供应商] [bigint] NULL,
	[分组] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[计算总价]  AS ([总价]*((1)+[税率])),
	[线路标识] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[三方识别码] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[询价任务ID] [bigint] NULL,
	[报价锁定] [bigint] NULL,
 CONSTRAINT [PK__服务类询价需求单__3214EC273E945C25] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
 CONSTRAINT [UK_需求详情_服务性采购_4b1472ee9dbc4b30b901ebd0d0ca9598] UNIQUE NONCLUSTERED 
(
	[三方识别码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF),
 CONSTRAINT [UQ__服务类询价需求单__3214EC26CA80F030] UNIQUE NONCLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
