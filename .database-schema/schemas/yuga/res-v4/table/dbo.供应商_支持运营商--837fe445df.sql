SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[供应商_支持运营商](
	[供应商ID] [bigint] NOT NULL,
	[运营商编码] [nvarchar](20) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[排序] [int] NULL,
	[删除标记] [bigint] NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Creator] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_UpdateHelp] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Rowversion] [timestamp] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
ALTER TABLE [dbo].[供应商_支持运营商] ADD  CONSTRAINT [DK_供应商_支持运营商_0e96a1b6ccbf48e093a7f1cb595a2925]  DEFAULT ((0)) FOR [删除标记]
