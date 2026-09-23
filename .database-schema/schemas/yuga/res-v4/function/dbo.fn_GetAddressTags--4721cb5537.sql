SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE FUNCTION dbo.fn_GetAddressTags(@地址ID BIGINT)
RETURNS NVARCHAR(MAX)
AS
BEGIN
    DECLARE @tags NVARCHAR(MAX);
    
    SELECT @tags = ISNULL(
        (
            SELECT 
                ID AS id,
                标签名称 AS tagName,
                备注 AS remark,
                FGC_CreateDate AS createTime
            FROM [地址标签]
            WHERE 地址ID = @地址ID
            FOR JSON PATH
        ),
        '[]'
    );
    
    RETURN @tags;
END;
