import { useCallback } from "react"
import { callApi, withQuery } from "@/api/client"
import { ALERT_VIEW, type AlertView } from "@/features/alerts/lib/alert-state"
import type { AdministratorAlert, AdministratorAlertsPage } from "@/features/alerts/types/alert.types"
import { useLiveRefresh } from "@/lib/live-refresh"
import { type CursorList, useCursorList } from "@/lib/use-cursor-list"

const ALERTS_PATH = "/monitoring/alerts"
const CLINICAL_RECORD_WRITES_PATH = "/monitoring/clinical-record-writes"
const ACTIVE_ONLY = "true"

// CAP-028-R14, CAP-028-R15
export function useAlerts(view: AlertView): CursorList<AdministratorAlert> {
	const loadPage = useCallback(
		(cursor: string | undefined, init?: RequestInit) =>
			callApi<AdministratorAlertsPage>(
				withQuery(ALERTS_PATH, { cursor, is_active: view === ALERT_VIEW.ACTIVE ? ACTIVE_ONLY : undefined }),
				init,
			),
		[view],
	)
	const list = useCursorList(loadPage)
	useLiveRefresh(list.refresh)
	return list
}

// CAP-023-R12, CHG-189
export function acknowledgeAlert(alertId: string): Promise<void> {
	return callApi<void>(`${ALERTS_PATH}/${encodeURIComponent(alertId)}/acknowledgement`, { method: "POST" })
}

// CAP-021-R27
export function requeueClinicalRecordWrite(taskId: string): Promise<void> {
	return callApi<void>(`${CLINICAL_RECORD_WRITES_PATH}/${encodeURIComponent(taskId)}/requeue`, { method: "POST" })
}
