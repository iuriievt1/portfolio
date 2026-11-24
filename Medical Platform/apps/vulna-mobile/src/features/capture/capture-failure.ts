import { NATIVE_ERROR_CODE } from "@ansora/core-mobile"
import { errorCodeOf } from "../../api/api-error"
import { type RemoteFailure, remoteFailureOf } from "../../api/remote-failure"
import { isVersionConflict } from "./conflict-retry"

export const CAPTURE_FAILURE = {
	QUEUE_FULL: "queue_full",
	STORAGE_FULL: "storage_full",
	UNREADABLE: "unreadable",
	CHANGED: "changed",
	CAMERA_UNAVAILABLE: "camera_unavailable",
} as const

export type CaptureFailure = (typeof CAPTURE_FAILURE)[keyof typeof CAPTURE_FAILURE] | RemoteFailure

// E17, E18
export function captureFailureOf(error: unknown): CaptureFailure {
	return errorCodeOf(error) === NATIVE_ERROR_CODE.STORAGE_FULL
		? CAPTURE_FAILURE.STORAGE_FULL
		: CAPTURE_FAILURE.UNREADABLE
}

// CAP-002-R17, E70, E115
export function remoteCaptureFailureOf(error: unknown): CaptureFailure {
	return isVersionConflict(error) ? CAPTURE_FAILURE.CHANGED : remoteFailureOf(error)
}
