-- datovy-model.md 4 „Upozornění správce“, CAP-028-R15, CAP-021-R27
CREATE TABLE administrator_alert (
	id             uuid         PRIMARY KEY,
	kind           text         NOT NULL CHECK (kind IN ('clinical_record_write_failed')),
	raised_at      timestamptz  NOT NULL DEFAULT now(),
	resolved_at    timestamptz,
	message        text         NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
	queue_task_id  uuid         REFERENCES queue_task (id),
	CONSTRAINT administrator_alert_task_check CHECK (kind <> 'clinical_record_write_failed' OR queue_task_id IS NOT NULL)
);

-- administration.yaml listAdministratorAlerts, ADR-012
CREATE INDEX administrator_alert_listing_idx ON administrator_alert (raised_at DESC, id DESC);

-- CAP-021-R27
CREATE UNIQUE INDEX administrator_alert_active_task_uniq ON administrator_alert (queue_task_id) WHERE resolved_at IS NULL;

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
	'monitoring.manage'
));

-- CAP-003-R02, CAP-021-R27
INSERT INTO role_permission (role_code, permission) VALUES ('administrator', 'monitoring.manage');
