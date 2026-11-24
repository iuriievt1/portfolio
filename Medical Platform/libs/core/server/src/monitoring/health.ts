// provoz-a-dohled.md 2, CAP-028-R05, CAP-028-R06
export const HEALTH_PATH = "health"
export const DEPENDENCIES_HEALTH_PATH = `${HEALTH_PATH}/dependencies`
// CAP-028-R09, CAP-028-R10
export const SURVEILLANCE_METRICS_PATH = "metrics"

// CAP-028-R06, CAP-028-R08
export const HEALTH_STATUS = {
	OK: "ok",
	UNAVAILABLE: "unavailable",
} as const

export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS]
