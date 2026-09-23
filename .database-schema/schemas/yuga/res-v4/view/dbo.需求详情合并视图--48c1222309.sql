SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[需求详情合并视图] AS SELECT
    m.[需求ID],
    m.[三方识别码],
    m.[线路标识],
    m.[最低报价ID],
    m.[需求单ID],
    m.[询价任务ID],
    m.[报价锁定],
    m.[PM是否公开],
    m.[表名],
    m.[FGC_CreateDate] AS [创建日期],
    m.[地址ID],
    -- 规范化字段
    m.[客户名称],
    m.[带宽],
    m.[线路类型],
    m.[线路地址],
		m.[Z端地址],
    m.[IP地址个数],
    m.[指定服务商],
    m.[需求描述],
    m.[数量],
    m.[供应商ID],
    m.[一次性费用目标价],
    m.[周期费用目标价]

FROM dbo.[需求详情拼接视图] AS m;
