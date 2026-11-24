import { retryDelayOf } from "./upload-outcome"

// CAP-019-R13, CAP-019-R18, RFC 9110
export class RetryTimers {
	private readonly attempts = new Map<string, number>()
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()

	isResting(key: string): boolean {
		return this.timers.has(key)
	}

	rest(key: string, retryAfterMs: number | undefined, wake: () => void): number {
		const attempt = this.attempts.get(key) ?? 0
		this.attempts.set(key, attempt + 1)
		clearTimeout(this.timers.get(key))
		const timer = setTimeout(
			() => {
				this.timers.delete(key)
				wake()
			},
			retryDelayOf(attempt, retryAfterMs),
		)
		this.timers.set(key, timer)
		return attempt
	}

	forget(key: string): void {
		this.attempts.delete(key)
		clearTimeout(this.timers.get(key))
		this.timers.delete(key)
	}

	stopAll(): void {
		for (const timer of this.timers.values()) {
			clearTimeout(timer)
		}
		this.timers.clear()
	}

	restart(): void {
		this.stopAll()
		this.attempts.clear()
	}
}
