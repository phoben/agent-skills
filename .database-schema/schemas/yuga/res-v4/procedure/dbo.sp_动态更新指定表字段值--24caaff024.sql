SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- =============================================
-- 创建存储过程：动态更新指定表的指定字段
-- 返回值：code=0表示成功，code!=0表示失败
-- =============================================
CREATE PROCEDURE sp_动态更新指定表字段值
    @table_name NVARCHAR(128),      -- 表名
    @column_name NVARCHAR(128),     -- 列名
    @value NVARCHAR(MAX),           -- 更新的值
    @ID INT,                        -- 记录ID
    @code INT OUTPUT,               -- 返回码：0=成功，非0=失败
    @msg NVARCHAR(500) OUTPUT       -- 返回消息
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @sql NVARCHAR(MAX);
    DECLARE @params NVARCHAR(MAX);
    DECLARE @rowCount INT;
    
    -- 初始化返回值
    SET @code = 0;
    SET @msg = '';
    
    -- 参数验证
    IF @table_name IS NULL OR @column_name IS NULL OR @ID IS NULL
    BEGIN
        SET @code = 1;
        SET @msg = '参数不能为空';
        RETURN;
    END
    
    -- 验证表是否存在
    IF NOT EXISTS (
        SELECT 1 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = @table_name
    )
    BEGIN
        SET @code = 2;
        SET @msg = '表 [' + @table_name + '] 不存在';
        RETURN;
    END
    
    -- 验证列是否存在
    IF NOT EXISTS (
        SELECT 1 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = @table_name 
        AND COLUMN_NAME = @column_name
    )
    BEGIN
        SET @code = 3;
        SET @msg = '列 [' + @column_name + '] 在表 [' + @table_name + '] 中不存在';
        RETURN;
    END
    
    -- 构建动态SQL
    SET @sql = N'UPDATE ' + QUOTENAME(@table_name) + 
               N' SET ' + QUOTENAME(@column_name) + N' = @value_param' +
               N' WHERE ID = @ID_param';
    
    SET @params = N'@value_param NVARCHAR(MAX), @ID_param INT';
    
    -- 执行动态SQL
    BEGIN TRY
        EXEC sp_executesql @sql, @params, 
            @value_param = @value, 
            @ID_param = @ID;
        
        SET @rowCount = @@ROWCOUNT;
        
        IF @rowCount > 0
        BEGIN
            SET @code = 0;
            SET @msg = '更新成功，影响行数：' + CAST(@rowCount AS NVARCHAR(10));
        END
        ELSE
        BEGIN
            SET @code = 4;
            SET @msg = '未找到ID为 ' + CAST(@ID AS NVARCHAR(10)) + ' 的记录';
        END
    END TRY
    BEGIN CATCH
        SET @code = 99;
        SET @msg = '执行错误：' + ERROR_MESSAGE();
    END CATCH
END
