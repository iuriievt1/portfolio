-- integrace-dicom.md 5.2, datovy-model.md 3
ALTER TABLE encounter
	ADD COLUMN study_id text CHECK (study_id ~ '^[0-9]{4}-[0-9]{6,11}$'),
	ADD CONSTRAINT encounter_study_id_uniq UNIQUE (study_id);

CREATE SEQUENCE encounter_study_number AS bigint MINVALUE 1 MAXVALUE 99999999999 OWNED BY encounter.study_id;

CREATE FUNCTION study_id_of(day date, number bigint) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
	SELECT lpad(year, greatest(4, length(year)), '0') || '-' || lpad(number::text, greatest(6, length(number::text)), '0')
	FROM (SELECT extract(year FROM day)::integer::text AS year) AS visit_day
$$;

WITH numbered AS (
	SELECT id, date, row_number() OVER (ORDER BY date, created_at, id) AS number FROM encounter
)
UPDATE encounter SET study_id = study_id_of(numbered.date, numbered.number)
FROM numbered
WHERE encounter.id = numbered.id;

SELECT setval('encounter_study_number', greatest(count(*), 1), count(*) > 0) FROM encounter;

ALTER TABLE encounter ALTER COLUMN study_id SET NOT NULL;

CREATE FUNCTION encounter_assign_study_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.study_id IS NULL THEN
		NEW.study_id := study_id_of(NEW.date, nextval('encounter_study_number'));
	END IF;
	RETURN NEW;
END;
$$;

CREATE TRIGGER encounter_study_id
	BEFORE INSERT ON encounter
	FOR EACH ROW EXECUTE FUNCTION encounter_assign_study_id();

CREATE FUNCTION assigned_number_reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'an assigned number of % never changes', TG_TABLE_NAME
		USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER encounter_study_id_unchanged
	BEFORE UPDATE OF study_id ON encounter
	FOR EACH ROW WHEN (OLD.study_id IS DISTINCT FROM NEW.study_id)
	EXECUTE FUNCTION assigned_number_reject_change();

-- ADR-021
GRANT USAGE ON SEQUENCE encounter_study_number TO vulna_api, vulna_worker;
