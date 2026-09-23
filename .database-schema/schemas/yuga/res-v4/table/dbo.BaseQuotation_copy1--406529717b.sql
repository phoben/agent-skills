SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BaseQuotation_copy1](
	[ID] [int] IDENTITY(1,1) NOT NULL,
	[SystemName] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NOT NULL,
	[DocumentNumber] [nvarchar](50) COLLATE Chinese_PRC_CI_AS NULL,
	[BusinessName] [nvarchar](200) COLLATE Chinese_PRC_CI_AS NULL,
	[Address] [nvarchar](1000) COLLATE Chinese_PRC_CI_AS NULL,
	[Province] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[City] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[District] [nvarchar](100) COLLATE Chinese_PRC_CI_AS NULL,
	[Street] [nvarchar](500) COLLATE Chinese_PRC_CI_AS NULL,
	[Tag] [nvarchar](1000) COLLATE Chinese_PRC_CI_AS NULL,
	[QuotationVendor] [nvarchar](200) COLLATE Chinese_PRC_CI_AS NULL,
	[OTC] [decimal](18, 2) NULL,
	[OTC-TR] [decimal](18, 2) NULL,
	[MRC] [decimal](18, 2) NULL,
	[MRC-TR] [decimal](18, 2) NULL,
	[Currency] [nvarchar](10) COLLATE Chinese_PRC_CI_AS NULL,
	[Remarks] [nvarchar](max) COLLATE Chinese_PRC_CI_AS NULL,
	[QuotationDate] [datetime] NULL,
	[DataID] [bigint] NULL,
PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
)
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'业务系统名' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'SystemName'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'业务单据号' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'DocumentNumber'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'业务名称' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'BusinessName'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'原始地址' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'Address'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'省' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'Province'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'市' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'City'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'区' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'District'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'街道' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'Street'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'标签' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'Tag'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'报价方名称' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'QuotationVendor'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'一次性费用' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'OTC'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'一次性费用税率' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'OTC-TR'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'周期性费用' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'MRC'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'周期性费用税率' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'MRC-TR'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'币种' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'Currency'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'备注' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'Remarks'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'报价时间' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'QuotationDate'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'数据源ID' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'BaseQuotation_copy1', @level2type=N'COLUMN',@level2name=N'DataID'
