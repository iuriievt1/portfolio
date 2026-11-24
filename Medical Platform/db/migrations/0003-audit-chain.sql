ALTER TABLE audit RENAME COLUMN user_id TO actor_user_id;
ALTER TABLE audit RENAME COLUMN device_id TO actor_device_id;

DROP INDEX audit_pending_export_idx;
ALTER TABLE audit DROP COLUMN exported_at;
ALTER TABLE audit ALTER COLUMN occurred_at DROP DEFAULT;

ALTER TABLE audit
	ADD COLUMN sequence       bigint  NOT NULL,
	ADD COLUMN actor_kind     text    NOT NULL CHECK (actor_kind IN ('user', 'device', 'system_job')),
	ADD COLUMN system_job     text    CHECK (system_job IN ('registry_sync', 'retention', 'orphan_cleanup', 'buffer_cleanup', 'audit_export')),
	ADD COLUMN session_id     uuid,
	ADD COLUMN previous_hash  text    NOT NULL CHECK (previous_hash = '' OR previous_hash ~ '^[0-9a-f]{64}$'),
	ADD COLUMN hash           text    NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$'),
	ADD CONSTRAINT audit_sequence_uniq UNIQUE (sequence),
	ADD CONSTRAINT audit_hash_uniq UNIQUE (hash),
	ADD CONSTRAINT audit_actor_matches_kind CHECK (
		(actor_kind = 'user' AND actor_user_id IS NOT NULL AND system_job IS NULL)
		OR (actor_kind = 'device' AND actor_device_id IS NOT NULL AND actor_user_id IS NULL AND system_job IS NULL)
		OR (actor_kind = 'system_job' AND system_job IS NOT NULL AND actor_user_id IS NULL AND actor_device_id IS NULL)
	);

CREATE FUNCTION audit_reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'audit is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER audit_no_update_or_delete
	BEFORE UPDATE OR DELETE ON audit
	FOR EACH ROW EXECUTE FUNCTION audit_reject_change();

CREATE TRIGGER audit_no_truncate
	BEFORE TRUNCATE ON audit
	FOR EACH STATEMENT EXECUTE FUNCTION audit_reject_change();

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit FROM PUBLIC, vulna_api, vulna_worker, vulna_migrate;
