SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[设备需求汇总视图] AS SELECT 
    '需求详情_设备采购' AS 表名称,
    ID,
    FGC_Creator,
    FGC_CreateDate,
    FGC_LastModifier,
    FGC_LastModifyDate,
    FGC_Rowversion,
    FGC_UpdateHelp, 
		品牌 AS 品牌,
    产品号 AS 产品或服务描述,
    数量 AS 数量或人天数量,
    需求单ID,
    是否采用,
    折后单价 AS 单价,
    折后总价 AS 总价,
    税率,
    币种,
    备注,
    报价供应商ID,
    报价记录主表ID AS 报价主表ID,
    是否匹配供应商,
    异常信息
FROM 
    dbo.需求详情_设备采购
UNION ALL
SELECT 
    '需求详情_设备服务' AS 表名称,
    ID,
    FGC_Creator,
    FGC_CreateDate,
    FGC_LastModifier,
    FGC_LastModifyDate,
    FGC_Rowversion,
    FGC_UpdateHelp,
		'' AS 品牌,
    服务描述 AS 产品或服务描述,
    人天数量 AS 数量或人天数量,
    需求单ID,
    是否采用,
    人天单价 AS 单价,
    总价,
    税率,
    币种,
    备注,
    报价供应商ID,
    报价记录主表ID AS 报价主表ID,
    是否匹配供应商,
    异常信息
FROM 
    dbo.需求详情_设备服务
UNION ALL
SELECT 
    '需求详情_设备维保' AS 表名称,
    ID,
    FGC_Creator,
    FGC_CreateDate,
    FGC_LastModifier,
    FGC_LastModifyDate,
    FGC_Rowversion,
    FGC_UpdateHelp,
		'' AS 品牌,
    设备型号 AS 产品或服务描述,
    服务时长 AS 数量或人天数量,
    需求单ID,
    是否采用,
    [原厂服务维保金额]+[第三方维保金额]+[现场服务金额] AS 单价,
    总价,
    税率,
    币种,
    备注,
    报价供应商ID,
    报价记录主表ID AS 报价主表ID,
    是否匹配供应商,
    异常信息
FROM 
    dbo.需求详情_设备维保;
