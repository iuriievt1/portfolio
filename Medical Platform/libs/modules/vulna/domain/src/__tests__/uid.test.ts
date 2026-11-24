import { describe, expect, it } from "vitest"
import { uidOfUuid } from "../dicom/uid"

// NAB-370, CAP-014-R06, CAP-014-S02
describe("DICOM UID derived from a UUID", () => {
	it("is the decimal form of the UUID under the root 2.25", () => {
		expect(uidOfUuid("00000000-0000-0000-0000-000000000001")).toBe("2.25.1")
		expect(uidOfUuid("ffffffff-ffff-ffff-ffff-ffffffffffff")).toBe("2.25.340282366920938463463374607431768211455")
	})

	it("stays within the 64 characters DICOM allows", () => {
		expect(uidOfUuid("ffffffff-ffff-ffff-ffff-ffffffffffff").length).toBeLessThanOrEqual(64)
	})

	it("refuses anything that is not a UUID", () => {
		expect(() => uidOfUuid("not-a-uuid")).toThrow()
	})
})
