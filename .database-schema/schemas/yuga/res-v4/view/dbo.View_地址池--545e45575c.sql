SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[View_地址池] AS SELECT
  dz.ID,
  dz.地址名称,
  dz.完整地址,
  dz.国家,
  dz.省份,
  dz.城市,
  dz.区县,
  dz.乡镇,
  dz.社区,
  dz.楼栋号,
  dz.单元号,
  dz.层号,
  dz.房间号,
  dz.经度,
  dz.纬度,
  concat(dz.经度, ',', dz.纬度) AS [经纬度],
  STRING_AGG(tag.[标签名称], ',') AS 地址标签,
  -- 智能备注拼接：单行显示备注内容，多行显示"标签名：备注内容"
  CASE
  -- 当只有一条有效备注时，只显示备注内容
    WHEN SUM(
      CASE
        WHEN tag.[标签名称] IS NOT NULL
        AND tag.[备注] IS NOT NULL
        AND LTRIM(RTRIM(tag.[标签名称])) != ''
        AND LTRIM(RTRIM(tag.[备注])) != '' THEN 1
        ELSE 0
      END
    ) = 1 THEN MAX(
      CASE
        WHEN tag.[标签名称] IS NOT NULL
        AND tag.[备注] IS NOT NULL
        AND LTRIM(RTRIM(tag.[标签名称])) != ''
        AND LTRIM(RTRIM(tag.[备注])) != '' THEN tag.[备注]
        ELSE NULL
      END
    )
    -- 当有多条有效备注时，显示"标签名：备注内容"格式
    WHEN SUM(
      CASE
        WHEN tag.[标签名称] IS NOT NULL
        AND tag.[备注] IS NOT NULL
        AND LTRIM(RTRIM(tag.[标签名称])) != ''
        AND LTRIM(RTRIM(tag.[备注])) != '' THEN 1
        ELSE 0
      END
    ) > 1 THEN STRING_AGG(
      CASE
        WHEN tag.[标签名称] IS NOT NULL
        AND tag.[备注] IS NOT NULL
        AND LTRIM(RTRIM(tag.[标签名称])) != ''
        AND LTRIM(RTRIM(tag.[备注])) != '' THEN concat(tag.[标签名称], '：', tag.[备注])
        ELSE NULL
      END,
      CHAR(13) + CHAR(10) + CHAR(13) + CHAR(10)
    )
    ELSE NULL
  END AS 备注拼接,
  dz.FGC_Creator,
  dz.FGC_CreateDate,
  dz.FGC_LastModifier,
  dz.FGC_LastModifyDate,
  dz.FGC_Rowversion,
  dz.FGC_UpdateHelp
FROM
  [地址池] dz
  LEFT JOIN [地址标签] tag ON dz.ID = tag.[地址ID]
GROUP BY
  dz.ID,
  dz.地址名称,
  dz.完整地址,
  dz.国家,
  dz.省份,
  dz.城市,
  dz.区县,
  dz.乡镇,
  dz.社区,
  dz.楼栋号,
  dz.单元号,
  dz.层号,
  dz.房间号,
  dz.经度,
  dz.纬度,
  dz.FGC_Creator,
  dz.FGC_CreateDate,
  dz.FGC_LastModifier,
  dz.FGC_LastModifyDate,
  dz.FGC_Rowversion,
  dz.FGC_UpdateHelp;
