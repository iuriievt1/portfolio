CREATE TABLE configuration_version (
	id              integer      PRIMARY KEY CHECK (id >= 1),
	created_at      timestamptz  NOT NULL DEFAULT now(),
	author_user_id  uuid         REFERENCES app_user (id),
	reason          text         NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000)
);

CREATE TABLE configuration (
	version_id  integer  NOT NULL REFERENCES configuration_version (id),
	key         text     NOT NULL,
	value       jsonb    NOT NULL,
	PRIMARY KEY (version_id, key)
);

REVOKE ALL ON TABLE configuration_version, configuration FROM vulna_api, vulna_worker;
GRANT SELECT, INSERT ON TABLE configuration_version, configuration TO vulna_api;
GRANT SELECT ON TABLE configuration_version, configuration TO vulna_worker;
