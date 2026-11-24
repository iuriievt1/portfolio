-- CAP-003-R07, Q-048: department codes as the customer keeps them
CREATE TABLE department (
	id          uuid         PRIMARY KEY,
	code        text         NOT NULL UNIQUE CHECK (length(code) BETWEEN 1 AND 128),
	created_at  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE app_user ADD COLUMN department_id uuid REFERENCES department (id);

-- ADR-050 bod 5: the department valid at any moment
CREATE TABLE user_department_history (
	id             uuid         PRIMARY KEY,
	user_id        uuid         NOT NULL REFERENCES app_user (id),
	department_id  uuid         NOT NULL REFERENCES department (id),
	valid_from     timestamptz  NOT NULL,
	valid_until    timestamptz,
	CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE UNIQUE INDEX user_department_history_current_uniq ON user_department_history (user_id) WHERE valid_until IS NULL;
CREATE INDEX user_department_history_user_valid_from_idx ON user_department_history (user_id, valid_from);

REVOKE ALL ON TABLE department, user_department_history FROM vulna_api, vulna_worker;
GRANT SELECT, INSERT ON TABLE department TO vulna_api;
GRANT SELECT, INSERT ON TABLE user_department_history TO vulna_api;
-- a period only closes
GRANT UPDATE (valid_until) ON TABLE user_department_history TO vulna_api;
