import type { DeviceQueue } from "@/features/devices/types/device.types"
import cs from "@/i18n/cs.json"
import { formatCount, formatDateTime } from "@/lib/format"

const texts = cs.devices.queue

// CAP-019-R08, CAP-007-R10
export function queueFieldsOf(queue: DeviceQueue) {
	return [
		{ term: texts.waiting, value: formatCount(queue.waiting) },
		{ term: texts.failed, value: formatCount(queue.failed) },
		{
			term: texts.oldest,
			value: queue.oldest_acquired_at === null ? texts.noneUnsent : formatDateTime(queue.oldest_acquired_at),
		},
		{ term: texts.reported, value: formatDateTime(queue.reported_at) },
	]
}
