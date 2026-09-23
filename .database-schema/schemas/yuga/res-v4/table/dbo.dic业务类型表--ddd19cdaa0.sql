SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[dic业务类型表](
	[业务代码] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[类型] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[图标] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[业务名称] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[允许供应商级别] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[允许运营商] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[填报页面] [nvarchar](255) COLLATE Chinese_PRC_CI_AS NULL,
	[列表页面] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[详情填报页面] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[表名] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[导入模板文件] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[描述] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[排序] [bigint] NULL,
	[使用频率] [bigint] NULL,
	[启用] [tinyint] NOT NULL,
	[FGC_CreateDate] [datetime] NULL,
	[FGC_LastModifier] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_LastModifyDate] [datetime] NULL,
	[FGC_Creator] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_UpdateHelp] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Rowversion] [datetime] NULL,
	[ID] [bigint] IDENTITY(1,1) NOT NULL,
	[是否可选供应商级别] [bigint] NULL,
	[预制备注] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[报价采用模式] [bigint] NULL,
	[业务分类] [bigint] NULL,
	[标签] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
SET ANSI_PADDING ON
GO
CREATE NONCLUSTERED INDEX [[业务代码]]] ON [dbo].[dic业务类型表]
(
	[业务代码] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
