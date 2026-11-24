-- datovy-model.md 2, CAP-017-R05, CAP-017-R08, CAP-017-R18, ADR-023
CREATE TABLE code_list (
	code      text     PRIMARY KEY CHECK (length(code) BETWEEN 1 AND 100),
	name      text     NOT NULL CHECK (length(name) BETWEEN 1 AND 255),
	sequence  integer  NOT NULL
);

CREATE TABLE code_list_item (
	id              uuid         PRIMARY KEY,
	code_list_code  text         NOT NULL REFERENCES code_list (code),
	code            text         NOT NULL CHECK (length(code) <= 64 AND code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	sequence        integer      NOT NULL,
	is_active       boolean      NOT NULL DEFAULT true,
	created_at      timestamptz  NOT NULL DEFAULT now(),
	updated_at      timestamptz  NOT NULL DEFAULT now(),
	UNIQUE (code_list_code, code)
);

-- datovy-model.md 2 „Jazyky a vícejazyčné názvy“
CREATE TABLE code_list_item_name (
	code_list_item_id  uuid         NOT NULL REFERENCES code_list_item (id),
	language           text         NOT NULL CHECK (length(language) BETWEEN 2 AND 35),
	name               text         NOT NULL CHECK (length(name) BETWEEN 1 AND 255),
	updated_at         timestamptz  NOT NULL DEFAULT now(),
	PRIMARY KEY (code_list_item_id, language)
);

-- CAP-017-R09, CAP-017-R20, CAP-016-R07
CREATE TABLE code_list_set (
	id                    uuid         PRIMARY KEY,
	version               integer      NOT NULL UNIQUE CHECK (version > 0),
	body_diagram_version  text         NOT NULL CHECK (length(body_diagram_version) BETWEEN 1 AND 64),
	author_user_id        uuid         REFERENCES app_user (id),
	created_at            timestamptz  NOT NULL DEFAULT now()
);

-- CAP-017-R03, CAP-017-R04, CAP-017-R09, CAP-017-R18
CREATE TABLE assessment (
	acquisition_id      uuid         PRIMARY KEY REFERENCES acquisition (id) ON DELETE CASCADE,
	healing_phase_code  text         NOT NULL CHECK (length(healing_phase_code) BETWEEN 1 AND 64),
	code_list_version   integer      NOT NULL REFERENCES code_list_set (version),
	description         text         CHECK (length(description) BETWEEN 1 AND 4000),
	updated_at          timestamptz  NOT NULL
);

-- CAP-017-R02, CAP-020-R19, ADR-049
ALTER TABLE finding
	ADD COLUMN wound_type_code               text     CHECK (length(wound_type_code) BETWEEN 1 AND 64),
	ADD COLUMN wound_type_code_list_version  integer  REFERENCES code_list_set (version),
	ADD COLUMN wound_type_set_by             uuid     REFERENCES app_user (id),
	ADD CONSTRAINT finding_wound_type_complete CHECK (
		(wound_type_code IS NULL) = (wound_type_code_list_version IS NULL)
		AND (wound_type_code IS NULL) = (wound_type_set_by IS NULL)
	);

-- CAP-017-R20, datovy-model.md 4 „Úloha fronty“
ALTER TABLE queue_task DROP CONSTRAINT queue_task_object_kind_check;
ALTER TABLE queue_task ADD CONSTRAINT queue_task_object_kind_check CHECK (
	(kind = 'assembly' AND object_kind = 'acquisition')
	OR (kind = 'delivery' AND object_kind = 'delivery_instance')
	OR (kind = 'clinical_record_write' AND object_kind IN ('actor', 'code_list_set'))
);
