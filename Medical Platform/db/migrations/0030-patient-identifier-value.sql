-- CHG-177, CAP-013-R10, DICOM PS3.5 6.2
ALTER TABLE patient_identifier DROP CONSTRAINT patient_identifier_value_check;
ALTER TABLE patient_identifier ADD CONSTRAINT patient_identifier_value_check
	CHECK (length(value) BETWEEN 1 AND 64 AND value !~ '[\\\x01-\x1f\x7f-\x9f]');
