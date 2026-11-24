import type { BlockedPredecessor } from "@/features/devices/types/device.types"
import cs from "@/i18n/cs.json"
import { fillText, formatDateTime } from "@/lib/format"
import { devicePagePath } from "@/lib/routes"
import { signalsText } from "./integrity-signals"

const texts = cs.devices.approval

export interface PredecessorLink {
	to: string
	label: string
}

// CAP-006-R19, CAP-006-S13, CAP-008-R12, E62
export function predecessorText(predecessor: BlockedPredecessor): string {
	if (predecessor.blocking !== null) {
		return fillText(texts.predecessor, {
			time: formatDateTime(predecessor.blocking.detected_at),
			signals: signalsText(predecessor.blocking.signals),
		})
	}
	return predecessor.device_id === null ? texts.predecessorUnknown : texts.predecessorUnreported
}

// CAP-006-S13, CAP-008-R12, E62
export function predecessorLinkOf(predecessor: BlockedPredecessor): PredecessorLink | undefined {
	if (predecessor.device_id === null) {
		return undefined
	}
	return {
		to: devicePagePath(predecessor.device_id),
		label: predecessor.blocking === null ? texts.predecessorPage : texts.predecessorReview,
	}
}
