SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[View_需求详情匹配供应商] AS WITH MaxIDCTE AS (
    SELECT
        [需求单ID],
        [供应商ID],
        MAX(ID) AS MaxID
    FROM [报价历史记录主表]
    GROUP BY [需求单ID], [供应商ID]
)
SELECT
    a.[ID],
    a.[需求ID],
    a.[供应商ID],
    a.[查询方式],
		a.[任务ID],
    a.FGC_Creator AS 创建人,
    a.FGC_CreateDate AS 创建时间,
    CASE WHEN COUNT(b.ID) > 0 THEN '已查询' ELSE '未查询' END AS 查询状态,
    ISNULL(m.[报价状态], -1) AS 报价状态
FROM [需求详情_匹配供应商] a
LEFT JOIN [询价列队表] b 
    ON a.[需求ID] = b.[需求单ID] 
    AND a.[供应商ID] = b.[供应商ID] 
    AND b.[发送状态] IN (1, 2, 3)   -- 修改处：由 = 1 改为 IN (1, 2, 3) 
    AND (b.[无效标记] != 1 OR b.[无效标记] IS NULL)
LEFT JOIN 
(
    SELECT 
        a.[需求单ID],
        a.[供应商ID],
        b.[报价状态] 
    FROM MaxIDCTE a
    LEFT JOIN [报价历史记录主表] b ON a.MaxID = b.ID  
) m 
    ON a.[需求ID] = m.[需求单ID]
    AND a.[供应商ID] = m.[供应商ID]
GROUP BY
    a.[ID],
    a.[需求ID],
    a.[供应商ID],
		a.[任务ID],
    a.[查询方式],
    a.FGC_Creator,
    a.FGC_CreateDate,
    m.[报价状态];
