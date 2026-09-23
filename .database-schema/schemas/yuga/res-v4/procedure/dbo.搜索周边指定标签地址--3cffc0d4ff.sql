SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[搜索周边指定标签地址]
    @经度 FLOAT,                      -- 中心点经度
    @纬度 FLOAT,                      -- 中心点纬度
    @半径 FLOAT,                      -- 搜索半径（米）
    @标签 NVARCHAR(MAX),              -- 标签列表（逗号分隔，如：'餐饮,购物,娱乐'）
    @code INT OUTPUT,                 -- 返回代码（输出参数）
    @msg NVARCHAR(500) OUTPUT         -- 返回消息（输出参数）
AS
BEGIN
    SET NOCOUNT ON;
    
    -- 声明变量
    DECLARE @SearchPoint GEOGRAPHY;
    
    BEGIN TRY
        -- ========================================
        -- 1. 参数验证
        -- ========================================
        
        IF @经度 IS NULL OR @纬度 IS NULL
        BEGIN
            SET @code = 1001;
            SET @msg = '经度或纬度不能为空';
            RETURN;
        END
        
        IF @纬度 < -90 OR @纬度 > 90
        BEGIN
            SET @code = 1002;
            SET @msg = '纬度超出有效范围（-90 到 90）';
            RETURN;
        END
        
        IF @经度 < -180 OR @经度 > 180
        BEGIN
            SET @code = 1003;
            SET @msg = '经度超出有效范围（-180 到 180）';
            RETURN;
        END
        
        IF @半径 IS NULL OR @半径 <= 0
        BEGIN
            SET @code = 1004;
            SET @msg = '半径必须大于0';
            RETURN;
        END
        
        
        -- 标签参数处理（允许为空或NULL，表示查询所有）
        SET @标签 = LTRIM(RTRIM(ISNULL(@标签, '')));
        
        -- ========================================
        -- 2. 创建搜索点
        -- ========================================
        
        SET @SearchPoint = GEOGRAPHY::Point(@纬度, @经度, 4326);
        
        -- ========================================
        -- 3. 创建临时表存储标签列表
        -- ========================================
        
        CREATE TABLE #标签列表 (
            标签名称 NVARCHAR(500)
        );
        
        -- 解析标签字符串并插入临时表
        IF @标签 IS NOT NULL AND @标签 != ''
        BEGIN
            -- 使用STRING_SPLIT分割标签（SQL Server 2016+）
            INSERT INTO #标签列表 (标签名称)
            SELECT LTRIM(RTRIM(value))
            FROM STRING_SPLIT(@标签, ',')
            WHERE LTRIM(RTRIM(value)) != '';
            
            -- 如果没有有效标签
            IF NOT EXISTS (SELECT 1 FROM #标签列表)
            BEGIN
                SET @code = 1006;
                SET @msg = '标签参数无效';
                DROP TABLE #标签列表;
                RETURN;
            END
        END
        
        -- ========================================
        -- 4. 查询数据并返回结果集
        -- ========================================
        
        -- 设置成功标识
        SET @code = 0;
        SET @msg = '查询成功';
        
        -- 根据是否有标签参数选择不同的查询逻辑
        IF EXISTS (SELECT 1 FROM #标签列表)
        BEGIN
            -- 有标签筛选条件
            SELECT 
                a.ID,
                a.地址名称,
                a.完整地址,
                a.国家,
                a.省份,
                a.城市,
                a.区县,
                TRY_CAST(a.经度 AS FLOAT) AS 经度,
                TRY_CAST(a.纬度 AS FLOAT) AS 纬度,
                ROUND(@SearchPoint.STDistance(a.GeoLocation), 2) AS 距离,
                STUFF((
                    SELECT ',' + t.标签名称
                    FROM [地址标签] t
                    WHERE t.地址ID = a.ID
                    FOR XML PATH('')
                ), 1, 1, '') AS 标签
            FROM [地址池] a
            WHERE 
                a.GeoLocation IS NOT NULL
                AND @SearchPoint.STDistance(a.GeoLocation) <= @半径
                AND EXISTS (
                    -- 地址必须拥有至少一个指定的标签
                    SELECT 1
                    FROM [地址标签] t
                    INNER JOIN #标签列表 tl ON t.标签名称 = tl.标签名称
                    WHERE t.地址ID = a.ID
                )
            ORDER BY @SearchPoint.STDistance(a.GeoLocation);
        END
        ELSE
        BEGIN
            -- 无标签筛选条件，返回所有符合距离范围的地址
            SELECT 
                a.ID,
                a.地址名称,
                a.完整地址,
                a.国家,
                a.省份,
                a.城市,
                a.区县,
                TRY_CAST(a.经度 AS FLOAT) AS 经度,
                TRY_CAST(a.纬度 AS FLOAT) AS 纬度,
                ROUND(@SearchPoint.STDistance(a.GeoLocation), 2) AS 距离,
                STUFF((
                    SELECT ',' + t.标签名称
                    FROM [地址标签] t
                    WHERE t.地址ID = a.ID
                    FOR XML PATH('')
                ), 1, 1, '') AS 标签
            FROM [地址池] a
            WHERE 
                a.GeoLocation IS NOT NULL
                AND @SearchPoint.STDistance(a.GeoLocation) <= @半径
            ORDER BY @SearchPoint.STDistance(a.GeoLocation);
        END
        
        -- 清理临时表
        DROP TABLE #标签列表;
        
    END TRY
    BEGIN CATCH
        -- 错误处理
        SET @code = ERROR_NUMBER();
        SET @msg = ERROR_MESSAGE();
        
        -- 清理临时表（如果存在）
        IF OBJECT_ID('tempdb..#标签列表') IS NOT NULL
            DROP TABLE #标签列表;
        
        -- 重新抛出错误，让调用方知道查询失败
        RETURN;
    END CATCH
    
END;
