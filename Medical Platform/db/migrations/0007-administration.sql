CREATE INDEX app_user_display_name_idx ON app_user (display_name, id);

-- no device, CAP-004-R05
CREATE TABLE administration_login_flow (
	state          text         PRIMARY KEY,
	code_verifier  text         NOT NULL,
	nonce          text         NOT NULL,
	started_at     timestamptz  NOT NULL,
	expires_at     timestamptz  NOT NULL,
	consumed_at    timestamptz
);

CREATE INDEX administration_login_flow_expires_idx ON administration_login_flow (expires_at);

CREATE TABLE administration_session (
	id                uuid         PRIMARY KEY,
	user_id           uuid         NOT NULL REFERENCES app_user (id),
	token_hash        text         NOT NULL UNIQUE,
	created_at        timestamptz  NOT NULL,
	last_activity_at  timestamptz  NOT NULL,
	expires_at        timestamptz  NOT NULL,
	ended_at          timestamptz,
	end_reason        text         CHECK (end_reason IN ('logout', 'idle', 'expired', 'access_revoked')),
	CONSTRAINT administration_session_end_reason_with_time CHECK ((ended_at IS NULL) = (end_reason IS NULL))
);

REVOKE ALL ON TABLE administration_login_flow, administration_session FROM vulna_api, vulna_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE administration_login_flow TO vulna_api;
GRANT SELECT, INSERT, UPDATE ON TABLE administration_session TO vulna_api;
