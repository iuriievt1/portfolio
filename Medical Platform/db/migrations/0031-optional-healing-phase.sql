-- CHG-181, CAP-017-R16, CAP-017-R04
ALTER TABLE assessment ALTER COLUMN healing_phase_code DROP NOT NULL;
ALTER TABLE assessment ALTER COLUMN code_list_version DROP NOT NULL;
ALTER TABLE assessment ADD CONSTRAINT assessment_healing_phase_complete CHECK (
	(healing_phase_code IS NULL) = (code_list_version IS NULL)
);
ALTER TABLE assessment ADD CONSTRAINT assessment_has_content CHECK (
	healing_phase_code IS NOT NULL OR description IS NOT NULL
);
