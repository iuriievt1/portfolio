-- datovy-model.md 4 „Upozornění správce“, administration.yaml AdministratorAlertKind, CAP-025-R21, CAP-028-R22
ALTER TABLE administrator_alert DROP CONSTRAINT administrator_alert_kind_check;
ALTER TABLE administrator_alert ADD CONSTRAINT administrator_alert_kind_check CHECK (kind IN (
	'clinical_record_write_failed',
	'stale_acquisition_drafts',
	'clinical_record_binary_upload_failed',
	'viewing_copy_generation_failed',
	'audit_chain_broken',
	'clinical_record_store_unavailable'
));

-- CAP-025-R21
ALTER TABLE administrator_alert ADD COLUMN audit_id uuid;
ALTER TABLE administrator_alert ADD CONSTRAINT administrator_alert_audit_check
	CHECK ((kind = 'audit_chain_broken') = (audit_id IS NOT NULL));

-- CAP-025-R21
CREATE UNIQUE INDEX administrator_alert_active_audit_uniq ON administrator_alert (audit_id) WHERE resolved_at IS NULL;

-- CAP-028-R22
CREATE UNIQUE INDEX administrator_alert_active_store_unavailable_uniq ON administrator_alert (kind)
	WHERE resolved_at IS NULL AND kind = 'clinical_record_store_unavailable';

-- datovy-model.md 8, CAP-028-R15
ALTER TABLE audit DROP CONSTRAINT audit_system_job_check;
ALTER TABLE audit ADD CONSTRAINT audit_system_job_check CHECK (system_job IN (
	'registry_sync',
	'retention',
	'orphan_cleanup',
	'buffer_cleanup',
	'audit_export',
	'clinical_record_installation',
	'clinical_record_write',
	'draft_reminder',
	'dependency_monitoring'
));

-- administration.yaml getOperationalMetricsForAdministration binary_buffer, CAP-026-R18
CREATE INDEX binary_object_buffer_idx ON binary_object (id) INCLUDE (size_bytes, set_aside_at)
	WHERE buffer_deleted_at IS NULL;
