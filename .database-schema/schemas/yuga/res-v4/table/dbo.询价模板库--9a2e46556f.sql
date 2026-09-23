SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[询价模板库](
	[模板描述] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[业务代码] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[报表名称] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[启用] [tinyint] NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Creator] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_UpdateHelp] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Rowversion] [datetime] NULL,
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[报价所在行] [bigint] NULL,
	[报价所在列] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[模板名称] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[缩略图] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[列名] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
