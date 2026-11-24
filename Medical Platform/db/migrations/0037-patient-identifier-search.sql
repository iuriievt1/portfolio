-- CAP-013-R07, CAP-013-R17, CHG-182, datovy-model.md 7
CREATE INDEX patient_identifier_search_idx
	ON patient_identifier (system, (translate(value, ' /', '')) text_pattern_ops)
	WHERE valid_until IS NULL;
