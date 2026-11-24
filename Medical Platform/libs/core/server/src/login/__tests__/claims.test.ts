import { EMAIL_MAX_LENGTH, LOGIN_NAME_MAX_LENGTH } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { emailOf, loginNameOf } from "../claims"

const LOGIN_NAME_CLAIM = "preferred_username"
const EMAIL_CLAIM = "email"

describe("login name and e-mail from the identity provider", () => {
	it("reads the login name from the named claim without surrounding spaces", () => {
		expect(loginNameOf({ [LOGIN_NAME_CLAIM]: " jnovakova " }, LOGIN_NAME_CLAIM)).toBe("jnovakova")
	})

	it("reads the e-mail from the named claim without surrounding spaces", () => {
		expect(emailOf({ [EMAIL_CLAIM]: " jana.novakova@mou.invalid " }, EMAIL_CLAIM)).toBe("jana.novakova@mou.invalid")
	})

	it("has no value when the claim is missing, blank or not text", () => {
		expect(loginNameOf({}, LOGIN_NAME_CLAIM)).toBeUndefined()
		expect(loginNameOf({ [LOGIN_NAME_CLAIM]: "  " }, LOGIN_NAME_CLAIM)).toBeUndefined()
		expect(emailOf({ [EMAIL_CLAIM]: ["jana.novakova@mou.invalid"] }, EMAIL_CLAIM)).toBeUndefined()
	})

	it("has no value when it is longer than the contract allows", () => {
		const longestName = "a".repeat(LOGIN_NAME_MAX_LENGTH)
		const longestEmail = `${"a".repeat(EMAIL_MAX_LENGTH - "@mou.invalid".length)}@mou.invalid`
		expect(loginNameOf({ [LOGIN_NAME_CLAIM]: longestName }, LOGIN_NAME_CLAIM)).toBe(longestName)
		expect(loginNameOf({ [LOGIN_NAME_CLAIM]: `${longestName}a` }, LOGIN_NAME_CLAIM)).toBeUndefined()
		expect(emailOf({ [EMAIL_CLAIM]: longestEmail }, EMAIL_CLAIM)).toBe(longestEmail)
		expect(emailOf({ [EMAIL_CLAIM]: `a${longestEmail}` }, EMAIL_CLAIM)).toBeUndefined()
	})
})
