SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[需求详情拼接视图] AS SELECT
    uias.[ID] AS [需求ID],
    uias.[三方识别码],
    uias.[线路标识],
    uias.[需求单ID],
    uias.[询价任务ID],
    uias.[报价锁定],
    uias.[最低报价ID],
    uias.[PM是否公开],
    uias.[FGC_CreateDate],
    uias.[地址ID],
    uias.[计算最优价来源],
    '需求详情_uias_new' AS [表名],
    uias.[客户名] AS [客户名称],
    uias.[线路安装地址] AS [线路地址],
	NULL AS Z端地址,
    uias.[服务提供商] AS [指定服务商],
    uias.[特别需求] AS [需求描述],
    '1' AS [数量],
    CAST(NULL AS bigint) AS [供应商ID],
    cast(uias.[带宽] as nvarchar) AS [带宽],
	cast(uias.[IP地址个数] as nvarchar) AS [IP地址个数],
    uias.[线路类型] AS [线路类型],
    uias.[一次性费用指导价] AS [一次性费用目标价],
    uias.[周期费用指导价] AS [周期费用目标价],
	uias.[FGC_LastModifyDate] AS 最后更新时间
FROM [需求详情_uias_new] uias

UNION ALL

SELECT
    uvpn.[ID] AS [需求ID],
    uvpn.[三方识别码],
    uvpn.[线路标识],
    uvpn.[需求单ID],
    uvpn.[询价任务ID],
    uvpn.[报价锁定],
    uvpn.[最低报价ID],
    uvpn.[PM是否公开],
    uvpn.[FGC_CreateDate],
    uvpn.[地址ID],
    uvpn.[计算最优价来源],
    '需求详情_uvpn' AS [表名],
    uvpn.[用户名称] AS [客户名称],
    uvpn.[装机地址] AS [线路地址],
	NULL AS Z端地址,
    uvpn.[指定服务商] AS [指定服务商],
    uvpn.[备注] AS [需求描述],
    '1' AS [数量],
    CAST(NULL AS bigint) AS [供应商ID],
	cast(uvpn.[接入电路速率] as nvarchar) AS 带宽,
	cast(uvpn.[路由数目] as nvarchar) AS [IP地址个数],
    uvpn.[接入电路类型] AS [线路类型],
    uvpn.[一次性费用指导价] AS [一次性费用目标价],
    uvpn.[周期费用指导价] AS [周期费用目标价],
	uvpn.[FGC_LastModifyDate] AS 最后更新时间
FROM [需求详情_uvpn] uvpn

UNION ALL

SELECT
    avpn.[ID] AS [需求ID],
    avpn.[三方识别码],
    avpn.[线路标识],
    avpn.[需求单ID],
    avpn.[询价任务ID],
    avpn.[报价锁定],
    avpn.[最低报价ID],
    avpn.[PM是否公开],
    avpn.[FGC_CreateDate],
    avpn.[地址ID],
    avpn.[计算最优价来源],
    '需求详情_avpn' AS [表名],
    avpn.[A端用户名称] AS [客户名称],
    avpn.[A端装机地址] AS [线路地址],
	avpn.[Z端装机地址] AS Z端地址,
    avpn.[指定服务商] AS [指定服务商],
    CAST(avpn.[备注] AS nvarchar) AS [需求描述],
    '1' AS [数量],
    CAST(NULL AS bigint) AS [供应商ID],
    cast(avpn.[速率] as nvarchar) AS 带宽,
    NULL AS [IP地址个数],
    avpn.[A端端口类型] AS [线路类型],
    avpn.[信天一次性费用目标价] AS [一次性费用目标价],
    avpn.[信天月租费目标价] AS [周期费用目标价],
	avpn.[FGC_LastModifyDate] AS 最后更新时间
FROM [需求详情_avpn] avpn

UNION ALL

SELECT
    other.[ID] AS [需求ID],
    other.[三方识别码],
    other.[线路标识],
    other.[需求单ID],
    other.[询价任务ID],
    other.[报价锁定],
    other.[最低报价ID],
    other.[PM是否公开],
    other.[FGC_CreateDate],
    other.[地址ID],
    other.[计算最优价来源],
    '需求详情_other' AS [表名],
    other.[客户名] AS [客户名称],
    other.[客户地址] AS [线路地址],
	NULL AS Z端地址,
    other.[指定服务商] AS [指定服务商],
    other.[其他特别要求] AS [需求描述],
    '1' AS [数量],
    CAST(NULL AS bigint) AS [供应商ID],
    cast(other.[具体需求描述] as nvarchar) AS 带宽,
    NULL AS [IP地址个数],
    other.[服务类型] AS [线路类型],
    other.[信天一次性费用目标价] AS [一次性费用目标价],
    other.[信天月租费目标价] AS [周期费用目标价],
	other.[FGC_LastModifyDate] AS 最后更新时间
