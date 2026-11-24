-- CAP-019-R08, CAP-007-S08, datovy-model.md 4
ALTER TABLE device
	ADD CONSTRAINT device_queue_oldest_reported_check CHECK (
		queue_reported_at IS NOT NULL OR queue_oldest_acquired_at IS NULL
	);
