-- datovy-model.md 4, CAP-021-R36, CAP-021-R37, CAP-021-R40
ALTER TABLE queue_task DROP CONSTRAINT queue_task_kind_check;
ALTER TABLE queue_task ADD CONSTRAINT queue_task_kind_check CHECK (kind IN (
	'assembly',
	'delivery',
	'clinical_record_write',
	'clinical_record_binary_upload',
	'clinical_record_viewing_copy'
));

ALTER TABLE queue_task DROP CONSTRAINT queue_task_object_kind_check;
ALTER TABLE queue_task ADD CONSTRAINT queue_task_object_kind_check CHECK (
	(kind = 'assembly' AND object_kind = 'acquisition')
	OR (kind = 'delivery' AND object_kind = 'delivery_instance')
	OR (kind = 'clinical_record_write' AND object_kind IN ('actor', 'code_list_set', 'image', 'document_page'))
	OR (kind IN ('clinical_record_binary_upload', 'clinical_record_viewing_copy') AND object_kind IN ('image', 'document_page'))
);

-- datovy-model.md 4 „Binární objekt“, CAP-021-R40
ALTER TABLE image ADD COLUMN viewing_copy_binary_object_id uuid REFERENCES binary_object (id);
ALTER TABLE document_page ADD COLUMN viewing_copy_binary_object_id uuid REFERENCES binary_object (id);
-- CAP-026-R14, CAP-026-R17, datovy-model.md 11
CREATE INDEX image_viewing_copy_binary_object_idx ON image (viewing_copy_binary_object_id);
CREATE INDEX document_page_viewing_copy_binary_object_idx ON document_page (viewing_copy_binary_object_id);

-- datovy-model.md 4 „Upozornění správce“, administration.yaml AdministratorAlertKind, CAP-021-R36, CAP-021-R40
ALTER TABLE administrator_alert DROP CONSTRAINT administrator_alert_kind_check;
ALTER TABLE administrator_alert ADD CONSTRAINT administrator_alert_kind_check CHECK (kind IN (
	'clinical_record_write_failed',
	'stale_acquisition_drafts',
	'clinical_record_binary_upload_failed',
	'viewing_copy_generation_failed'
));

ALTER TABLE administrator_alert DROP CONSTRAINT administrator_alert_task_check;
ALTER TABLE administrator_alert ADD CONSTRAINT administrator_alert_task_check CHECK (
	kind NOT IN ('clinical_record_write_failed', 'clinical_record_binary_upload_failed', 'viewing_copy_generation_failed')
	OR queue_task_id IS NOT NULL
);
