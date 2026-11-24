-- CAP-024-R01, CAP-024-R12, datovy-model.md 7
CREATE TABLE sync_run (
	id           uuid         PRIMARY KEY,
	started_at   timestamptz  NOT NULL,
	finished_at  timestamptz,
	outcome      text         CHECK (outcome IN ('complete', 'incomplete')),
	-- NAB-347
	failed       boolean      NOT NULL DEFAULT false,
	CHECK ((finished_at IS NULL) = (outcome IS NULL)),
	CHECK (NOT failed OR outcome = 'incomplete')
);

CREATE INDEX sync_run_started_idx ON sync_run (started_at DESC);

-- CAP-024-R13, CAP-013-R07, CAP-013-R17, datovy-model.md 7
CREATE TABLE patient_cache (
	id                     uuid         PRIMARY KEY,
	family_name            text         NOT NULL,
	given_name             text,
	birth_date             date,
	sex                    text         CHECK (sex IN ('male', 'female', 'other')),
	search_text            text         NOT NULL,
	origin                 text         NOT NULL DEFAULT 'registry' CHECK (origin IN ('registry', 'documented_by_vulna')),
	demographics_revision  integer      NOT NULL DEFAULT 1 CHECK (demographics_revision >= 1),
	last_sync_run_id       uuid         REFERENCES sync_run (id),
	created_at             timestamptz  NOT NULL DEFAULT now(),
	updated_at             timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX patient_cache_birth_date_idx ON patient_cache (birth_date);

-- CAP-024-R07, ADR-004 ř. 22, datovy-model.md 3
CREATE TABLE patient_identifier (
	id           uuid         PRIMARY KEY,
	patient_id   uuid         NOT NULL REFERENCES patient_cache (id) ON DELETE CASCADE,
	system       text         NOT NULL CHECK (length(system) BETWEEN 1 AND 255),
	value        text         NOT NULL CHECK (length(value) BETWEEN 1 AND 255),
	issuer       text         CHECK (length(issuer) BETWEEN 1 AND 255),
	source       text         NOT NULL CHECK (source IN ('worklist', 'query', 'created_in_app')),
	valid_until  timestamptz,
	created_at   timestamptz  NOT NULL DEFAULT now(),
	CONSTRAINT patient_identifier_uniq UNIQUE NULLS NOT DISTINCT (system, value, issuer)
);

CREATE INDEX patient_identifier_patient_idx ON patient_identifier (patient_id, created_at);

-- CAP-014-R03, CAP-014-R18, CAP-024-R14, datovy-model.md 2, 4, 11
CREATE TABLE encounter (
	id                  uuid         PRIMARY KEY,
	patient_id          uuid         NOT NULL REFERENCES patient_cache (id) ON DELETE RESTRICT,
	source              text         NOT NULL CHECK (source IN ('worklist', 'created_in_app')),
	status              text         NOT NULL CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
	date                date         NOT NULL,
	scheduled_time      time,
	department_id       uuid         REFERENCES department (id),
	started_at          timestamptz,
	encounter_key       text         CHECK (length(encounter_key) BETWEEN 1 AND 255),
	completed_at        timestamptz,
	completed_by        uuid         REFERENCES app_user (id),
	study_instance_uid  text         NOT NULL UNIQUE CHECK (length(study_instance_uid) BETWEEN 1 AND 64),
	accession_number    text         CHECK (length(accession_number) BETWEEN 1 AND 16),
	last_sync_run_id    uuid         REFERENCES sync_run (id),
	created_at          timestamptz  NOT NULL DEFAULT now(),
	updated_at          timestamptz  NOT NULL DEFAULT now(),
	-- CAP-014-R16
	CHECK (source = 'worklist' OR scheduled_time IS NULL),
	-- CAP-014-R05
	CHECK (source = 'worklist' OR accession_number IS NULL),
	-- CAP-014-R06
	CHECK ((source = 'created_in_app') = (encounter_key IS NOT NULL)),
	-- CAP-014-R20
	CHECK ((status = 'completed') = (completed_at IS NOT NULL AND completed_by IS NOT NULL))
);

-- CAP-014-R06
CREATE UNIQUE INDEX encounter_key_uniq ON encounter (encounter_key) WHERE encounter_key IS NOT NULL;
-- CAP-014-R12
CREATE INDEX encounter_patient_date_idx ON encounter (patient_id, date);

-- CAP-024-R07, ADR-004 ř. 22, datovy-model.md 3, integrace-dicom.md 5.9
CREATE TABLE encounter_identifier (
	id            uuid         PRIMARY KEY,
	encounter_id  uuid         NOT NULL REFERENCES encounter (id) ON DELETE CASCADE,
	system        text         NOT NULL CHECK (length(system) BETWEEN 1 AND 255),
	value         text         NOT NULL CHECK (length(value) BETWEEN 1 AND 255),
	issuer        text         CHECK (length(issuer) BETWEEN 1 AND 255),
	source        text         NOT NULL CHECK (source IN ('worklist', 'query', 'created_in_app')),
	created_at    timestamptz  NOT NULL DEFAULT now(),
	CONSTRAINT encounter_identifier_uniq UNIQUE NULLS NOT DISTINCT (encounter_id, system, value, issuer)
);

-- CAP-025-R18
ALTER TABLE audit DROP CONSTRAINT audit_outcome_check;
ALTER TABLE audit ADD CONSTRAINT audit_outcome_check CHECK (outcome IN (
	'success',
	'failure',
	'match',
	'no_match',
	'query_too_short',
	'too_many_matches',
	'rate_limited'
));

REVOKE ALL ON TABLE sync_run, patient_cache, patient_identifier, encounter, encounter_identifier
	FROM PUBLIC, vulna_api, vulna_worker;
-- CAP-024-R09
GRANT SELECT, INSERT, UPDATE ON TABLE sync_run TO vulna_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE patient_cache, patient_identifier, encounter, encounter_identifier
	TO vulna_worker;
-- CAP-013-R07, NAB-347
GRANT SELECT ON TABLE sync_run, patient_cache, patient_identifier TO vulna_api;
