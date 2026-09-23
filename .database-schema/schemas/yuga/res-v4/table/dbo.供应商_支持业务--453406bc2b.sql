SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[供应商_支持业务](
	[供应商ID] [bigint] NOT NULL,
	[业务代码] [nvarchar](300) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Creator] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_UpdateHelp] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Rowversion] [datetime] NULL,
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[联系人] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[联系人邮箱] [nvarchar](200) COLLATE Chinese_PRC_CI_AS NULL,
	[备注] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[删除标记] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
ALTER TABLE [dbo].[供应商_支持业务] ADD  CONSTRAINT [DK_供应商_支持业务_d037ba378a7a41479607dd0ad783b3a6]  DEFAULT ((0)) FOR [删除标记]
