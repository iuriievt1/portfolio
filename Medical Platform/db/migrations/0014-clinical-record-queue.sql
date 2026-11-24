-- datovy-model.md 4, ADR-016, CAP-021-R38
ALTER TABLE queue_task DROP CONSTRAINT queue_task_kind_check;
ALTER TABLE queue_task ADD CONSTRAINT queue_task_kind_check CHECK (kind IN ('assembly', 'delivery', 'clinical_record_write'));

ALTER TABLE queue_task ADD COLUMN object_kind text;
UPDATE queue_task SET object_kind = CASE kind WHEN 'assembly' THEN 'acquisition' ELSE 'delivery_instance' END;
ALTER TABLE queue_task ALTER COLUMN object_kind SET NOT NULL;
ALTER TABLE queue_task ADD CONSTRAINT queue_task_object_kind_check CHECK (
	(kind = 'assembly' AND object_kind = 'acquisition')
	OR (kind = 'delivery' AND object_kind = 'delivery_instance')
	OR (kind = 'clinical_record_write' AND object_kind = 'actor')
);

-- ADR-016 ř. 54
ALTER TABLE queue_task ADD COLUMN locked_until timestamptz;
ALTER TABLE queue_task ADD COLUMN locked_by text CHECK (length(locked_by) BETWEEN 1 AND 128);
ALTER TABLE queue_task ADD CONSTRAINT queue_task_lease_check CHECK ((locked_until IS NULL) = (locked_by IS NULL));

-- CAP-021-R31
CREATE UNIQUE INDEX queue_task_open_uniq ON queue_task (kind, object_kind, object_id) WHERE state IN ('waiting', 'running');

-- datovy-model.md 9, CAP-012-S23
ALTER TABLE audit DROP CONSTRAINT audit_system_job_check;
ALTER TABLE audit ADD CONSTRAINT audit_system_job_check CHECK (system_job IN (
	'registry_sync',
	'retention',
	'orphan_cleanup',
	'buffer_cleanup',
	'audit_export',
	'clinical_record_installation'
));
