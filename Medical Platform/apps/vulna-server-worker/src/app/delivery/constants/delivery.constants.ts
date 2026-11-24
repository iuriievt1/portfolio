export const DELIVERY_TASK_POLL_MILLISECONDS = 5000

export const DELIVERY_ARCHIVE_FACTORY = Symbol("DELIVERY_ARCHIVE_FACTORY")

// datovy-model.md 8, CAP-023-R07, CAP-023-R13
export const VERIFICATION_LEVEL = {
	IMAGE: "image",
	STUDY: "study",
} as const

// CAP-023-R25, dorucovaci-jadro.md 5.4
export const TAKEN_OVER_RESULT = "taken_over"

export const NO_DELAY_MILLISECONDS = 0

export const TASK_ACTION = {
	COMPLETE: "complete",
	FAIL: "fail",
	WAIT: "wait",
} as const

// dorucovaci-jadro.md 5.3
export const TARGET_CHANGE = {
	UNAVAILABLE: "unavailable",
	PAUSED: "paused",
} as const
