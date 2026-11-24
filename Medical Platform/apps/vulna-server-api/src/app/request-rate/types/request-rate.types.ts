export interface RequestWindow {
	startedAt: number
	count: number
}

export type RequestRateVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number }
