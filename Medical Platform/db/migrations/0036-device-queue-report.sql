-- CAP-019-R08, CAP-007-S08, datovy-model.md 4
ALTER TABLE device
	ADD COLUMN queue_waiting_count       integer      CHECK (queue_waiting_count >= 0),
	ADD COLUMN queue_failed_count        integer      CHECK (queue_failed_count >= 0),
	ADD COLUMN queue_oldest_acquired_at  timestamptz,
	ADD COLUMN queue_detected_at         timestamptz,
	ADD COLUMN queue_reported_at         timestamptz,
	ADD CONSTRAINT device_queue_report_complete_check CHECK (
		(queue_reported_at IS NULL) = (queue_waiting_count IS NULL)
		AND (queue_reported_at IS NULL) = (queue_failed_count IS NULL)
		AND (queue_reported_at IS NULL) = (queue_detected_at IS NULL)
	),
	ADD CONSTRAINT device_queue_oldest_check CHECK (
		queue_reported_at IS NULL
		OR (queue_waiting_count = 0 AND queue_failed_count = 0) = (queue_oldest_acquired_at IS NULL)
	);

-- CAP-019-R30
CREATE INDEX image_announced_device_idx ON image (announced_by_device_id, acquisition_id)
	WHERE announced_by_device_id IS NOT NULL;
CREATE INDEX document_page_announced_device_idx ON document_page (announced_by_device_id, document_id)
	WHERE announced_by_device_id IS NOT NULL;
CREATE INDEX acquisition_closing_device_idx ON acquisition (closing_device_id)
	WHERE closing_device_id IS NOT NULL;
