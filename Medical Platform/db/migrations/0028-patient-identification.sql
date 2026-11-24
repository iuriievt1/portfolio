-- CHG-175, CAP-013-R10, CAP-024-R13
ALTER TABLE patient_cache ALTER COLUMN family_name DROP NOT NULL;

ALTER TABLE patient_cache DROP CONSTRAINT patient_cache_origin_check;
ALTER TABLE patient_cache ADD CONSTRAINT patient_cache_origin_check
	CHECK (origin IN ('registry', 'documented_by_vulna', 'created_in_app'));

-- CAP-025-R18, CHG-175
ALTER TABLE audit DROP CONSTRAINT audit_outcome_check;
ALTER TABLE audit ADD CONSTRAINT audit_outcome_check CHECK (outcome IN (
	'success',
	'failure',
	'match',
	'no_match',
	'query_too_short',
	'too_many_matches',
	'rate_limited',
	'released',
	'completed',
	'rejected',
	'created'
));

-- ADR-021
GRANT INSERT ON TABLE patient_cache, patient_identifier TO vulna_api;
