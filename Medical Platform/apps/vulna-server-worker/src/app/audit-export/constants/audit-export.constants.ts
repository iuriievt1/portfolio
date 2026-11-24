export const EXPORT_BATCH_SIZE = 100
export const EXPORT_POLL_MILLISECONDS = 5000
export const EXPORT_RETRY_MILLISECONDS = 30_000
export const EXPORT_LOCK_NAME = "audit_export"
export const EXPORT_CURSOR_ID = 1
export const AUDIT_SINK_FACTORY = Symbol("AUDIT_SINK_FACTORY")

export const EXPORT_CYCLE = {
	MORE_WAITING: "more_waiting",
	CAUGHT_UP: "caught_up",
	NOT_CONFIGURED: "not_configured",
	FAILED: "failed",
	HELD_ELSEWHERE: "held_elsewhere",
} as const

export type ExportCycle = (typeof EXPORT_CYCLE)[keyof typeof EXPORT_CYCLE]