FROM [需求详情_other] other

UNION ALL

SELECT
    uias_t1.[ID] AS [需求ID],
    uias_t1.[三方识别码],
    uias_t1.[线路标识],
    uias_t1.[需求单ID],
    uias_t1.[询价任务ID],
    uias_t1.[报价锁定],
    uias_t1.[最低报价ID],
    uias_t1.[PM是否公开],
    uias_t1.[FGC_CreateDate],
    uias_t1.[地址ID],
    uias_t1.[计算最优价来源],
    '需求详情_uias_t1' AS [表名],
    uias_t1.[用户名] AS [客户名称],
    uias_t1.[装机地址] AS [线路地址],
	NULL AS Z端地址,
    uias_t1.[指定服务商] AS [指定服务商],
    '要求完成时间：' + ISNULL(CONVERT(varchar(16), uias_t1.[要求完成时间], 120), '') AS [需求描述],
    '1' AS [数量],
    CAST(NULL AS bigint) AS [供应商ID],
    cast(uias_t1.[下行速率] as nvarchar) AS 带宽,
	cast(uias_t1.[申请数量] as nvarchar) AS [IP地址个数],
    uias_t1.[接入方式] AS [线路类型],
    uias_t1.[一次性费用指导价] AS [一次性费用目标价],
    uias_t1.[周期费用指导价] AS [周期费用目标价],
	uias_t1.[FGC_LastModifyDate] AS 最后更新时间
FROM [需求详情_uias_t1] uias_t1

UNION ALL

SELECT
    general.[ID] AS [需求ID],
    general.[三方识别码],
    general.[线路标识],
    general.[需求单ID],
    general.[询价任务ID],
    general.[报价锁定],
    general.[最低报价ID],
    general.[PM是否公开],
    general.[FGC_CreateDate],
    general.[地址ID],
    general.[计算最优价来源],
    '需求详情_general' AS [表名],
    xq.[客户中文名] AS [客户名称],
    general.[Address_中文] AS [线路地址],
	CAST(NULL AS nvarchar) AS [Z端地址],
    general.[指定服务商] AS [指定服务商],
    general.[需求描述] AS [需求描述],
    CAST(NULL AS nvarchar) AS [数量],
    CAST(NULL AS bigint) AS [供应商ID],
    NULL AS [带宽],
    NULL AS [IP地址个数],
    NULL AS [线路类型],
    general.[一次性费用指导价] AS [一次性费用目标价],
    general.[周期费用指导价] AS [周期费用目标价],
	general.[FGC_LastModifyDate] AS 最后更新时间
FROM [需求详情_general] general
LEFT JOIN [询价需求单] xq ON xq.[ID] = general.[需求单ID]

UNION ALL

SELECT
    sbcg.[ID] AS [需求ID],
    sbcg.[三方识别码],
    sbcg.[线路标识],
    sbcg.[需求单ID],
    sbcg.[询价任务ID],
    sbcg.[报价锁定],
    CAST(NULL AS bigint) AS [最低报价ID],
    sbcg.[PM是否公开],
    sbcg.[FGC_CreateDate],
    CAST(NULL AS bigint) AS [地址ID],
    CAST(NULL AS nvarchar) AS [计算最优价来源],
    '需求详情_设备采购' AS [表名],
    xq.[客户中文名] AS [客户名称],
    CAST(NULL AS nvarchar) AS [线路地址],
	CAST(NULL AS nvarchar) AS [Z端地址],		
    sbcg.[品牌] AS [指定服务商],
    'SST说明：' + ISNULL(sbcg.[SST说明], '') + CHAR(10) + '合同时长：' + ISNULL(CAST(sbcg.[合同时长] AS nvarchar), '') AS [需求描述],
    CAST(sbcg.[数量] AS nvarchar) AS [数量],
    sbcg.[报价供应商ID] AS [供应商ID],
    NULL AS [带宽],
    NULL AS [IP地址个数],
    NULL AS [线路类型],
    NULL AS [一次性费用目标价],
    NULL AS [周期费用目标价],
	sbcg.[FGC_LastModifyDate] AS 最后更新时间
FROM [需求详情_设备采购] sbcg
LEFT JOIN [询价需求单] xq ON xq.[ID] = sbcg.[需求单ID]

UNION ALL

