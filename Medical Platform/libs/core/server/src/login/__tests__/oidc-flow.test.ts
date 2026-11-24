import { describe, expect, it } from "vitest"
import { appReturnUrl, isAuthenticationFresh, newPkcePair, personalNumberOf } from "../oidc-flow"
import { sha256Base64url } from "../secret"

const STARTED_AT = new Date("2026-09-30T10:00:00.000Z")
const STARTED_SECONDS = Math.floor(STARTED_AT.getTime() / 1000)

describe("OIDC flow on the server", () => {
	it("keeps the PKCE verifier and hands out only its S256 challenge", () => {
		const pair = newPkcePair()
		expect(pair.codeChallenge).toBe(sha256Base64url(pair.codeVerifier))
	})

	it("CAP-001-S33 accepts only an ID token authenticated after the start of the flow, less the clock tolerance", () => {
		expect(isAuthenticationFresh(STARTED_SECONDS + 5, STARTED_AT)).toBe(true)
		expect(isAuthenticationFresh(STARTED_SECONDS - 60, STARTED_AT)).toBe(true)
		expect(isAuthenticationFresh(STARTED_SECONDS - 61, STARTED_AT)).toBe(false)
		expect(isAuthenticationFresh(undefined, STARTED_AT)).toBe(false)
	})

	it("CAP-001-S21 takes the personal number as the claim text, leading zeros included", () => {
		expect(personalNumberOf({ personal_number: "000101" }, "personal_number")).toBe("000101")
		expect(personalNumberOf({ personal_number: 4217 }, "personal_number")).toBe("4217")
		expect(personalNumberOf({ personal_number: "" }, "personal_number")).toBeUndefined()
		expect(personalNumberOf({}, "personal_number")).toBeUndefined()
	})

	it("CAP-001-S13 sends the app a state and a completion code by its own scheme", () => {
		expect(appReturnUrl("st ate", "co+de")).toBe("ansoravulna://login/oidc?state=st+ate&completion_code=co%2Bde")
	})
})
