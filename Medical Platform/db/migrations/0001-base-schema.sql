-- Base schema ✓ ADR-021, docs/spec/datovy-model.md.
--
-- Table and column names are the ones docs/spec/datovy-model.md owns; they are English ✓ ADR-037.
-- The table of users is `app_user` because `user` is reserved in PostgreSQL. Older decision
-- records cite the former Czech names; docs/spec/slovnik.md translates them.
--
-- Migrations are additive by preference: new columns and tables are added, old ones are removed
-- only in a later release ✓ ADR-021. A migration carries no data — code lists are loaded at
-- installation time ✓ NAB-529, ADR-023.

-- --------------------------------------------------------------------------------------------
-- Identity and access
-- --------------------------------------------------------------------------------------------

CREATE TABLE app_user (
	id           uuid         PRIMARY KEY,
	given_name   text         NOT NULL,
	family_name  text         NOT NULL,
	is_active    boolean      NOT NULL DEFAULT true,
	created_at   timestamptz  NOT NULL DEFAULT now()
);

-- Device states ✓ docs/spec/datovy-model.md kap. 4: `pending_approval`, `approved`, `revoked`, `blocked`.
CREATE TABLE device (
	id              uuid         PRIMARY KEY,
	state           text         NOT NULL CHECK (state IN ('pending_approval', 'approved', 'revoked', 'blocked')),
	-- The public part of the ECDSA P-256 registration key pair is the HW ID ✓ NAB-517, ADR-013.
	public_key_jwk  jsonb        NOT NULL,
	registered_at   timestamptz  NOT NULL DEFAULT now()
);

-- An opaque session token kept in the server database ✓ ADR-013.
-- The token carries no content and is checked by a query, so revocation takes effect immediately
-- ✓ NAB-278, NAB-504.
CREATE TABLE session (
	id          uuid         PRIMARY KEY,
	user_id     uuid         REFERENCES app_user (id),
	device_id   uuid         NOT NULL REFERENCES device (id),
	token_hash  text         NOT NULL UNIQUE,
	expires_at  timestamptz  NOT NULL,
	created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX session_device_idx ON session (device_id, expires_at DESC);

-- Consumed DPoP `jti` values, kept for the clock-skew tolerance window (60 s) ✓ ADR-013.
CREATE TABLE dpop_jti (
	jti          text         PRIMARY KEY,
	device_id    uuid         NOT NULL REFERENCES device (id),
	consumed_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX dpop_jti_consumed_at_idx ON dpop_jti (consumed_at);

-- --------------------------------------------------------------------------------------------
-- Documentation
-- --------------------------------------------------------------------------------------------

CREATE TABLE finding (
	id          uuid         PRIMARY KEY,
	created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE acquisition (
	id               uuid         PRIMARY KEY,
	finding_id       uuid         NOT NULL REFERENCES finding (id),
	device_id        uuid         NOT NULL REFERENCES device (id),
	state            text         NOT NULL CHECK (state IN ('waiting_for_files', 'received', 'assembling', 'delivered', 'failed')),
	-- An identifier created on the device; unique within the scope of one device ✓ ADR-012 ř. 60–64.
	idempotency_key  text         NOT NULL,
	received_at      timestamptz  NOT NULL DEFAULT now(),
	CONSTRAINT acquisition_idempotency_uniq UNIQUE (device_id, idempotency_key)
);

-- Cursor pagination requires a stable ordering ✓ ADR-012 „Důsledky“.
CREATE INDEX acquisition_finding_cursor_idx ON acquisition (finding_id, received_at DESC, id DESC);

-- --------------------------------------------------------------------------------------------
-- Delivery and queue
-- --------------------------------------------------------------------------------------------

CREATE TABLE artifact (
	id                    uuid  PRIMARY KEY,
	acquisition_id        uuid  NOT NULL REFERENCES acquisition (id),
	sop_class_uid         text  NOT NULL,
	sop_instance_uid      text  NOT NULL UNIQUE,
	binary_store_key      text  NOT NULL,
	-- Prepared for corrections; never filled in v1 ✓ ADR-004 ř. 21, ADR-006 (rejected).
	replaces_artifact_id  uuid  REFERENCES artifact (id)
);

-- Two levels ✓ Q-065: `delivery` per (acquisition, target), subordinate `delivery_instance` per artifact.
CREATE TABLE delivery (
	id              uuid         PRIMARY KEY,
	acquisition_id  uuid         NOT NULL REFERENCES acquisition (id),
	target          text         NOT NULL,
	-- The parent row carries the assembly state; delivery states live on `delivery_instance` ✓ CAP-022-R11.
	state           text         NOT NULL CHECK (state IN ('waiting_for_assembly', 'assembled', 'assembly_failed')),
	created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE delivery_instance (
	id                    uuid  PRIMARY KEY,
	delivery_id           uuid  NOT NULL REFERENCES delivery (id),
	artifact_id           uuid  NOT NULL REFERENCES artifact (id),
	state                 text  NOT NULL CHECK (state IN (
		'waiting', 'sending', 'pending_verification', 'confirmed', 'temporarily_failed', 'permanently_failed', 'clinical_safety'
	)),
	last_dimse_status     text,
	-- The retention anchor is created by a successful C-STORE, one per instance ✓ ADR-005 ř. 34, CAP-026-R03.
	retention_anchor      timestamptz
);

-- A queue over PostgreSQL with no additional service ✓ ADR-016, ADR-005 ř. 43.
CREATE TABLE queue_task (
	id          uuid         PRIMARY KEY,
	kind        text         NOT NULL CHECK (kind IN ('assembly', 'delivery')),
	object_id   uuid         NOT NULL,
	state       text         NOT NULL CHECK (state IN ('waiting', 'running', 'done', 'failed')),
	attempts    integer      NOT NULL DEFAULT 0,
	run_after   timestamptz  NOT NULL DEFAULT now(),
	created_at  timestamptz  NOT NULL DEFAULT now()
);

-- Index for SELECT … FOR UPDATE SKIP LOCKED ✓ ADR-016.
CREATE INDEX queue_task_selection_idx ON queue_task (kind, state, run_after);

-- --------------------------------------------------------------------------------------------
-- Audit trail
-- --------------------------------------------------------------------------------------------

-- Written APPEND-ONLY ✓ NAB-432. Application roles get neither UPDATE nor DELETE ✓ NAB-433,
-- ADR-005 ř. 42; the restriction lives in the database privileges, not in the code ✓ ADR-021.
-- No role gets DELETE ✓ Q-066 — the configured period is the minimum guaranteed retention and
-- records are never deleted ✓ CAP-025-R02, CAP-025-R05.
CREATE TABLE audit (
	id           uuid         PRIMARY KEY,
	occurred_at  timestamptz  NOT NULL DEFAULT now(),
	event_type   text         NOT NULL,
	user_id      uuid,
	device_id    uuid,
	object_id    uuid,
	outcome      text         NOT NULL CHECK (outcome IN ('success', 'failure')),
	details      jsonb        NOT NULL DEFAULT '{}'::jsonb,
	exported_at  timestamptz
);

CREATE INDEX audit_occurred_at_idx ON audit (occurred_at);
CREATE INDEX audit_pending_export_idx ON audit (exported_at) WHERE exported_at IS NULL;

-- append-only, NAB-433
REVOKE ALL ON TABLE audit FROM vulna_api, vulna_worker;
GRANT SELECT, INSERT ON TABLE audit TO vulna_api, vulna_worker;