SELECT
    sbwb.[ID] AS [需求ID],
    sbwb.[三方识别码],
    sbwb.[线路标识],
    sbwb.[需求单ID],
    sbwb.[询价任务ID],
    sbwb.[报价锁定],
    CAST(NULL AS bigint) AS [最低报价ID],
    CAST(NULL AS bigint) AS [PM是否公开],
    sbwb.[FGC_CreateDate],
    CAST(NULL AS bigint) AS [地址ID],
    CAST(NULL AS nvarchar) AS [计算最优价来源],
    '需求详情_设备维保' AS [表名],
    xq.[客户中文名] AS [客户名称],
    sbwb.[城市] AS [线路地址],
	CAST(NULL AS nvarchar) AS [Z端地址],
    CAST(NULL AS nvarchar) AS [指定服务商],
    'SST说明：' + ISNULL(sbwb.[SST说明], '') + CHAR(10) + 'SLA：' + ISNULL(sbwb.[SLA], '') + CHAR(10) + '原服务到期日：' + ISNULL(CONVERT(varchar(10), sbwb.[原服务到期日], 120), '') + CHAR(10) + '服务起止时间：' + ISNULL(CONVERT(varchar(10), sbwb.[服务起始时间], 120), '') + '~' + ISNULL(CONVERT(varchar(10), sbwb.[服务截止时间], 120), '') + CHAR(10) + '服务时长：' + ISNULL(CAST(sbwb.[服务时长] AS nvarchar), '') AS [需求描述],
    '1' AS [数量],
    sbwb.[报价供应商ID] AS [供应商ID],
    NULL AS [带宽],
    NULL AS [IP地址个数],
    NULL AS [线路类型],
    NULL AS [一次性费用目标价],
    NULL AS [周期费用目标价],
	sbwb.[FGC_LastModifyDate] AS 最后更新时间
FROM [需求详情_设备维保] sbwb
LEFT JOIN [询价需求单] xq ON xq.[ID] = sbwb.[需求单ID]

UNION ALL

SELECT
    sbfw.[ID] AS [需求ID],
    sbfw.[三方识别码],
    sbfw.[线路标识],
    sbfw.[需求单ID],
    sbfw.[询价任务ID],
    sbfw.[报价锁定],
    CAST(NULL AS bigint) AS [最低报价ID],
    CAST(NULL AS bigint) AS [PM是否公开],
    sbfw.[FGC_CreateDate],
    CAST(NULL AS bigint) AS [地址ID],
    CAST(NULL AS nvarchar) AS [计算最优价来源],
    '需求详情_设备服务' AS [表名],
    xq.[客户中文名] AS [客户名称],
    sbfw.[城市] AS [线路地址],
	CAST(NULL AS nvarchar) AS [Z端地址],
    CAST(NULL AS nvarchar) AS [指定服务商],
    'SST说明：' + ISNULL(sbfw.[SST说明], '') + CHAR(10) + 'SLA：' + ISNULL(sbfw.[SLA], '') + CHAR(10) + '是否工作日：' + ISNULL(sbfw.[是否工作日], '') AS [需求描述],
    CAST(sbfw.[人天数量] AS nvarchar) AS [数量],
    sbfw.[报价供应商ID] AS [供应商ID],
    NULL AS [带宽],
    NULL AS [IP地址个数],
    NULL AS [线路类型],
    NULL AS [一次性费用目标价],
    NULL AS [周期费用目标价],
	sbfw.[FGC_LastModifyDate] AS 最后更新时间
FROM [需求详情_设备服务] sbfw
LEFT JOIN [询价需求单] xq ON xq.[ID] = sbfw.[需求单ID]

UNION ALL

SELECT
    fwcg.[ID] AS [需求ID],
    fwcg.[三方识别码],
    fwcg.[线路标识],
    fwcg.[需求单ID],
    fwcg.[询价任务ID],
    fwcg.[报价锁定],
    CAST(NULL AS bigint) AS [最低报价ID],
    CAST(NULL AS bigint) AS [PM是否公开],
    fwcg.[FGC_CreateDate],
    CAST(NULL AS bigint) AS [地址ID],
    CAST(NULL AS nvarchar) AS [计算最优价来源],
    '需求详情_服务性采购' AS [表名],
    xq.[客户中文名] AS [客户名称],
    CAST(fwcg.[项目描述] AS nvarchar) AS [线路地址],
	CAST(NULL AS nvarchar) AS [Z端地址],
    CAST(NULL AS nvarchar) AS [指定服务商],
    'SST说明：' + ISNULL(fwcg.[SST说明], '') + CHAR(10) + '分组：' + ISNULL(fwcg.[分组], '') AS [需求描述],
    CAST(fwcg.[数量] AS nvarchar) AS [数量],
    fwcg.[报价供应商ID] AS [供应商ID],
    NULL AS [带宽],
    NULL AS [IP地址个数],
    NULL AS [线路类型],
    NULL AS [一次性费用目标价],
    NULL AS [周期费用目标价],
	fwcg.[FGC_LastModifyDate] AS 最后更新时间
FROM [需求详情_服务性采购] fwcg
LEFT JOIN [询价需求单] xq ON xq.[ID] = fwcg.[需求单ID];
