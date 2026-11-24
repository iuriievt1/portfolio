import { PAGE_LIMIT_MAX } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { pageLimit } from "../page-limit"

const POLICY = { defaultSize: 100, maxSize: 200 }

describe("pageLimit", () => {
	it("uses the profile default when the request names no limit", () => {
		expect(pageLimit(undefined, POLICY)).toBe(100)
	})

	it("keeps a requested limit within the profile maximum", () => {
		expect(pageLimit(50, POLICY)).toBe(50)
		expect(pageLimit(300, POLICY)).toBe(200)
	})

	it("never exceeds the contract maximum", () => {
		expect(pageLimit(undefined, { defaultSize: 1000, maxSize: 1000 })).toBe(PAGE_LIMIT_MAX)
	})
})
