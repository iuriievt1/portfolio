import { PIN_COMPLEXITY, type PinComplexity } from "@ansora/contracts"
import { epochSeconds } from "../device/device-proof"
import type { PinProofChallenge } from "../native"
import type { Challenge } from "./quick-login"

// CAP-001-R15
export const PIN_LENGTH = {
	MINIMUM: 4,
	MAXIMUM: 8,
} as const

export { PIN_COMPLEXITY, type PinComplexity } from "@ansora/contracts"

export const PIN_POLICY_VIOLATION = {
	NOT_DIGITS: "not_digits",
	TOO_SHORT: "too_short",
	TOO_LONG: "too_long",
	REPEATED_DIGIT: "repeated_digit",
	SEQUENTIAL: "sequential",
	REPEATED_PATTERN: "repeated_pattern",
} as const

export type PinPolicyViolation = (typeof PIN_POLICY_VIOLATION)[keyof typeof PIN_POLICY_VIOLATION]

export interface PinPolicy {
	minimumLength: number
	complexity: PinComplexity
}

const DIGITS = /^\d*$/

// CAP-001-R15
const DEFAULT_MINIMUM_LENGTH = 6
const DEFAULT_COMPLEXITY = PIN_COMPLEXITY.STANDARD

export function pinPolicyOf(minimumLength: number | undefined, complexity?: string): PinPolicy {
	const wanted = minimumLength ?? DEFAULT_MINIMUM_LENGTH
	return {
		minimumLength: Math.min(PIN_LENGTH.MAXIMUM, Math.max(PIN_LENGTH.MINIMUM, Math.trunc(wanted))),
		complexity: complexity === PIN_COMPLEXITY.NONE ? PIN_COMPLEXITY.NONE : DEFAULT_COMPLEXITY,
	}
}

export function isPinEntryComplete(pin: string): boolean {
	return DIGITS.test(pin) && pin.length >= PIN_LENGTH.MINIMUM && pin.length <= PIN_LENGTH.MAXIMUM
}

export function acceptsPinDigit(pin: string): boolean {
	return pin.length < PIN_LENGTH.MAXIMUM
}

export function newPinViolation(pin: string, policy: PinPolicy): PinPolicyViolation | undefined {
	if (!DIGITS.test(pin)) {
		return PIN_POLICY_VIOLATION.NOT_DIGITS
	}
	if (pin.length > PIN_LENGTH.MAXIMUM) {
		return PIN_POLICY_VIOLATION.TOO_LONG
	}
	if (pin.length < policy.minimumLength) {
		return PIN_POLICY_VIOLATION.TOO_SHORT
	}
	if (policy.complexity === PIN_COMPLEXITY.NONE) {
		return undefined
	}
	if (isRepeatedDigit(pin)) {
		return PIN_POLICY_VIOLATION.REPEATED_DIGIT
	}
	if (isSequential(pin)) {
		return PIN_POLICY_VIOLATION.SEQUENTIAL
	}
	if (isRepeatedPattern(pin)) {
		return PIN_POLICY_VIOLATION.REPEATED_PATTERN
	}
	return undefined
}

function isRepeatedDigit(pin: string): boolean {
	return [...pin].every((digit) => digit === pin[0])
}

function isSequential(pin: string): boolean {
	const steps = [...pin].slice(1).map((digit, index) => Number(digit) - Number(pin[index]))
	return steps.every((step) => step === 1) || steps.every((step) => step === -1)
}

function isRepeatedPattern(pin: string): boolean {
	for (let period = 1; period <= pin.length / 2; period++) {
		if (pin.length % period === 0 && pin === pin.slice(0, period).repeat(pin.length / period)) {
			return true
		}
	}
	return false
}

export function pinProofChallenge(
	challenge: Pick<Challenge, "challenge_id" | "value">,
	now: () => Date = () => new Date(),
): PinProofChallenge {
	return { challengeId: challenge.challenge_id, value: challenge.value, issuedAt: epochSeconds(now()) }
}
