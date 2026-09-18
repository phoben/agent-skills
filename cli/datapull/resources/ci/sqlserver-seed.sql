CREATE SCHEMA datapull_ci;
GO

CREATE TYPE datapull_ci.code_type FROM nvarchar(32) NOT NULL;
GO

CREATE SEQUENCE datapull_ci.item_sequence
  AS bigint
  START WITH 100
  INCREMENT BY 1;
GO

CREATE TABLE datapull_ci.item (
  id bigint NOT NULL CONSTRAINT df_datapull_ci_item_id DEFAULT NEXT VALUE FOR datapull_ci.item_sequence,
  code datapull_ci.code_type,
  payload nvarchar(255) NULL,
  CONSTRAINT pk_datapull_ci_item PRIMARY KEY (id),
  CONSTRAINT uq_datapull_ci_item_code UNIQUE (code)
);
GO

INSERT INTO datapull_ci.item (code, payload)
VALUES (N'seed', N'DATAPULL_BUSINESS_DATA_MUST_NOT_APPEAR');
GO

CREATE VIEW datapull_ci.item_view
AS
SELECT id, code FROM datapull_ci.item;
GO

CREATE FUNCTION datapull_ci.echo (@input_value int)
RETURNS int
AS
BEGIN
  RETURN @input_value;
END;
GO

CREATE PROCEDURE datapull_ci.item_count
AS
BEGIN
  SET NOCOUNT ON;
  SELECT COUNT_BIG(*) AS item_count FROM datapull_ci.item;
END;
GO

CREATE TRIGGER datapull_ci.item_after_insert
ON datapull_ci.item
AFTER INSERT
AS
BEGIN
  SET NOCOUNT ON;
END;
GO

CREATE SYNONYM datapull_ci.item_synonym FOR datapull_ci.item;
GO
