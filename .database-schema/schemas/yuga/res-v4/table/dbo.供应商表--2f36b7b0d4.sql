SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[供应商表](
	[公司名称] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[级别编码] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[联系邮箱] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[是否禁用] [bigint] NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Creator] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_UpdateHelp] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Rowversion] [datetime] NULL,
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[模板_运营商编码] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[是否常用] [bigint] NULL,
	[业务分类] [bigint] NULL,
	[税号] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
