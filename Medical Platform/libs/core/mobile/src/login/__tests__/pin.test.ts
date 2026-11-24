import { describe, expect, it } from "vitest"
import {
	acceptsPinDigit,
	isPinEntryComplete,
	newPinViolation,
	PIN_COMPLEXITY,
	PIN_POLICY_VIOLATION,
	pinPolicyOf,
	pinProofChallenge,
} from "../pin"

describe("PIN on the device", () => {
	it("CAP-001-S23 confirms from the fourth digit and refuses the ninth", () => {
		expect(isPinEntryComplete("123")).toBe(false)
		expect(isPinEntryComplete("1234")).toBe(true)
		expect(isPinEntryComplete("12345678")).toBe(true)
		expect(acceptsPinDigit("1234567")).toBe(true)
		expect(acceptsPinDigit("12345678")).toBe(false)
		expect(isPinEntryComplete("12a4")).toBe(false)
	})

	it("CAP-001-S24 refuses a new PIN shorter than the policy of the administrator", () => {
		const policy = pinPolicyOf(6)
		expect(newPinViolation("20481", policy)).toBe(PIN_POLICY_VIOLATION.TOO_SHORT)
		expect(newPinViolation("204817", policy)).toBeUndefined()
		expect(newPinViolation("204817359", policy)).toBe(PIN_POLICY_VIOLATION.TOO_LONG)
		expect(newPinViolation("20481x", policy)).toBe(PIN_POLICY_VIOLATION.NOT_DIGITS)
	})

	it("refuses the PINs anyone tries first under the standard complexity", () => {
		const policy = pinPolicyOf(6)
		expect(policy.complexity).toBe(PIN_COMPLEXITY.STANDARD)
		expect(newPinViolation("111111", policy)).toBe(PIN_POLICY_VIOLATION.REPEATED_DIGIT)
		expect(newPinViolation("000000", policy)).toBe(PIN_POLICY_VIOLATION.REPEATED_DIGIT)
		expect(newPinViolation("123456", policy)).toBe(PIN_POLICY_VIOLATION.SEQUENTIAL)
		expect(newPinViolation("654321", policy)).toBe(PIN_POLICY_VIOLATION.SEQUENTIAL)
		expect(newPinViolation("456789", policy)).toBe(PIN_POLICY_VIOLATION.SEQUENTIAL)
		expect(newPinViolation("010101", policy)).toBe(PIN_POLICY_VIOLATION.REPEATED_PATTERN)
		expect(newPinViolation("123123", policy)).toBe(PIN_POLICY_VIOLATION.REPEATED_PATTERN)
		expect(newPinViolation("1212", pinPolicyOf(4))).toBe(PIN_POLICY_VIOLATION.REPEATED_PATTERN)
		expect(newPinViolation("135790", policy)).toBeUndefined()
		expect(newPinViolation("204817", policy)).toBeUndefined()
		expect(newPinViolation("123457", policy)).toBeUndefined()
		expect(newPinViolation("112233", policy)).toBeUndefined()
	})

	it("lets the administrator switch the complexity off and ignores an unknown value", () => {
		expect(newPinViolation("111111", pinPolicyOf(6, PIN_COMPLEXITY.NONE))).toBeUndefined()
		expect(pinPolicyOf(6, "whatever").complexity).toBe(PIN_COMPLEXITY.STANDARD)
	})

	it("CAP-001-S27 keeps the minimum inside 4 to 8 and falls back to six", () => {
		expect(pinPolicyOf(undefined).minimumLength).toBe(6)
		expect(pinPolicyOf(3).minimumLength).toBe(4)
		expect(pinPolicyOf(9).minimumLength).toBe(8)
		expect(pinPolicyOf(4.9).minimumLength).toBe(4)
	})

	it("CAP-001-S25 CAP-001-S26 lets a PIN shorter than the policy be entered and sent to the server", () => {
		expect(isPinEntryComplete("2048")).toBe(true)
		expect(newPinViolation("2048", pinPolicyOf(6))).toBe(PIN_POLICY_VIOLATION.TOO_SHORT)
	})

	it("hands the challenge to the native proof with the time in seconds", () => {
		const now = () => new Date("2026-09-30T10:00:00.000Z")
		expect(pinProofChallenge({ challenge_id: "id", value: "nonce" }, now)).toEqual({
			challengeId: "id",
			value: "nonce",
			issuedAt: 1_790_762_400,
		})
	})
})
