import { describe, expect, it } from "vitest"
import { cookieValue } from "../cookies"

describe("cookie header", () => {
	it("returns the value of the named cookie among others", () => {
		expect(cookieValue("theme=dark; vulna_admin_session=abc123; other=1", "vulna_admin_session")).toBe("abc123")
	})

	it("returns undefined without the header, without the cookie or with an empty value", () => {
		expect(cookieValue(undefined, "vulna_admin_session")).toBeUndefined()
		expect(cookieValue("theme=dark", "vulna_admin_session")).toBeUndefined()
		expect(cookieValue("vulna_admin_session=", "vulna_admin_session")).toBeUndefined()
	})

	it("does not confuse a cookie whose name only ends with the wanted name", () => {
		expect(cookieValue("xvulna_admin_session=abc", "vulna_admin_session")).toBeUndefined()
	})
})
