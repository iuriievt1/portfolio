-- datovy-model.md 4 Pořízení, CAP-021-R13, CAP-025-R17, ADR-044 bod 3
ALTER TABLE acquisition
	ADD COLUMN operator_session_id  uuid  REFERENCES session (id),
	ADD COLUMN closing_session_id   uuid  REFERENCES session (id),
	ADD COLUMN closing_device_id    uuid  REFERENCES device (id);

-- datovy-model.md 4 Pořízení
ALTER TABLE acquisition ADD CONSTRAINT acquisition_draft_without_closing_check
	CHECK (state <> 'draft' OR (closing_session_id IS NULL AND closing_device_id IS NULL));

-- CAP-026-R14, CAP-026-R17, datovy-model.md 11
CREATE INDEX image_binary_object_idx ON image (binary_object_id);
CREATE INDEX image_replaces_file_idx ON image (replaces_file_id);
CREATE INDEX thumbnail_binary_object_idx ON thumbnail (binary_object_id);
CREATE INDEX document_output_pdf_binary_object_idx ON document (output_pdf_binary_object_id);
CREATE INDEX document_page_binary_object_idx ON document_page (binary_object_id);
CREATE INDEX document_page_thumbnail_binary_object_idx ON document_page (thumbnail_binary_object_id);
CREATE INDEX document_page_replaces_file_idx ON document_page (replaces_file_id);

-- CAP-015-R18, CAP-015-R29, ADR-012
DROP INDEX acquisition_draft_operator_idx;
CREATE INDEX acquisition_draft_operator_idx ON acquisition (operator_user_id, state, updated_at DESC, id DESC);
