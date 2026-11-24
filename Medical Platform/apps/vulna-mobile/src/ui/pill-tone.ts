export const PILL_TONE = {
	INFO: "info",
	WARN: "warn",
	SUCCESS: "success",
	NEUTRAL: "neutral",
} as const

export type PillTone = (typeof PILL_TONE)[keyof typeof PILL_TONE]
