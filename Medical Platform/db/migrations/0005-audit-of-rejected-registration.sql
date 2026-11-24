ALTER TABLE audit DROP CONSTRAINT audit_actor_matches_kind;

ALTER TABLE audit ADD CONSTRAINT audit_actor_matches_kind CHECK (
	(actor_kind = 'user' AND actor_user_id IS NOT NULL AND system_job IS NULL)
	OR (
		actor_kind = 'device'
		AND actor_user_id IS NULL
		AND system_job IS NULL
		AND (actor_device_id IS NOT NULL OR outcome = 'failure')
	)
	OR (actor_kind = 'system_job' AND system_job IS NOT NULL AND actor_user_id IS NULL AND actor_device_id IS NULL)
);
