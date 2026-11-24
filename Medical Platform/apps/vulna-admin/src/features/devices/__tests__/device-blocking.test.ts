import { DEVICE_UNBLOCK_REASON_MAX_LENGTH } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { deviceUnblockingSchema } from "@/features/devices/lib/device-unblocking.schema"
import { signalsText } from "@/features/devices/lib/integrity-signals"
import cs from "@/i18n/cs.json"

describe("review of a blocked device", () => {
	it("CAP-008-S09 names both reported signals in Czech in the reported order", () => {
		expect(signalsText(["root", "debugger"])).toBe("root a připojený ladicí nástroj")
	})

	it("CAP-007-S07 requires the result of the review before unblocking", () => {
		const missing = deviceUnblockingSchema.safeParse({ reason: "   " })
		expect(missing.success).toBe(false)
		expect(missing.error?.issues[0]?.message).toBe(cs.devices.blocking.reasonMissing)
		expect(deviceUnblockingSchema.parse({ reason: " Falešný poplach. " })).toEqual({ reason: "Falešný poplach." })
	})

	it("CAP-007-S07 refuses a result of the review longer than the contract allows", () => {
		const longest = "a".repeat(DEVICE_UNBLOCK_REASON_MAX_LENGTH)
		expect(deviceUnblockingSchema.safeParse({ reason: longest }).success).toBe(true)
		expect(deviceUnblockingSchema.safeParse({ reason: `${longest}a` }).success).toBe(false)
	})
})
