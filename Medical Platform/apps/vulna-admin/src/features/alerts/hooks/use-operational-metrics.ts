import { useCallback } from "react"
import { callApi } from "@/api/client"
import type { OperationalMetrics } from "@/features/alerts/types/alert.types"
import { useLiveRequest } from "@/lib/use-live-request"

const METRICS_PATH = "/monitoring/metrics"

export interface OperationalMetricsState {
	metrics: OperationalMetrics | undefined
	hasFailed: boolean
}

// CAP-028-R13, CAP-028-R14
export function useOperationalMetrics(): OperationalMetricsState {
	const load = useCallback((init: RequestInit | undefined) => callApi<OperationalMetrics>(METRICS_PATH, init), [])
	const { data, error } = useLiveRequest(load)
	return { metrics: data, hasFailed: error !== undefined }
}
