-- CAP-025-R22, datovy-model.md 8
CREATE TABLE recorded_device_event (
	idempotency_key  uuid         PRIMARY KEY,
	device_id        uuid         NOT NULL REFERENCES device (id),
	recorded_at      timestamptz  NOT NULL
);

REVOKE ALL ON TABLE recorded_device_event FROM vulna_api, vulna_worker;
GRANT SELECT, INSERT ON TABLE recorded_device_event TO vulna_api;
