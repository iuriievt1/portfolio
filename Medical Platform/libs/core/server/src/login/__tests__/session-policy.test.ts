import { describe, expect, it } from "vitest"
import { secondsAfter } from "../secret"
import { isSessionActive, isTokenActive, tokenExpiresAt } from "../session-policy"

const NOW = new Date("2026-09-30T10:00:00.000Z")
const POLICY = { sessionMaxSeconds: 8 * 3600, tokenValiditySeconds: 900 }
const SESSION_END = secondsAfter(NOW, POLICY.sessionMaxSeconds)

describe("session policy", () => {
	it("never lets a token outlive the session", () => {
		expect(tokenExpiresAt(NOW, SESSION_END, POLICY).toISOString()).toBe("2026-09-30T10:15:00.000Z")
		const late = new Date(SESSION_END.getTime() - 60_000)
		expect(tokenExpiresAt(late, SESSION_END, POLICY)).toEqual(SESSION_END)
	})

	it("treats an ended or run-out session as inactive", () => {
		expect(isSessionActive({ endedAt: null, sessionEnd: SESSION_END }, NOW)).toBe(true)
		expect(isSessionActive({ endedAt: NOW, sessionEnd: SESSION_END }, NOW)).toBe(false)
		expect(isSessionActive({ endedAt: null, sessionEnd: SESSION_END }, SESSION_END)).toBe(false)
	})

	it("treats a token at its expiry as inactive", () => {
		const expiresAt = tokenExpiresAt(NOW, SESSION_END, POLICY)
		expect(isTokenActive({ tokenExpiresAt: expiresAt }, NOW)).toBe(true)
		expect(isTokenActive({ tokenExpiresAt: expiresAt }, expiresAt)).toBe(false)
	})
})
