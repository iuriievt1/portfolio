-- datovy-model.md 3, CAP-021-R11, NAB-367, NAB-370
CREATE TABLE series (
	id                   uuid     PRIMARY KEY,
	encounter_id         uuid     NOT NULL REFERENCES encounter (id),
	finding_id           uuid     REFERENCES finding (id),
	document_id          uuid     REFERENCES document (id),
	series_instance_uid  text     NOT NULL UNIQUE CHECK (length(series_instance_uid) BETWEEN 1 AND 64),
	series_number        integer  NOT NULL CHECK (series_number >= 1),
	CHECK ((finding_id IS NULL) <> (document_id IS NULL)),
	UNIQUE (encounter_id, finding_id),
	UNIQUE (document_id),
	UNIQUE (encounter_id, series_number)
);

-- ADR-021
REVOKE ALL ON TABLE series FROM PUBLIC, vulna_api, vulna_worker;
GRANT SELECT, INSERT ON TABLE series TO vulna_api;
GRANT SELECT ON TABLE series TO vulna_worker;
