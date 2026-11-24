import { describe, expect, it } from "vitest"
import { formatElapsed } from "@/lib/format"

describe("formatElapsed", () => {
	it("rounds an elapsed time down to its largest whole unit", () => {
		expect(formatElapsed(0)).toBe("0 sekund")
		expect(formatElapsed(59)).toBe("59 sekund")
		expect(formatElapsed(437)).toBe("7 minut")
		expect(formatElapsed(7200)).toBe("2 hodiny")
		expect(formatElapsed(90_061)).toBe("1 den")
	})
})
