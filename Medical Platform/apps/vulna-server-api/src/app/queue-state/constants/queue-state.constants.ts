// clinical-workflow.yaml getQueueState, reportQueueState
export const QUEUE_PATH = "queue"
export const STATE_SUBPATH = "state"
export const REPORTS_SUBPATH = "reports"

// CAP-002-R09, CAP-019-R30
export const QUEUE_CALLER = {
	USER: "user",
	DEVICE: "device",
} as const
