import { describe, expect, it } from "vitest"
import { optionalPortOf } from "../optional-port"

describe("optionalPortOf", () => {
	it("reads a configured port and leaves an absent one absent", () => {
		expect(optionalPortOf("3001")).toBe(3001)
		expect(optionalPortOf(undefined)).toBeUndefined()
	})

	it("refuses a value that is not a TCP port", () => {
		expect(() => optionalPortOf("abc")).toThrow()
		expect(() => optionalPortOf("0")).toThrow()
		expect(() => optionalPortOf("65536")).toThrow()
		expect(() => optionalPortOf("30.5")).toThrow()
	})
})
