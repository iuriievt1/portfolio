-- datovy-model.md 2, 4, 11, CAP-015-R30, CAP-014-R06, CAP-021-R32, CAP-029-R32
DROP TABLE delivery_instance;
DROP TABLE delivery;
DROP TABLE artifact;
DROP TABLE acquisition;

-- CAP-014-R26
ALTER TABLE encounter ADD CONSTRAINT encounter_id_patient_uniq UNIQUE (id, patient_id);
-- ADR-050 bod 10, CAP-014-R29
ALTER TABLE encounter ADD COLUMN status_changed_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE acquisition (
	id                        uuid         PRIMARY KEY,
	-- CAP-021-R08, CAP-021-R29
	idempotency_key           uuid         NOT NULL UNIQUE,
	patient_id                uuid         NOT NULL REFERENCES patient_cache (id) ON DELETE RESTRICT,
	encounter_id              uuid         NOT NULL,
	finding_id                uuid         REFERENCES finding (id),
	kind                      text         NOT NULL CHECK (kind IN ('photo', 'scan')),
	state                     text         NOT NULL CHECK (state IN (
		'draft', 'received', 'assembling', 'delivered', 'failed', 'closed_by_administrator'
	)),
	-- CAP-021-R13
	operator_user_id          uuid         NOT NULL REFERENCES app_user (id),
	-- CAP-020-R04
	department_id             uuid         REFERENCES department (id),
	-- CAP-012-R19
	configuration_version_id  integer      NOT NULL REFERENCES configuration_version (id),
	started_at                timestamptz  NOT NULL,
	closed_at                 timestamptz,
	file_count                integer      CHECK (file_count >= 1),
	version                   integer      NOT NULL DEFAULT 1 CHECK (version >= 1),
	created_at                timestamptz  NOT NULL DEFAULT now(),
	updated_at                timestamptz  NOT NULL DEFAULT now(),
	-- CAP-014-R26
	FOREIGN KEY (encounter_id, patient_id) REFERENCES encounter (id, patient_id) ON DELETE RESTRICT,
	-- CAP-015-R30
	CHECK ((state = 'draft') = (closed_at IS NULL)),
	-- CAP-021-R25
	CHECK (closed_at IS NULL OR file_count IS NOT NULL)
);
-- CAP-015-R18, CAP-015-R29
CREATE INDEX acquisition_draft_operator_idx ON acquisition (operator_user_id, updated_at DESC, id DESC) WHERE state = 'draft';
-- CAP-014-R19, CAP-014-R22
CREATE INDEX acquisition_encounter_idx ON acquisition (encounter_id, updated_at DESC, id DESC);
-- CAP-020-R04, CAP-020-R16
CREATE INDEX acquisition_department_closed_idx ON acquisition (department_id, closed_at);

CREATE TABLE artifact (
	id                    uuid  PRIMARY KEY,
	acquisition_id        uuid  NOT NULL REFERENCES acquisition (id),
	sop_class_uid         text  NOT NULL,
	sop_instance_uid      text  NOT NULL UNIQUE,
	binary_store_key      text  NOT NULL,
	replaces_artifact_id  uuid  REFERENCES artifact (id)
);

CREATE TABLE delivery (
	id              uuid         PRIMARY KEY,
	acquisition_id  uuid         NOT NULL REFERENCES acquisition (id),
	target          text         NOT NULL,
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
	retention_anchor      timestamptz
);

-- datovy-model.md 13.2, ADR-050 bod 3, ADR-050 bod 11
CREATE TABLE fhir_resource_link (
	resource_type  text         NOT NULL CHECK (length(resource_type) BETWEEN 1 AND 64),
	local_kind     text         NOT NULL CHECK (length(local_kind) BETWEEN 1 AND 64),
	local_id       text         NOT NULL CHECK (length(local_id) BETWEEN 1 AND 255),
	resource_id    text         NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 64),
	written_at     timestamptz  NOT NULL DEFAULT now(),
	PRIMARY KEY (local_kind, local_id, resource_type)
);

-- CAP-025-R27, CAP-025-R28
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
	'rejected'
));

-- CAP-014-R06, CAP-014-R20
GRANT SELECT, INSERT, UPDATE ON TABLE encounter TO vulna_api;
