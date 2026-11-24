import type { DeviceDetailRow, DeviceQueueView } from "../types/device-administration.types"

// CAP-019-R08, CAP-007-R10, CAP-007-S08
export function deviceQueueOf(row: DeviceDetailRow): DeviceQueueView | null {
	const { queue_reported_at, queue_waiting_count, queue_failed_count, queue_detected_at } = row
	if (
		queue_reported_at === null ||
		queue_waiting_count === null ||
		queue_failed_count === null ||
		queue_detected_at === null
	) {
		return null
	}
	return {
		waiting: queue_waiting_count,
		failed: queue_failed_count,
		oldest_acquired_at: row.queue_oldest_acquired_at?.toISOString() ?? null,
		reported_at: queue_reported_at.toISOString(),
		detected_at: queue_detected_at.toISOString(),
	}
}
