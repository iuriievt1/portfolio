import { LOGIN_RETURN_URL } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { isLoginReturnUrl, parseLoginReturn } from "../oidc-return"

describe("return into the app by the app scheme", () => {
	it("reads the state and the completion code", () => {
		expect(parseLoginReturn(`${LOGIN_RETURN_URL}?state=abc&completion_code=xyz`)).toEqual({
			state: "abc",
			completionCode: "xyz",
		})
		expect(parseLoginReturn("ansoravulna://login/oidc/?completion_code=xyz&state=a%20b")).toEqual({
			state: "a b",
			completionCode: "xyz",
		})
	})

	it("refuses another location or a missing parameter", () => {
		expect(parseLoginReturn("ansoravulna://login/other?state=abc&completion_code=xyz")).toBeUndefined()
		expect(parseLoginReturn(`${LOGIN_RETURN_URL}?state=abc`)).toBeUndefined()
		expect(parseLoginReturn(`${LOGIN_RETURN_URL}?state=&completion_code=xyz`)).toBeUndefined()
		expect(parseLoginReturn("::")).toBeUndefined()
	})
})

describe("recognising the return into the app", () => {
	it("recognises the return location with or without its parameters", () => {
		expect(isLoginReturnUrl(`${LOGIN_RETURN_URL}?state=abc&completion_code=xyz`)).toBe(true)
		expect(isLoginReturnUrl("ansoravulna://login/oidc/")).toBe(true)
		expect(isLoginReturnUrl(`${LOGIN_RETURN_URL}?state=abc`)).toBe(true)
	})

	it("leaves every other location to the router", () => {
		expect(isLoginReturnUrl("ansoravulna://login/other?state=abc&completion_code=xyz")).toBe(false)
		expect(isLoginReturnUrl("ansoravulna://visit/123")).toBe(false)
		expect(isLoginReturnUrl("/visit/123")).toBe(false)
		expect(isLoginReturnUrl("::")).toBe(false)
	})
})
