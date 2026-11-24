import { NATIVE_ERROR_CODE } from "@ansora/core-mobile"
import { errorCodeOf } from "../../api/api-error"

export const SCAN_FAILURE = {
	QUEUE_FULL: "queue_full",
	STORAGE_FULL: "storage_full",
	UNREADABLE: "unreadable",
} as const

export type ScanFailure = (typeof SCAN_FAILURE)[keyof typeof SCAN_FAILURE]

// E17, E18
export function scanFailureOf(error: unknown): ScanFailure | undefined {
	switch (errorCodeOf(error)) {
		case NATIVE_ERROR_CODE.SCANNER_NOT_READY:
			return undefined
		case NATIVE_ERROR_CODE.STORAGE_FULL:
			return SCAN_FAILURE.STORAGE_FULL
		default:
			return SCAN_FAILURE.UNREADABLE
	}
}
