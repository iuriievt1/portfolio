import type { Classification, OutcomeClass, RetryPolicy } from "@ansora/vulna-adapter-dicom-dimse"
import { REJECT_RESULT, REJECT_SOURCE } from "../pdu"
import { hexWord } from "../wire/recorder"

// integrace-dicom.md 8, 8.1, 8.2, 8.3, 11, dorucovaci-jadro.md 5, ADR-005 ř. 25–39

// integrace-dicom.md 8 K, B, U, P
type Flag = "K" | "B" | "U" | "P"

export interface GoldenStatus {
	status: number
	classification: Classification
}

export interface GoldenRejection {
	result: number
	source: number
	reason: number
	classification: Classification
}

function golden(
	outcomeClass: OutcomeClass,
	retryPolicy: RetryPolicy,
	flags: readonly Flag[],
	ruleId: string,
): Classification {
	return {
		outcomeClass,
		retryPolicy,
		retentionAnchor: flags.includes("K"),
		clinicalSafetyQueue: flags.includes("B"),
		alertAdmin: flags.includes("U"),
		pauseTarget: flags.includes("P"),
		ruleId,
	}
}

// integrace-dicom.md 8.1, CS tab. 2.15
export const STORE_SUCCESS_GOLDEN = golden("success", "never", ["K"], "STORE.0000")
export const STORE_GOLDEN: readonly GoldenStatus[] = [
	{ status: 0x00_00, classification: STORE_SUCCESS_GOLDEN },
	{ status: 0xa7_00, classification: golden("transient", "backoff", [], "STORE.A700") },
	{ status: 0xa7_01, classification: golden("transient", "backoff", [], "STORE.A701") },
	{ status: 0xa7_04, classification: golden("transient", "backoff", [], "STORE.A704") },
	{ status: 0xc0_01, classification: golden("transient", "verify-then-retry", [], "STORE.C001") },
	{ status: 0xa7_02, classification: golden("configuration", "never", ["U", "P"], "STORE.A702") },
	{ status: 0xa7_03, classification: golden("configuration", "never", ["U", "P"], "STORE.A703") },
	{ status: 0xa7_05, classification: golden("configuration", "never", ["U", "P"], "STORE.A705") },
	{ status: 0xa7_06, classification: golden("configuration", "never", ["U", "P"], "STORE.A706") },
	{ status: 0xa9_00, classification: golden("data", "never", ["B", "U"], "STORE.A900") },
	{ status: 0xc0_00, classification: golden("data", "never", ["B", "U"], "STORE.C000") },
	{ status: 0xc0_03, classification: golden("data", "never", ["B", "U"], "STORE.C003") },
	{ status: 0xc0_04, classification: golden("data", "never", ["B", "U"], "STORE.C004") },
	{ status: 0xc0_02, classification: golden("identity-conflict", "never", ["B", "U"], "STORE.C002") },
	{ status: 0x01_22, classification: golden("configuration", "never", ["U", "P"], "STORE.0122") },
	...[0xb0_00, 0xb0_06, 0xb0_07, 0xbf_ff].map((status) => ({
		status,
		classification: golden("success-with-warning", "never", ["K", "U"], "STORE.Bxxx"),
	})),
	...[0x00_01, 0x01_07, 0xa7_ff, 0xaf_ff, 0xc0_05].map((status) => ({
		status,
		classification: golden("undocumented-status", "never", ["U"], "STORE.UNDOCUMENTED"),
	})),
]
// integrace-dicom.md 8.1, 8.3, ADR-005 ř. 33
export const STORE_UNKNOWN_GOLDEN = golden("unknown-outcome", "verify-then-retry", [], "STORE.UNKNOWN")
export const STORE_NOT_SENT_GOLDEN = golden("transient", "backoff", [], "STORE.NOT_SENT")
// integrace-dicom.md 8.1, CAP-023-R09
export const STORE_ARTIFACT_INTEGRITY_GOLDEN = golden("data", "never", ["B", "U"], "LOCAL.ARTIFACT_INTEGRITY")
// integrace-dicom.md 8.1, 8.3, CAP-023-R16
export const STORE_NO_CONTEXT_GOLDEN = golden("configuration", "never", ["U", "P"], "STORE.NO_ACCEPTED_TRANSFER_SYNTAX")

