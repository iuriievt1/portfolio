-- CAP-025-R04
ALTER TABLE audit ADD COLUMN source_address text CHECK (source_address IS NULL OR length(source_address) BETWEEN 1 AND 64);

-- CAP-025-R07, administration.yaml searchAudit
CREATE INDEX audit_event_type_idx ON audit (event_type, sequence);
CREATE INDEX audit_actor_user_idx ON audit (actor_user_id, sequence) WHERE actor_user_id IS NOT NULL;
CREATE INDEX audit_actor_device_idx ON audit (actor_device_id, sequence) WHERE actor_device_id IS NOT NULL;

-- CAP-025-R09, datovy-model.md 8
CREATE TABLE audit_export_cursor (
	id                 smallint     PRIMARY KEY CHECK (id = 1),
	exported_sequence  bigint       NOT NULL DEFAULT 0 CHECK (exported_sequence >= 0),
	exported_at        timestamptz,
	attempted_at       timestamptz,
	failing_since      timestamptz,
	last_failure       text         CHECK (last_failure IN ('unreachable', 'timed_out', 'tls_rejected', 'message_too_large', 'failed'))
);

INSERT INTO audit_export_cursor (id) VALUES (1);

REVOKE ALL ON TABLE audit_export_cursor FROM PUBLIC, vulna_api, vulna_worker;
GRANT SELECT, UPDATE ON TABLE audit_export_cursor TO vulna_worker;
GRANT SELECT ON TABLE audit_export_cursor TO vulna_api;

-- NAB-351, NAB-442
CREATE TABLE audit_export (
	id              uuid         PRIMARY KEY,
	requested_by    uuid         NOT NULL REFERENCES app_user (id),
	requested_at    timestamptz  NOT NULL,
	from_time       timestamptz,
	to_time         timestamptz,
	event_type      text         CHECK (event_type IS NULL OR length(event_type) BETWEEN 1 AND 100),
	until_sequence  bigint       NOT NULL CHECK (until_sequence >= 0)
);

REVOKE ALL ON TABLE audit_export FROM PUBLIC, vulna_api, vulna_worker;
GRANT SELECT, INSERT ON TABLE audit_export TO vulna_api;

-- CAP-003-R13, CAP-029-R33
ALTER TABLE role_permission DROP CONSTRAINT role_permission_permission_check;
ALTER TABLE role_permission ADD CONSTRAINT role_permission_permission_check CHECK (permission IN (
	'administration.access',
	'users.manage',
	'credentials.manage',
	'devices.manage',
	'configuration.manage',
	'audit.read',
	'audit.export'
));

-- CAP-003-R02
INSERT INTO role_permission (role_code, permission) VALUES
	('administrator', 'audit.read'),
	('administrator', 'audit.export');
