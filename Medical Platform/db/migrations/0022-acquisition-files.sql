-- datovy-model.md 4, CAP-021-R35, CAP-026-R14, ADR-044
CREATE TABLE binary_object (
	id                           uuid         PRIMARY KEY,
	created_at                   timestamptz  NOT NULL DEFAULT now(),
	size_bytes                   bigint       NOT NULL CHECK (size_bytes >= 0),
	sha256                       text         NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
	set_aside_at                 timestamptz,
	clinical_record_binary_id    text,
	clinical_record_uploaded_at  timestamptz,
	buffer_deleted_at            timestamptz
);

-- datovy-model.md 2, CAP-015-R35, CAP-015-R36, CAP-021-R23, CAP-015-R34
CREATE TABLE image (
	id                      uuid         PRIMARY KEY,
	acquisition_id          uuid         NOT NULL REFERENCES acquisition (id) ON DELETE CASCADE,
	file_key                uuid         NOT NULL,
	sequence                integer      NOT NULL CHECK (sequence >= 1),
	proposed_sequence       integer      CHECK (proposed_sequence >= 1),
	status                  text         NOT NULL CHECK (status IN ('announced', 'received', 'rejected', 'removed')),
	binary_object_id        uuid         REFERENCES binary_object (id),
	sha256                  text         CHECK (sha256 ~ '^[0-9a-f]{64}$'),
	original_upload_sha256  text         CHECK (original_upload_sha256 ~ '^[0-9a-f]{64}$'),
	edit_kind               text         CHECK (edit_kind IN ('rotation', 'crop', 'rotation_and_crop')),
	edited_at               timestamptz,
	announced_by_device_id  uuid         REFERENCES device (id),
	replaces_file_id        uuid         REFERENCES image (id),
	announced_at            timestamptz  NOT NULL DEFAULT now(),
	received_at             timestamptz,
	UNIQUE (acquisition_id, file_key),
	CHECK ((status = 'received') = (binary_object_id IS NOT NULL AND received_at IS NOT NULL))
);
CREATE INDEX image_acquisition_idx ON image (acquisition_id, sequence);

-- datovy-model.md 2, ADR-026, CAP-026-R02
CREATE TABLE thumbnail (
	image_id          uuid  PRIMARY KEY REFERENCES image (id) ON DELETE CASCADE,
	binary_object_id  uuid  NOT NULL REFERENCES binary_object (id)
);

-- datovy-model.md 2, CAP-018-R15, CAP-020-R17, CAP-020-R18
CREATE TABLE document (
	id                            uuid  PRIMARY KEY,
	acquisition_id                uuid  NOT NULL UNIQUE REFERENCES acquisition (id) ON DELETE CASCADE,
	title_code                    text  CHECK (length(title_code) BETWEEN 1 AND 64),
	title_text                    text  CHECK (length(title_text) BETWEEN 1 AND 255),
	title_code_list_version       integer  REFERENCES code_list_set (version),
	output_pdf_binary_object_id   uuid  REFERENCES binary_object (id),
	CHECK (title_code IS NULL OR title_text IS NULL),
	CHECK ((title_code IS NULL) = (title_code_list_version IS NULL))
);

-- datovy-model.md 2, CAP-015-R35, CAP-015-R36, CAP-021-R23, ⚠ Q-128
CREATE TABLE document_page (
	id                            uuid         PRIMARY KEY,
	document_id                   uuid         NOT NULL REFERENCES document (id) ON DELETE CASCADE,
	file_key                      uuid         NOT NULL,
	sequence                      integer      NOT NULL CHECK (sequence >= 1),
	proposed_sequence             integer      CHECK (proposed_sequence >= 1),
	status                        text         NOT NULL CHECK (status IN ('announced', 'received', 'rejected', 'removed')),
	binary_object_id              uuid         REFERENCES binary_object (id),
	thumbnail_binary_object_id    uuid         REFERENCES binary_object (id),
	sha256                        text         CHECK (sha256 ~ '^[0-9a-f]{64}$'),
	original_upload_sha256        text         CHECK (original_upload_sha256 ~ '^[0-9a-f]{64}$'),
	edit_kind                     text         CHECK (edit_kind IN ('rotation', 'crop', 'rotation_and_crop')),
	edited_at                     timestamptz,
	announced_by_device_id        uuid         REFERENCES device (id),
	replaces_file_id              uuid         REFERENCES document_page (id),
	announced_at                  timestamptz  NOT NULL DEFAULT now(),
	received_at                   timestamptz,
	UNIQUE (document_id, file_key),
	CHECK ((status = 'received') = (binary_object_id IS NOT NULL AND received_at IS NOT NULL))
);
CREATE INDEX document_page_document_idx ON document_page (document_id, sequence);
