SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[fgc_usd_shamus_pc](
	[FGC_UserName] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[FGC_FullName] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Email] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_Role] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_OrganizationBelongsTo] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_RootOrganizationCanAccess] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_OrganizationQueryCache] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[FGC_OrganizationSuperior] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[头像] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[公司] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[部门] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL,
	[小组] [nvarchar](190) COLLATE Chinese_PRC_CI_AS NULL
)
