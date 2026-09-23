SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE dbo.ConvertToIdentity
    @TableName NVARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;

    -- 检查表是否存在
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(@TableName) AND type in (N'U'))
    BEGIN
        RAISERROR ('Table %s does not exist.', 16, 1, @TableName);
        RETURN;
    END

    -- 删除名为 "ID" 的字段
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(@TableName) AND name = 'ID')
    BEGIN
        ALTER TABLE dbo.[@TableName] DROP COLUMN ID;
    END

    -- 新增自增主键 "ID" 字段
    ALTER TABLE dbo.[@TableName] ADD ID INT IDENTITY(1,1) PRIMARY KEY;

    PRINT 'Table structure updated successfully.';
END
