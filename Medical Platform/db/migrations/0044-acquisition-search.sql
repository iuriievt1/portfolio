-- CAP-003-R13, CAP-029-R33
ALTER TABLE role_permission DROP CONSTRAINT role_permission_permission_check;
ALTER TABLE role_permission ADD CONSTRAINT role_permission_permission_check CHECK (permission IN (
	'administration.access',
	'users.manage',
	'credentials.manage',
	'devices.manage',
	'configuration.manage',
	'audit.read',
	'audit.export',
	'monitoring.manage',
	'drafts.manage',
	'acquisitions.read'
));

-- CAP-003-R02, CAP-004-R10
INSERT INTO role_permission (role_code, permission) VALUES ('administrator', 'acquisitions.read');

-- CAP-004-R10, administration.yaml searchAcquisitions, ADR-012
CREATE INDEX acquisition_started_idx ON acquisition (started_at DESC, id DESC);
CREATE INDEX acquisition_patient_started_idx ON acquisition (patient_id, started_at DESC, id DESC);
CREATE INDEX patient_identifier_value_idx ON patient_identifier ((translate(value, ' /', '')))
	WHERE valid_until IS NULL;
