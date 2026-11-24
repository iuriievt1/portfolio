import { ERROR_CODE } from "@ansora/contracts"
import { ApiProblemError, errorCodeOf } from "../../api/api-error"
import { HTTP_STATUS } from "../../api/http-status"
import { ImageLinkError } from "../../api/image-link-error"
import { isNotFound, type RemoteFailure, remoteFailureOf } from "../../api/remote-failure"

export const FULL_IMAGE = {
	LOADING: "loading",
	SHOWN: "shown",
	GONE: "gone",
	MISSING: "missing",
	UNAVAILABLE: "unavailable",
	FAILED: "failed",
} as const

export type FullImageState =
	| { kind: typeof FULL_IMAGE.LOADING }
	| { kind: typeof FULL_IMAGE.SHOWN; uri: string; isViewingCopy: boolean }
	| { kind: typeof FULL_IMAGE.GONE }
	| { kind: typeof FULL_IMAGE.MISSING }
	| { kind: typeof FULL_IMAGE.UNAVAILABLE }
	| { kind: typeof FULL_IMAGE.FAILED; failure: RemoteFailure }

export const THUMBNAIL = {
	LOADING: "loading",
	SHOWN: "shown",
	UNAVAILABLE: "unavailable",
	MISSING: "missing",
} as const

export type ThumbnailState =
	| { kind: typeof THUMBNAIL.LOADING }
	| { kind: typeof THUMBNAIL.SHOWN; uri: string }
	| { kind: typeof THUMBNAIL.UNAVAILABLE }
	| { kind: typeof THUMBNAIL.MISSING }

// CAP-020-R15, CAP-020-R22, E124, E125
export function fullImageFailureOf(failure: unknown): FullImageState {
	if (failure instanceof ApiProblemError && failure.status === HTTP_STATUS.GONE) {
		return { kind: FULL_IMAGE.GONE }
	}
	if (isNotFound(failure)) {
		return { kind: FULL_IMAGE.MISSING }
	}
	if (isSourceUnavailable(failure)) {
		return { kind: FULL_IMAGE.UNAVAILABLE }
	}
	return { kind: FULL_IMAGE.FAILED, failure: remoteFailureOf(failure) }
}

// CAP-020-R10, CAP-020-R22, E125
export function thumbnailFailureOf(failure: unknown): ThumbnailState {
	return isSourceUnavailable(failure) ? { kind: THUMBNAIL.UNAVAILABLE } : { kind: THUMBNAIL.MISSING }
}

// CAP-020-R22, ADR-054
function isSourceUnavailable(failure: unknown): boolean {
	return failure instanceof ImageLinkError || errorCodeOf(failure) === ERROR_CODE.IMAGE_SOURCE_UNAVAILABLE
}
