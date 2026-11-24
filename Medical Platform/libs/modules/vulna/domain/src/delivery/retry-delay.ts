const GROWTH = 2
const FIRST_ATTEMPT = 1

export interface RetryBackoff {
	minimumSeconds: number
	maximumSeconds: number
}

// dorucovaci-jadro.md 5, konfigurace-a-profily.md 2.7, CAP-023-R10
export function deliveryRetryDelaySeconds(attempts: number, backoff: RetryBackoff): number {
	const exponent = Math.max(0, attempts - FIRST_ATTEMPT)
	return Math.min(backoff.maximumSeconds, backoff.minimumSeconds * GROWTH ** exponent)
}
