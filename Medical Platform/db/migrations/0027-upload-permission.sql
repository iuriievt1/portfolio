-- ADR-014 (doplnění 2026-10-14), CAP-021-R29, NAB-504, CAP-025-R17
CREATE TABLE upload_permission (
	token_hash         text         PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
	acquisition_id     uuid         NOT NULL REFERENCES acquisition (id) ON DELETE CASCADE,
	file_key           uuid         NOT NULL,
	device_id          uuid         NOT NULL REFERENCES device (id),
	sender_session_id  uuid         REFERENCES session (id),
	sha256             text         NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
	expires_at         timestamptz  NOT NULL,
	UNIQUE (acquisition_id, file_key)
);

-- ADR-021
REVOKE ALL ON TABLE upload_permission FROM PUBLIC, vulna_api, vulna_worker;
GRANT SELECT, INSERT, UPDATE ON TABLE upload_permission TO vulna_api;
