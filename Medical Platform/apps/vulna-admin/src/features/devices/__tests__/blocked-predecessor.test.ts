import { describe, expect, it } from "vitest"
import { predecessorLinkOf, predecessorText } from "@/features/devices/lib/blocked-predecessor"
import { formatDateTime } from "@/lib/format"
import { devicePagePath } from "@/lib/routes"

const PREDECESSOR_ID = "55555555-5555-4555-8555-555555555555"
const DETECTED_AT = "2026-10-29T08:00:00.000Z"
const HW_ID = "hw-predecessor"

describe("approval of a registration after a block E62", () => {
	it("CAP-006-S13 shows the review of the previous block and links to it", () => {
		const predecessor = {
			hw_id: HW_ID,
			device_id: PREDECESSOR_ID,
			blocking: { detected_at: DETECTED_AT, signals: ["emulator" as const], app_version: "1.0.0" },
		}

		expect(predecessorText(predecessor)).toBe(
			`Zařízení se registruje znovu po blokaci kvůli zásahu do systému (zjištěno ${formatDateTime(DETECTED_AT)}, signály: běh v emulátoru). Před schválením projděte důvod blokace.`,
		)
		expect(predecessorLinkOf(predecessor)).toEqual({
			to: devicePagePath(PREDECESSOR_ID),
			label: "Podklad předchozí blokace",
		})
	})

	it("CAP-006-S13 says the found predecessor reported no block and links only to its page", () => {
		const predecessor = { hw_id: HW_ID, device_id: PREDECESSOR_ID, blocking: null }

		expect(predecessorText(predecessor)).toBe(
			"Zařízení se registruje znovu po blokaci kvůli zásahu do systému. Předchozí zařízení blokaci neohlásilo, důvod chybí.",
		)
		expect(predecessorLinkOf(predecessor)).toEqual({ to: devicePagePath(PREDECESSOR_ID), label: "Předchozí zařízení" })
	})

	it("CAP-006-S13 says the predecessor was not found and offers no link", () => {
		const predecessor = { hw_id: HW_ID, device_id: null, blocking: null }

		expect(predecessorText(predecessor)).toBe(
			"Zařízení se registruje znovu po blokaci kvůli zásahu do systému. Předchozí zařízení server nenašel, důvod blokace chybí.",
		)
		expect(predecessorLinkOf(predecessor)).toBeUndefined()
	})
})
