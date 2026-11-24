import { PILL_TONE, type PillTone } from "@/components/custom/status-pill"
import type { Device } from "@/features/devices/types/device.types"

export const DEVICE_STATE_TONE: Readonly<Record<Device["state"], PillTone>> = {
	pending_approval: PILL_TONE.WARN,
	approved: PILL_TONE.NEUTRAL,
	revoked: PILL_TONE.CRITICAL,
	blocked: PILL_TONE.CRITICAL,
}
