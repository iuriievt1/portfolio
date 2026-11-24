import { MILLISECONDS_PER_SECOND, secondsAfter } from "./secret"

export const MAX_ATTEMPT_DELAY_SECONDS = 60

export function attemptsExhausted(consecutiveFailures: number, limit: number): boolean {
	return consecutiveFailures >= limit
}

export function nextAttemptDelaySeconds(consecutiveFailures: number, baseSeconds: number): number {
	if (consecutiveFailures <= 0 || baseSeconds <= 0) {
		return 0
	}
	return Math.min(baseSeconds * 2 ** (consecutiveFailures - 1), MAX_ATTEMPT_DELAY_SECONDS)
}

export function remainingDelaySeconds(lastFailedAt: Date | undefined, delaySeconds: number, now: Date): number {
	if (lastFailedAt === undefined || delaySeconds <= 0) {
		return 0
	}
	const allowedAt = secondsAfter(lastFailedAt, delaySeconds).getTime()
	return Math.max(0, Math.ceil((allowedAt - now.getTime()) / MILLISECONDS_PER_SECOND))
}
