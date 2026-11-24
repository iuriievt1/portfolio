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
	'draft_reminder'
));
