-- datovy-model.md 4, datovy-model.md 11, CAP-019-R14, CAP-015-R17, CAP-015-R37
CREATE TABLE decided_acquisition (
	acquisition_key  uuid         PRIMARY KEY,
	acquisition_id   uuid         NOT NULL UNIQUE,
	reason           text         NOT NULL CHECK (reason IN ('discarded', 'cancelled')),
	decided_at       timestamptz  NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE decided_acquisition FROM PUBLIC, vulna_api, vulna_worker;
-- CAP-014-R29, CAP-019-R14
GRANT SELECT, INSERT ON TABLE decided_acquisition TO vulna_api;
