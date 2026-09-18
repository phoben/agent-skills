CREATE TABLE datapull_ci_item (
  id bigint NOT NULL AUTO_INCREMENT,
  code varchar(32) NOT NULL,
  payload varchar(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_datapull_ci_item_code (code)
);

INSERT INTO datapull_ci_item (code, payload)
VALUES ('seed', 'DATAPULL_BUSINESS_DATA_MUST_NOT_APPEAR');

CREATE VIEW datapull_ci_item_view AS
SELECT id, code FROM datapull_ci_item;

DELIMITER $$

CREATE FUNCTION datapull_ci_echo(input_value int)
RETURNS int
DETERMINISTIC
RETURN input_value$$

CREATE PROCEDURE datapull_ci_count(OUT item_count bigint)
READS SQL DATA
SELECT COUNT(*) INTO item_count FROM datapull_ci_item$$

CREATE TRIGGER datapull_ci_item_before_insert
BEFORE INSERT ON datapull_ci_item
FOR EACH ROW
SET NEW.code = TRIM(NEW.code)$$

CREATE EVENT datapull_ci_daily_event
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP + INTERVAL 1 DAY
DO DELETE FROM datapull_ci_item WHERE id < 0$$

DELIMITER ;
