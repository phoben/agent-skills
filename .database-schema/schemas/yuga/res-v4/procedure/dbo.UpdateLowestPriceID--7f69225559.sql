SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE dbo.UpdateLowestPriceID
    @tableName VARCHAR(255),
    @lowestPriceID INT,
    @thirdPartyCode VARCHAR(255),
    @returnCode INT OUTPUT,
    @returnValue VARCHAR(255) OUTPUT
AS
BEGIN
    DECLARE @rowCount INT;

    -- 异常处理
    BEGIN TRY
        BEGIN TRANSACTION;

        -- 更新表中的最低报价ID字段
        DECLARE @sql NVARCHAR(MAX) = N'UPDATE ' + QUOTENAME(@tableName) + ' SET [最低报价ID] = ' + CAST(@lowestPriceID AS NVARCHAR) + N' WHERE [三方识别码] = ''' + @thirdPartyCode + N'''';
        EXEC sp_executesql @sql;

        -- 获取更新的行数
        SET @rowCount = @@ROWCOUNT;

        -- 提交事务并设置返回参数
        COMMIT TRANSACTION;
        SET @returnCode = 0;
        SET @returnValue = '成功更新 ' + CAST(@rowCount AS NVARCHAR) + ' 行';
    END TRY
    BEGIN CATCH
        -- 错误处理
        SET @returnCode = ERROR_NUMBER();
        SET @returnValue = ERROR_MESSAGE();
        ROLLBACK TRANSACTION;
    END CATCH;
END