// integrace-dicom.md 8.2, CS tab. 2.19
export const FIND_SUCCESS_GOLDEN = golden("success", "never", [], "FIND.0000")
export const FIND_GOLDEN: readonly GoldenStatus[] = [
	{ status: 0xa7_00, classification: golden("incomplete-result", "backoff", [], "FIND.A700") },
	{ status: 0xfe_00, classification: golden("incomplete-result", "backoff", [], "FIND.FE00") },
	{ status: 0xc0_00, classification: golden("incomplete-result", "backoff", ["U"], "FIND.C000") },
	{ status: 0xa9_00, classification: golden("data", "never", ["U"], "FIND.A900") },
	{ status: 0xc0_01, classification: golden("configuration", "never", ["U", "P"], "FIND.C001") },
	{ status: 0xa7_ff, classification: golden("undocumented-status", "never", ["U"], "FIND.A7FF") },
	{ status: 0x01_22, classification: golden("undocumented-status", "never", ["U"], "FIND.0122") },
]
// integrace-dicom.md 8.2, CS tab. 2.26
export const WORKLIST_NOT_AUTHORIZED: GoldenStatus = {
	status: 0xc0_01,
	classification: golden("undocumented-status", "never", ["U"], "FIND.C001"),
}
// integrace-dicom.md 8.2
export const FIND_NO_FINAL_RESPONSE_GOLDEN = golden("incomplete-result", "backoff", [], "FIND.NO_FINAL_RESPONSE")
// integrace-dicom.md 6.4, 8.2, ADR-005 ř. 39, CAP-024-R08 (?)
export const FIND_CANCELLED_GOLDEN = golden("incomplete-result", "backoff", [], "FIND.CANCELLED")
// integrace-dicom.md 8.2 A900 (?)
export const FIND_INVALID_QUERY_GOLDEN = golden("data", "never", ["U"], "FIND.INVALID_QUERY")

// integrace-dicom.md 8.3, NAB-354
export const ECHO_SUCCESS_GOLDEN = golden("success", "never", [], "ECHO.0000")
export const ECHO_GOLDEN: readonly GoldenStatus[] = [
	{ status: 0x00_00, classification: ECHO_SUCCESS_GOLDEN },
	{ status: 0x01_10, classification: golden("undocumented-status", "never", ["U"], "ECHO.0110") },
	{ status: 0xa7_00, classification: golden("undocumented-status", "never", ["U"], "ECHO.A700") },
]
// integrace-dicom.md 6.2, 8.3, CAP-023-R24 (?)
export const ECHO_NOT_SENT_GOLDEN = golden("transient", "backoff", [], "ECHO.NOT_SENT")

// integrace-dicom.md 8.3, PS3.8 9.3.4
const { PERMANENT, TRANSIENT } = REJECT_RESULT
const { SERVICE_USER, SERVICE_PROVIDER_ACSE, SERVICE_PROVIDER_PRESENTATION } = REJECT_SOURCE

function rejection(result: number, source: number, reason: number): GoldenRejection {
	const ruleId = `RJ.${result}/${source}/${reason}`
	return {
		result,
		source,
		reason,
		classification:
			result === TRANSIENT
				? golden("transient", "backoff", [], ruleId)
				: golden("configuration", "never", ["U", "P"], ruleId),
	}
}

export const REJECTION_GOLDEN: readonly GoldenRejection[] = [
	rejection(PERMANENT, SERVICE_USER, 1),
	rejection(PERMANENT, SERVICE_USER, 2),
	rejection(PERMANENT, SERVICE_USER, 3),
	rejection(PERMANENT, SERVICE_USER, 7),
	rejection(PERMANENT, SERVICE_PROVIDER_ACSE, 1),
	rejection(PERMANENT, SERVICE_PROVIDER_PRESENTATION, 2),
	rejection(TRANSIENT, SERVICE_PROVIDER_ACSE, 2),
	rejection(TRANSIENT, SERVICE_PROVIDER_PRESENTATION, 1),
	rejection(TRANSIENT, SERVICE_PROVIDER_PRESENTATION, 2),
]

// integrace-dicom.md 11, dev/dicom/python/amis_emulator.py
export function storeScenario(status: number): string {
	return `STORE-${hexWord(status)}`
}

export function findScenario(status: number): string {
	return `FIND-${hexWord(status)}`
}

export function echoScenario(status: number): string {
	return `ECHO-${hexWord(status)}`
}

export function rejectScenario(rejected: { result: number; source: number; reason: number }): string {
	return `RJ-${rejected.result}-${rejected.source}-${rejected.reason}`
}
