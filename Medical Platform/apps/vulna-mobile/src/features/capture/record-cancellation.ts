import { ERROR_CODE } from "@ansora/contracts"
import type { BufferedFile } from "@ansora/core-mobile"
import type { AcquisitionDraftFile } from "../../api/acquisition-files"
import { errorCodeOf } from "../../api/api-error"
import { isNotFound, type RemoteFailure, remoteFailureOf } from "../../api/remote-failure"
import { recordFileCountOf } from "../summary/shown-file"

export const RECORD_CANCELLATION = {
	IDLE: "idle",
	ASKING: "asking",
	CANCELLING: "cancelling",
	CHANGED: "changed",
	FAILED: "failed",
} as const

export type RecordCancellation =
	| { kind: typeof RECORD_CANCELLATION.IDLE }
	| { kind: typeof RECORD_CANCELLATION.ASKING }
	| { kind: typeof RECORD_CANCELLATION.CANCELLING }
	| { kind: typeof RECORD_CANCELLATION.CHANGED }
	| { kind: typeof RECORD_CANCELLATION.FAILED; failure: RemoteFailure }

const NO_FILES = 0

const DECIDED_ELSEWHERE: ReadonlySet<string | undefined> = new Set([
	ERROR_CODE.ACQUISITION_HAS_FILES,
	ERROR_CODE.ACQUISITION_CLOSED,
])

// CAP-015-R37, CAP-015-S55, E119
export function isRecordEmpty(
	local: readonly BufferedFile[],
	server: readonly AcquisitionDraftFile[],
	shots: readonly string[],
): boolean {
	return recordFileCountOf(local, server, undefined) + shots.length === NO_FILES
}

// CAP-015-R37, CAP-002-R17, E70, E115
export function cancellationStateOfError(error: unknown): RecordCancellation {
	if (DECIDED_ELSEWHERE.has(errorCodeOf(error)) || isNotFound(error)) {
		return { kind: RECORD_CANCELLATION.CHANGED }
	}
	return { kind: RECORD_CANCELLATION.FAILED, failure: remoteFailureOf(error) }
}
