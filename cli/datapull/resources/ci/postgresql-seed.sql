CREATE SCHEMA datapull_ci;
CREATE SCHEMA datapull_ci_ext;
CREATE EXTENSION hstore WITH SCHEMA datapull_ci_ext;

CREATE TYPE datapull_ci.item_state AS ENUM ('active', 'disabled');
CREATE DOMAIN datapull_ci.item_code AS text
  CONSTRAINT item_code_not_blank CHECK (length(VALUE) > 0);
CREATE TYPE datapull_ci.item_pair AS (left_value integer, right_value integer);
CREATE TYPE datapull_ci.item_range AS RANGE (subtype = integer);
CREATE SEQUENCE datapull_ci.item_sequence START WITH 100;

CREATE TABLE datapull_ci.item (
  id bigint PRIMARY KEY DEFAULT nextval('datapull_ci.item_sequence'),
  code datapull_ci.item_code NOT NULL,
  state datapull_ci.item_state NOT NULL DEFAULT 'active',
  payload text
);

INSERT INTO datapull_ci.item (code, payload)
VALUES ('seed', 'DATAPULL_BUSINESS_DATA_MUST_NOT_APPEAR');

CREATE VIEW datapull_ci.item_view AS
SELECT id, code, state FROM datapull_ci.item;

CREATE MATERIALIZED VIEW datapull_ci.item_materialized_view AS
SELECT state, count(*) AS item_count FROM datapull_ci.item GROUP BY state;

CREATE FUNCTION datapull_ci.echo(input_value integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT input_value $$;

CREATE PROCEDURE datapull_ci.noop()
LANGUAGE plpgsql
AS $$ BEGIN NULL; END $$;

CREATE FUNCTION datapull_ci.normalize_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$ BEGIN NEW.code := btrim(NEW.code); RETURN NEW; END $$;

CREATE TRIGGER item_before_insert
BEFORE INSERT ON datapull_ci.item
FOR EACH ROW EXECUTE FUNCTION datapull_ci.normalize_code();
