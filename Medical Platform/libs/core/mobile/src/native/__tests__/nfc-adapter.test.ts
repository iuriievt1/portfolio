import { describe, expect, it } from "vitest"
import { isMissingAdapter } from "../nfc-adapter"

describe("a phone that declares NFC without an adapter", () => {
	it("recognises the missing adapter whether it arrives as an error or as text", () => {
		expect(isMissingAdapter(new Error("no nfc support"))).toBe(true)
		expect(isMissingAdapter("no nfc support")).toBe(true)
	})

	it("keeps every other start failure apart", () => {
		expect(isMissingAdapter(new Error("fail to get current activity"))).toBe(false)
		expect(isMissingAdapter(undefined)).toBe(false)
	})
})
