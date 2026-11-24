ALTER TABLE app_user
	ADD COLUMN personal_number     text     CHECK (length(personal_number) BETWEEN 1 AND 128),
	ADD COLUMN display_name        text     NOT NULL DEFAULT '' CHECK (length(display_name) <= 256),
	ADD COLUMN preferred_language  text     CHECK (preferred_language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$');

CREATE UNIQUE INDEX app_user_personal_number_uniq ON app_user (personal_number) WHERE personal_number IS NOT NULL;

CREATE TABLE user_idp_identity (
	id                     uuid         PRIMARY KEY,
	user_id                uuid         NOT NULL REFERENCES app_user (id),
	issuer                 text         NOT NULL,
	subject                text         NOT NULL,
	refresh_token          text,
	groups                 jsonb        NOT NULL DEFAULT '[]'::jsonb,
	last_authenticated_at  timestamptz  NOT NULL,
	created_at             timestamptz  NOT NULL DEFAULT now(),
	CONSTRAINT user_idp_identity_subject_uniq UNIQUE (issuer, subject)
);

CREATE INDEX user_idp_identity_user_idx ON user_idp_identity (user_id);

CREATE TABLE user_role (
	user_id      uuid         NOT NULL REFERENCES app_user (id),
	role         text         NOT NULL CHECK (role IN ('clinician', 'administrator')),
	origin       text         NOT NULL CHECK (origin IN ('group', 'manual')),
	assigned_at  timestamptz  NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, role, origin)
);

CREATE TABLE oidc_login_flow (
	state                     text         PRIMARY KEY,
	device_id                 uuid         NOT NULL REFERENCES device (id),
	device_key_thumbprint     text         NOT NULL,
	code_verifier             text         NOT NULL,
	nonce                     text         NOT NULL,
	expected_personal_number  text,
	started_at                timestamptz  NOT NULL DEFAULT now(),
	expires_at                timestamptz  NOT NULL,
	returned_at               timestamptz,
	outcome                   jsonb,
	completion_code_hash      text         UNIQUE,
	completion_expires_at     timestamptz,
	consumed_at               timestamptz
);

CREATE INDEX oidc_login_flow_expires_idx ON oidc_login_flow (expires_at);

CREATE TABLE login_challenge (
	id           uuid         PRIMARY KEY,
	device_id    uuid         NOT NULL REFERENCES device (id),
	value_hash   text         NOT NULL,
	issued_at    timestamptz  NOT NULL DEFAULT now(),
	expires_at   timestamptz  NOT NULL,
	consumed_at  timestamptz
);

CREATE INDEX login_challenge_expires_idx ON login_challenge (expires_at);

ALTER TABLE session
	ADD COLUMN session_end      timestamptz,
	ADD COLUMN ended_at         timestamptz,
	ADD COLUMN end_reason       text CHECK (end_reason IN (
		'logout', 'expired', 'replaced', 'attempts_exhausted', 'provider_rejected', 'user_revoked', 'device_revoked'
	)),
	ADD COLUMN token_issued_at  timestamptz  NOT NULL DEFAULT now(),
	ADD CONSTRAINT session_end_matches_kind CHECK ((user_id IS NULL) = (session_end IS NULL)),
	ADD CONSTRAINT session_end_reason_with_time CHECK ((ended_at IS NULL) = (end_reason IS NULL));

CREATE UNIQUE INDEX session_active_user_uniq ON session (device_id) WHERE user_id IS NOT NULL AND ended_at IS NULL;
CREATE INDEX session_user_started_idx ON session (user_id, created_at) WHERE user_id IS NOT NULL;

CREATE TABLE login_attempt (
	id            uuid         PRIMARY KEY,
	attempted_at  timestamptz  NOT NULL DEFAULT now(),
	device_id     uuid         NOT NULL REFERENCES device (id),
	user_id       uuid         REFERENCES app_user (id),
	method        text         NOT NULL CHECK (method IN ('oidc', 'card', 'qr', 'pin')),
	outcome       text         NOT NULL CHECK (outcome IN ('success', 'failure')),
	reason        text,
	session_id    uuid         REFERENCES session (id)
);

