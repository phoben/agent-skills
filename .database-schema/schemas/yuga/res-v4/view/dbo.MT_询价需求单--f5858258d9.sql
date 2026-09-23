SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [MT_询价需求单] AS
SELECT 
    [业务代码],
    [项目类型],
    [第三方业务识别码],
    [指定运营商_S],
    [指定供应商级别_S],
    [申请人],
    [采购负责人],
    [申请折扣],
    [关键提醒信息],
    [外部流转附件],
    [内部流转附件],
    [是否公开客户信息],
    [客户中文名],
    [客户英文名],
    [状态],
    [计划截止日期],
    [紧急程度],
    [FGC_CreateDate],
    [FGC_LastModifier],
    [FGC_LastModifyDate],
    [FGC_Creator],
    [ID],
    [备注],
    [所属公司],
    [业务营运管理部经理],
    [客户关系部经理],
    [客户经理],
    [参与人],
    [项目ID],
    [销售负责人],
    [是否署名],
    [中文署名],
    [英文署名],
    [订单编号],
    [需求名称],
    [客户邮箱]
FROM [询价需求单];
