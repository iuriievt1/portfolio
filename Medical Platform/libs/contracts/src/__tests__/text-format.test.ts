import { describe, expect, it } from "vitest"
import { hasCapturingGroup, identifierSearchTextOf, isSecureWebAddress, isWebAddress } from "../text-format"

describe("configuration text formats", () => {
	it("CAP-012-R30 accepts only an http or https address", () => {
		expect(isWebAddress("https://fhir.mou.cz/vulna/")).toBe(true)
		expect(isWebAddress("http://127.0.0.1:8103/")).toBe(true)
		expect(isWebAddress("ftp://store")).toBe(false)
		expect(isWebAddress("store")).toBe(false)
	})

	it("CAP-011-R02 accepts only an https address", () => {
		expect(isSecureWebAddress("https://vulna.mou.cz/storage/")).toBe(true)
		expect(isSecureWebAddress("http://vulna.mou.cz/storage/")).toBe(false)
		expect(isSecureWebAddress("storage")).toBe(false)
	})

	it("CAP-013-R03 requires a valid pattern with a capturing group", () => {
		expect(hasCapturingGroup("^PID:(\\d+)$")).toBe(true)
		expect(hasCapturingGroup("^PID:\\d+$")).toBe(false)
		expect(hasCapturingGroup("(?:PID)\\d+")).toBe(false)
		expect(hasCapturingGroup("([")).toBe(false)
	})

	it("CAP-013-R17 searches a written birth number without its spaces and slashes", () => {
		expect(identifierSearchTextOf(" 991011 / 1234 ")).toBe("9910111234")
		expect(identifierSearchTextOf("RID-0042")).toBe("RID-0042")
	})
})
