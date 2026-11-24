-- datovy-model.md 4 „Binární objekt“, datovy-model.md 5, CAP-026-R18, CAP-026-R19, CAP-026-R20, ADR-050 bod 14
ALTER TABLE binary_object
	ADD COLUMN retention_due_at             timestamptz,
	ADD COLUMN clinical_record_detached_at  timestamptz,
	ADD CONSTRAINT binary_object_retention_due_check CHECK (
		retention_due_at IS NULL
		OR (clinical_record_uploaded_at IS NOT NULL AND buffer_deleted_at IS NOT NULL)
	),
	ADD CONSTRAINT binary_object_detached_check CHECK (
		clinical_record_detached_at IS NULL OR retention_due_at IS NOT NULL
	);

CREATE INDEX binary_object_retention_idx ON binary_object (id) WHERE retention_due_at IS NOT NULL;

-- CAP-026-R06, CAP-026-R19, CAP-020-R15, datovy-model.md 4 „Binární objekt“
ALTER TABLE image
	ADD COLUMN original_deleted_at  timestamptz,
	DROP CONSTRAINT image_check,
	ADD CONSTRAINT image_received_check CHECK (
		(status = 'received') = (received_at IS NOT NULL AND (binary_object_id IS NOT NULL OR original_deleted_at IS NOT NULL))
	),
	ADD CONSTRAINT image_original_deleted_check CHECK (
		original_deleted_at IS NULL OR (status = 'received' AND binary_object_id IS NULL)
	);

ALTER TABLE document_page
	ADD COLUMN original_deleted_at  timestamptz,
	DROP CONSTRAINT document_page_check,
	ADD CONSTRAINT document_page_received_check CHECK (
		(status = 'received') = (received_at IS NOT NULL AND (binary_object_id IS NOT NULL OR original_deleted_at IS NOT NULL))
	),
	ADD CONSTRAINT document_page_original_deleted_check CHECK (
		original_deleted_at IS NULL OR (status = 'received' AND binary_object_id IS NULL)
	);

-- CAP-026-R20, CAP-021-R39
ALTER TABLE document
	ADD COLUMN output_pdf_deleted_at  timestamptz,
	ADD CONSTRAINT document_output_pdf_deleted_check CHECK (
		output_pdf_deleted_at IS NULL OR output_pdf_binary_object_id IS NULL
	);
