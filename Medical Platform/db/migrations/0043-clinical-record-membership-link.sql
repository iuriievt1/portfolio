-- ADR-053 bod 6, datovy-model.md 13.2, CAP-020-R16
INSERT INTO queue_task (id, kind, object_kind, object_id, state)
SELECT gen_random_uuid(), 'clinical_record_write', 'actor', app_user.id, 'waiting'
FROM app_user
WHERE NOT EXISTS (
	SELECT 1 FROM fhir_resource_link
	WHERE resource_type = 'ProjectMembership' AND local_kind = 'actor' AND local_id = app_user.id::text
)
ON CONFLICT (kind, object_kind, object_id) WHERE state IN ('waiting', 'running') DO NOTHING;
