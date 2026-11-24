-- datovy-model.md 2, CAP-020-R19, CAP-020-R21, CAP-025-R30
CREATE TABLE finding_wound_type_change (
	id                                     uuid         PRIMARY KEY,
	finding_id                             uuid         NOT NULL REFERENCES finding (id) ON DELETE CASCADE,
	changed_at                             timestamptz  NOT NULL,
	changed_by                             uuid         NOT NULL REFERENCES app_user (id),
	previous_wound_type_code               text         NOT NULL CHECK (length(previous_wound_type_code) BETWEEN 1 AND 64),
	previous_wound_type_code_list_version  integer      NOT NULL REFERENCES code_list_set (version),
	wound_type_code                        text         NOT NULL CHECK (length(wound_type_code) BETWEEN 1 AND 64),
	wound_type_code_list_version           integer      NOT NULL REFERENCES code_list_set (version),
	CHECK (wound_type_code <> previous_wound_type_code)
);
-- CAP-020-R19, ADR-012
CREATE INDEX finding_wound_type_change_finding_idx ON finding_wound_type_change (finding_id, changed_at DESC, id DESC);

-- ADR-021, CAP-025-R07
REVOKE ALL ON TABLE finding_wound_type_change FROM PUBLIC, vulna_api, vulna_worker;
GRANT SELECT, INSERT ON TABLE finding_wound_type_change TO vulna_api;
GRANT SELECT ON TABLE finding_wound_type_change TO vulna_worker;

-- CAP-020-R01, CAP-020-R20, ADR-012
CREATE INDEX acquisition_finding_closed_idx ON acquisition (finding_id, closed_at DESC, id DESC)
	WHERE state <> 'draft';
-- CAP-020-R18, ADR-012
CREATE INDEX acquisition_patient_scan_closed_idx ON acquisition (patient_id, closed_at DESC, id DESC)
	WHERE kind = 'scan' AND state <> 'draft';
