-- datovy-model.md 2, datovy-model.md 11, CAP-016-R17, CAP-020-R04, CAP-020-R13, CAP-014-R26
ALTER TABLE finding
	ADD COLUMN patient_id             uuid  NOT NULL REFERENCES patient_cache (id) ON DELETE RESTRICT,
	ADD COLUMN department_id          uuid  REFERENCES department (id),
	ADD COLUMN finding_key            uuid  NOT NULL UNIQUE,
	ADD COLUMN origin_acquisition_id  uuid  NOT NULL REFERENCES acquisition (id) ON DELETE CASCADE,
	ADD COLUMN created_by             uuid  NOT NULL REFERENCES app_user (id);
-- CAP-016-R17, CAP-020-R20
CREATE INDEX finding_patient_idx ON finding (patient_id, created_at, id);
-- CAP-020-R04, CAP-020-R16
CREATE INDEX finding_department_idx ON finding (department_id);
-- CAP-020-R13
CREATE INDEX finding_origin_idx ON finding (origin_acquisition_id);
CREATE INDEX acquisition_finding_idx ON acquisition (finding_id, closed_at);

-- CAP-016-R03, CAP-016-R04, CAP-016-R08, CAP-016-R11, CAP-016-R16
CREATE TABLE body_site (
	acquisition_id        uuid              PRIMARY KEY REFERENCES acquisition (id) ON DELETE CASCADE,
	region_code           text              NOT NULL CHECK (length(region_code) BETWEEN 1 AND 64),
	laterality            text              CHECK (laterality IN ('R', 'L')),
	view                  text              NOT NULL CHECK (view IN ('anterior', 'posterior')),
	x                     double precision  NOT NULL CHECK (x >= 0 AND x <= 1),
	y                     double precision  NOT NULL CHECK (y >= 0 AND y <= 1),
	body_diagram_version  text              NOT NULL CHECK (length(body_diagram_version) BETWEEN 1 AND 64)
);

-- CAP-021-R29, CAP-021-S23, CAP-021-S24
CREATE TABLE acquisition_update_request (
	acquisition_id  uuid         NOT NULL REFERENCES acquisition (id) ON DELETE CASCADE,
	request_key     uuid         NOT NULL,
	body_sha256     bytea        NOT NULL CHECK (length(body_sha256) = 32),
	created_at      timestamptz  NOT NULL DEFAULT now(),
	PRIMARY KEY (acquisition_id, request_key)
);
