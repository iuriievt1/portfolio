import { ERROR_CODE } from "@ansora/contracts"
import type { BufferedFile } from "@ansora/core-mobile"
import { describe, expect, it, vi } from "vitest"
import { ApiProblemError, NoConnectionError } from "../../../api/api-error"
import { REMOTE_FAILURE } from "../../../api/remote-failure"
import { cancellationStateOfError, isRecordEmpty, RECORD_CANCELLATION } from "../record-cancellation"

vi.mock("@ansora/core-mobile", async () => ({
	...(await import("../../../../../../libs/core/mobile/src/storage/upload-status")),
	...(await import("../../../../../../libs/core/mobile/src/storage/transfer-buffer")),
}))

const HTTP_NOT_FOUND = 404
const HTTP_CONFLICT = 409
const HTTP_SERVER_ERROR = 500
const NO_SHOTS: readonly string[] = []

function localPhoto(fileKey: string): BufferedFile {
	return {
		fileKey,
		acquisitionId: "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10",
		operatorUserId: "operator",
		position: 1,
		kind: "image",
		contentFileId: `${fileKey}-content`,
		thumbnailFileId: `${fileKey}-thumbnail`,
		originalFileId: null,
		corners: null,
		width: 1,
		height: 1,
		capturedAt: "2026-10-23T08:58:00.000Z",
		uploadState: "waiting",
		sentContentFileId: null,
		receivedContentFileId: null,
		contentEdit: null,
		rejectionCode: null,
		editFailedContentFileId: null,
		replacesFileKey: null,
	}
}

describe("cancelling a record without a photo or a page CAP-015-R37", () => {
	it("CAP-015-S54 CAP-018-S11 offers to cancel a record that has no file on the device or on the server", () => {
		expect(isRecordEmpty([], [], NO_SHOTS)).toBe(true)
	})

	it("CAP-015-S55 does not offer it once a photo is taken, sent, or still being kept", () => {
		expect(isRecordEmpty([localPhoto("a")], [], NO_SHOTS)).toBe(false)
		expect(isRecordEmpty([], [{ file_key: "a", sequence: 1, status: "received" }], NO_SHOTS)).toBe(false)
		expect(isRecordEmpty([], [{ file_key: "b", sequence: 1, status: "announced" }], NO_SHOTS)).toBe(false)
		expect(isRecordEmpty([], [], ["c"])).toBe(false)
	})

	it("E115 shows that the record changed when the server holds a file, closed it, or no longer has it", () => {
		const changed = { kind: RECORD_CANCELLATION.CHANGED }

		expect(cancellationStateOfError(new ApiProblemError(HTTP_CONFLICT, ERROR_CODE.ACQUISITION_HAS_FILES))).toEqual(
			changed,
		)
		expect(cancellationStateOfError(new ApiProblemError(HTTP_CONFLICT, ERROR_CODE.ACQUISITION_CLOSED))).toEqual(changed)
		expect(cancellationStateOfError(new ApiProblemError(HTTP_NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND))).toEqual(
			changed,
		)
	})

	it("CAP-002-R17 E70 leaves the record as it is without a connection", () => {
		expect(cancellationStateOfError(new NoConnectionError(new TypeError("Network request failed")))).toEqual({
			kind: RECORD_CANCELLATION.FAILED,
			failure: REMOTE_FAILURE.NO_CONNECTION,
		})
		expect(cancellationStateOfError(new ApiProblemError(HTTP_SERVER_ERROR, undefined))).toEqual({
			kind: RECORD_CANCELLATION.FAILED,
			failure: REMOTE_FAILURE.SERVER_ERROR,
		})
	})
})