CREATE INDEX login_attempt_user_device_idx ON login_attempt (user_id, device_id, attempted_at DESC);

CREATE TABLE user_device_credential (
	user_id             uuid         NOT NULL REFERENCES app_user (id),
	device_id           uuid         NOT NULL REFERENCES device (id),
	pin_public_key      jsonb,
	pin_set_at          timestamptz,
	blocked_at          timestamptz,
	last_full_login_at  timestamptz,
	PRIMARY KEY (user_id, device_id),
	CONSTRAINT user_device_credential_pin_key_with_time CHECK ((pin_public_key IS NULL) = (pin_set_at IS NULL))
);

CREATE TABLE card (
	id                  uuid         PRIMARY KEY,
	user_id             uuid         NOT NULL REFERENCES app_user (id),
	identifier_hash     text         NOT NULL,
	short_uid           text         NOT NULL CHECK (length(short_uid) BETWEEN 1 AND 32),
	binding_origin      text         NOT NULL CHECK (binding_origin IN ('device_with_code')),
	bound_by_device_id  uuid         NOT NULL REFERENCES device (id),
	bound_at            timestamptz  NOT NULL DEFAULT now(),
	revoked_at          timestamptz,
	revoked_by_user_id  uuid         REFERENCES app_user (id)
);

CREATE UNIQUE INDEX card_valid_identifier_uniq ON card (identifier_hash) WHERE revoked_at IS NULL;
CREATE INDEX card_user_idx ON card (user_id);

CREATE TABLE card_binding_code (
	code_hash              text         PRIMARY KEY,
	user_id                uuid         NOT NULL REFERENCES app_user (id),
	issued_by_user_id      uuid         REFERENCES app_user (id),
	issued_at              timestamptz  NOT NULL DEFAULT now(),
	expires_at             timestamptz  NOT NULL,
	consumed_at            timestamptz,
	consumed_by_device_id  uuid         REFERENCES device (id)
);

CREATE INDEX card_binding_code_open_idx ON card_binding_code (user_id) WHERE consumed_at IS NULL;

CREATE TABLE revoked_card_identifier (
	identifier_hash     text         PRIMARY KEY,
	revoked_at          timestamptz  NOT NULL DEFAULT now(),
	revoked_by_user_id  uuid         REFERENCES app_user (id)
);

CREATE TABLE qr_code (
	id                  uuid         PRIMARY KEY,
	user_id             uuid         NOT NULL REFERENCES app_user (id),
	identifier          text         NOT NULL UNIQUE,
	key_version         integer      NOT NULL CHECK (key_version >= 0),
	issued_at           timestamptz  NOT NULL DEFAULT now(),
	issued_by_user_id   uuid         REFERENCES app_user (id),
	revoked_at          timestamptz,
	revoked_by_user_id  uuid         REFERENCES app_user (id)
);

CREATE INDEX qr_code_user_idx ON qr_code (user_id);

REVOKE ALL ON TABLE user_idp_identity, user_role, user_device_credential, card, card_binding_code,
	revoked_card_identifier, qr_code, oidc_login_flow, login_challenge, login_attempt FROM vulna_api, vulna_worker;
GRANT SELECT, INSERT, UPDATE ON TABLE user_idp_identity, user_device_credential, card, card_binding_code,
	revoked_card_identifier, qr_code TO vulna_api;
GRANT SELECT, INSERT, DELETE ON TABLE user_role TO vulna_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE oidc_login_flow, login_challenge TO vulna_api;
GRANT SELECT, INSERT ON TABLE login_attempt TO vulna_api;

GRANT UPDATE ON TABLE session TO vulna_api;
