-- CAP-020-R23, CAP-021-R15, CAP-020-R20, CAP-016-R17, clinical-workflow.yaml Finding.number, datovy-model.md 3
ALTER TABLE patient_cache ADD COLUMN last_wound_number integer NOT NULL DEFAULT 0 CHECK (last_wound_number >= 0);

ALTER TABLE finding
	ADD COLUMN wound_number integer CHECK (wound_number >= 1),
	ADD CONSTRAINT finding_wound_number_uniq UNIQUE (patient_id, wound_number);

WITH first_closed AS (
	SELECT finding.id, finding.patient_id, min(acquisition.closed_at) AS closed_at
	FROM finding
	JOIN acquisition ON acquisition.finding_id = finding.id AND acquisition.state <> 'draft'
	GROUP BY finding.id, finding.patient_id
),
numbered AS (
	SELECT id, row_number() OVER (PARTITION BY patient_id ORDER BY closed_at, id) AS number FROM first_closed
)
UPDATE finding SET wound_number = numbered.number
FROM numbered
WHERE finding.id = numbered.id;

UPDATE patient_cache SET last_wound_number = numbered.last_number
FROM (SELECT patient_id, max(wound_number) AS last_number FROM finding GROUP BY patient_id) AS numbered
WHERE patient_cache.id = numbered.patient_id AND numbered.last_number IS NOT NULL;

CREATE FUNCTION finding_number_on_first_closure() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	patient uuid;
	number integer;
BEGIN
	SELECT patient_id INTO patient FROM finding WHERE id = NEW.finding_id AND wound_number IS NULL FOR UPDATE;
	IF NOT FOUND THEN
		RETURN NULL;
	END IF;
	UPDATE patient_cache SET last_wound_number = last_wound_number + 1
	WHERE id = patient
	RETURNING last_wound_number INTO number;
	UPDATE finding SET wound_number = number WHERE id = NEW.finding_id;
	RETURN NULL;
END;
$$;

CREATE TRIGGER acquisition_numbers_wound
	AFTER INSERT OR UPDATE OF state, finding_id ON acquisition
	FOR EACH ROW WHEN (NEW.finding_id IS NOT NULL AND NEW.state <> 'draft')
	EXECUTE FUNCTION finding_number_on_first_closure();

CREATE TRIGGER finding_wound_number_unchanged
	BEFORE UPDATE OF wound_number, patient_id ON finding
	FOR EACH ROW WHEN (
		(OLD.wound_number IS NOT NULL AND OLD.wound_number IS DISTINCT FROM NEW.wound_number)
		OR OLD.patient_id IS DISTINCT FROM NEW.patient_id
	)
	EXECUTE FUNCTION assigned_number_reject_change();

CREATE TRIGGER patient_cache_wound_number_unchanged
	BEFORE UPDATE OF last_wound_number ON patient_cache
	FOR EACH ROW WHEN (NEW.last_wound_number < OLD.last_wound_number)
	EXECUTE FUNCTION assigned_number_reject_change();

-- ADR-021
GRANT UPDATE (last_wound_number) ON TABLE patient_cache TO vulna_api;
