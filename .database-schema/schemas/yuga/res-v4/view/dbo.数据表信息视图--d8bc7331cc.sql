SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[数据表信息视图] AS SELECT 
    tables.name AS 表名,
    CASE 
        WHEN tables.type = 'U' THEN '表'
        WHEN tables.type = 'V' THEN '视图'
        ELSE tables.type
    END AS 类型,
    sys.extended_properties.value AS 备注
FROM 
    sys.tables AS tables
LEFT JOIN 
    sys.extended_properties ON tables.object_id = sys.extended_properties.major_id
    AND sys.extended_properties.minor_id = 0
WHERE 
    tables.schema_id = SCHEMA_ID('dbo')
