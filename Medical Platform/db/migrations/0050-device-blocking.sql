-- datovy-model.md 4, CAP-008-R12
ALTER TABLE device
	ADD COLUMN blocking_detected_at  timestamptz,
	ADD COLUMN blocking_signals      text[] CHECK (
		cardinality(blocking_signals) >= 1
		AND blocking_signals <@ ARRAY['jailbreak', 'root', 'magisk', 'frida', 'debugger', 'emulator', 'app_integrity']
	),
	ADD COLUMN blocking_app_version  text CHECK (length(blocking_app_version) BETWEEN 1 AND 50),
	ADD CONSTRAINT device_blocking_check CHECK (
		(blocking_detected_at IS NULL) = (blocking_signals IS NULL)
		AND (blocking_detected_at IS NULL) = (blocking_app_version IS NULL)
		AND (state <> 'blocked' OR blocking_detected_at IS NOT NULL)
	);

-- CAP-007-R06, CAP-007-S07, administration.yaml Device.unblocking
ALTER TABLE device
	ADD COLUMN unblocked_at          timestamptz,
	ADD COLUMN unblocked_by_user_id  uuid REFERENCES app_user (id),
	ADD COLUMN unblock_reason        text CHECK (length(unblock_reason) BETWEEN 1 AND 2000),
	ADD CONSTRAINT device_unblocking_check CHECK (
		(unblocked_at IS NULL) = (unblocked_by_user_id IS NULL)
		AND (unblocked_at IS NULL) = (unblock_reason IS NULL)
		AND (unblocked_at IS NULL OR state IN ('blocked', 'revoked'))
	);
