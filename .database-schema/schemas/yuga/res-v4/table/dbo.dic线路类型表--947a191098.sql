SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[dic线路类型表](
	[供应商级别] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[支持CT] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[支持CU] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[支持CM] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[线路名称] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Creator] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_CreateDate] [datetime2](7) NULL,
	[FGC_LastModifier] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime2](7) NULL,
	[FGC_Rowversion] [datetime2](7) NULL,
	[FGC_UpdateHelp] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
