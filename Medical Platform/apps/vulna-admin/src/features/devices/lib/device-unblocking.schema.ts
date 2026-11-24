import { DEVICE_UNBLOCK_REASON_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"

// CAP-007-S07, administration.yaml unblockDevice
export const deviceUnblockingSchema = z.object({
	reason: z
		.string()
		.trim()
		.min(1, cs.devices.blocking.reasonMissing)
		.max(
			DEVICE_UNBLOCK_REASON_MAX_LENGTH,
			fillText(cs.errors.tooLong, { max: String(DEVICE_UNBLOCK_REASON_MAX_LENGTH) }),
		),
})

export type DeviceUnblockingValues = z.infer<typeof deviceUnblockingSchema>
