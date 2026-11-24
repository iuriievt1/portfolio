CREATE TABLE device_group (
	id             uuid         PRIMARY KEY,
	code           text         NOT NULL UNIQUE CHECK (length(code) BETWEEN 1 AND 100),
	name           text         NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
	login_methods  jsonb        NOT NULL DEFAULT '{}'::jsonb,
	created_at     timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE device
	ADD COLUMN hw_id                     text     NOT NULL UNIQUE,
	ADD COLUMN model                     text     NOT NULL CHECK (length(model) BETWEEN 1 AND 128),
	ADD COLUMN os_version                text     NOT NULL CHECK (length(os_version) BETWEEN 1 AND 64),
	ADD COLUMN platform                  text     NOT NULL CHECK (platform IN ('ios', 'android')),
	ADD COLUMN secure_hardware           text     NOT NULL CHECK (secure_hardware IN ('secure_enclave', 'strongbox', 'keystore', 'unknown')),
	ADD COLUMN managed_configuration     boolean  NOT NULL,
	ADD COLUMN group_code                text     REFERENCES device_group (code),
	ADD COLUMN last_contact_at           timestamptz,
	ADD COLUMN login_methods             jsonb    NOT NULL DEFAULT '{}'::jsonb,
	ADD COLUMN blocked_predecessor_hw_id text;

CREATE INDEX device_state_idx ON device (state, registered_at DESC);
CREATE INDEX device_group_idx ON device (group_code) WHERE group_code IS NOT NULL;

REVOKE ALL ON TABLE device_group FROM vulna_api, vulna_worker;
GRANT SELECT, INSERT, UPDATE ON TABLE device_group TO vulna_api;

REVOKE ALL ON TABLE device FROM vulna_api, vulna_worker;
GRANT SELECT, INSERT, UPDATE ON TABLE device TO vulna_api;
GRANT SELECT ON TABLE device TO vulna_worker;

REVOKE ALL ON TABLE session, dpop_jti FROM vulna_api, vulna_worker;
GRANT SELECT, INSERT, DELETE ON TABLE session TO vulna_api;
GRANT SELECT, INSERT, DELETE ON TABLE dpop_jti TO vulna_api;
