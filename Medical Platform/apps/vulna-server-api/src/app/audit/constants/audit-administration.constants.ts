import { ADMIN_API_BASE_PATH } from "@ansora/contracts"

export const EXPORT_CURSOR_ID = 1
export const CHAIN_READ_BATCH = 1000
export const EXPORT_READ_BATCH = 500
export const EXPORT_FILE_PREFIX = "vulna-audit"
export const ISO_DATE_LENGTH = "YYYY-MM-DD".length
export const CSV_CONTENT_TYPE = "text/csv; charset=utf-8"

export const AUDIT_BASE_PATH = `${ADMIN_API_BASE_PATH}/audit`
export const EXPORT_ID_PARAMETER = "exportId"

export const AUDIT_ROUTE = {
	CHAIN_CHECK: "chain-check",
	EXPORT_STATUS: "export-status",
	EXPORT: "export",
	EXPORT_FILE: `exports/:${EXPORT_ID_PARAMETER}/file`,
} as const

export function exportFileLink(exportId: string): string {
	return `${AUDIT_BASE_PATH}/${AUDIT_ROUTE.EXPORT_FILE.replace(`:${EXPORT_ID_PARAMETER}`, encodeURIComponent(exportId))}`
}
