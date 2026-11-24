import { AUDIT_EVENT_TYPE } from "@ansora/contracts"
import { useCallback } from "react"
import { callApi, withQuery } from "@/api/client"
import { auditQueryOf, isFiltered } from "@/features/audit/lib/audit-filter"
import type {
	AuditChainCheck,
	AuditExport,
	AuditExportRequest,
	AuditExportStatus,
	AuditFilter,
	AuditRecord,
	AuditRecordsPage,
} from "@/features/audit/types/audit.types"
import { LIVE_REFRESH_SECONDS, useLiveRefresh } from "@/lib/live-refresh"
import { type CursorList, useCursorList } from "@/lib/use-cursor-list"
import { type LiveRequest, useLiveRequest } from "@/lib/use-live-request"
import { type RequestState, useRequest } from "@/lib/use-request"

const AUDIT_PATH = "/audit"
const LATEST_ONLY = "1"

// CAP-028-R14
export function useAuditRecords(filter: AuditFilter): CursorList<AuditRecord> {
	const loadPage = useCallback(
		(cursor: string | undefined, init?: RequestInit) =>
			callApi<AuditRecordsPage>(withQuery(AUDIT_PATH, { ...auditQueryOf(filter), cursor }), init),
		[filter],
	)
	const list = useCursorList(loadPage)
	useLiveRefresh(list.refresh, LIVE_REFRESH_SECONDS, !isFiltered(filter))
	return list
}

function loadExportStatus(init: RequestInit | undefined): Promise<AuditExportStatus> {
	return callApi<AuditExportStatus>(`${AUDIT_PATH}/export-status`, init)
}

// CAP-025-R08, CAP-025-S03, CAP-028-R14
export function useAuditExportStatus(): LiveRequest<AuditExportStatus> {
	return useLiveRequest(loadExportStatus)
}

async function loadLatestChainBreak(): Promise<AuditRecord | null> {
	const page = await callApi<AuditRecordsPage>(
		withQuery(AUDIT_PATH, { event_type: AUDIT_EVENT_TYPE.AUDIT_CHAIN_BROKEN, limit: LATEST_ONLY }),
	)
	return page.items?.[0] ?? null
}

// CAP-025-R21
export function useLatestChainBreak(): RequestState<AuditRecord | null> {
	return useRequest(loadLatestChainBreak)
}

export function checkAuditChain(): Promise<AuditChainCheck> {
	return callApi<AuditChainCheck>(`${AUDIT_PATH}/chain-check`)
}

// NAB-351, NAB-442
export function requestAuditExport(request: AuditExportRequest): Promise<AuditExport> {
	return callApi<AuditExport>(`${AUDIT_PATH}/export`, { method: "POST", body: JSON.stringify(request) })
}
