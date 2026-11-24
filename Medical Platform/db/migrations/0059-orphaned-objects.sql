-- datovy-model.md 4 „Binární objekt“, CAP-026-R14, CAP-026-S07, ADR-038
ALTER TABLE binary_object
	ADD CONSTRAINT binary_object_set_aside_check CHECK (
		set_aside_at IS NULL OR (buffer_deleted_at IS NULL AND clinical_record_binary_id IS NULL)
	);

-- administration.yaml listOrphanedObjects, datovy-model.md 11
CREATE INDEX binary_object_set_aside_idx ON binary_object (created_at, id) WHERE set_aside_at IS NOT NULL;

-- CAP-026-R14, datovy-model.md 11
CREATE INDEX binary_object_orphan_candidate_idx ON binary_object (created_at)
	WHERE set_aside_at IS NULL AND buffer_deleted_at IS NULL AND clinical_record_binary_id IS NULL;

-- datovy-model.md 4 „Upozornění správce“, CAP-026-R14, CAP-028-R15
ALTER TABLE administrator_alert DROP CONSTRAINT administrator_alert_kind_check;
ALTER TABLE administrator_alert ADD CONSTRAINT administrator_alert_kind_check CHECK (kind IN (
	'clinical_record_write_failed',
	'stale_acquisition_drafts',
	'clinical_record_binary_upload_failed',
	'viewing_copy_generation_failed',
	'audit_chain_broken',
	'clinical_record_store_unavailable',
	'assembly_failed',
	'assembly_paused',
	'permanent_delivery_failure',
	'held_for_review',
	'stored_with_warning',
	'verification_rejected',
	'target_paused',
	'target_unavailability',
	'orphaned_objects_set_aside'
));
ALTER TABLE administrator_alert
	ADD COLUMN set_aside_object_count  integer  CHECK (set_aside_object_count > 0),
	ADD CONSTRAINT administrator_alert_set_aside_check CHECK (
		(kind = 'orphaned_objects_set_aside') = (set_aside_object_count IS NOT NULL)
	);
