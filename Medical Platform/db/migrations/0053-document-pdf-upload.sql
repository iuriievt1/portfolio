-- datovy-model.md 4, CAP-021-R36, CAP-021-R39
ALTER TABLE queue_task DROP CONSTRAINT queue_task_object_kind_check;
ALTER TABLE queue_task ADD CONSTRAINT queue_task_object_kind_check CHECK (
	(kind = 'assembly' AND object_kind = 'acquisition')
	OR (kind = 'delivery' AND object_kind = 'delivery_instance')
	OR (kind = 'clinical_record_write' AND object_kind IN ('actor', 'code_list_set', 'image', 'document_page', 'document'))
	OR (kind = 'clinical_record_binary_upload' AND object_kind IN ('image', 'document_page', 'document'))
	OR (kind = 'clinical_record_viewing_copy' AND object_kind IN ('image', 'document_page'))
);
