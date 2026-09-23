SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[服务性采购模板子表](
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[FGC_Creator] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Rowversion] [timestamp] NOT NULL,
	[FGC_UpdateHelp] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[项目] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[项目描述] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[数量] [decimal](10, 2) NULL,
	[单位] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[SST说明] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[备注] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[模板主表ID] [bigint] NULL,
	[分组] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[发票类型] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
 CONSTRAINT [PK__服务性采购询价需__3214EC272959B5E3] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
