import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it, vi } from "vitest"
import type { AcquisitionDraft } from "../../../api/acquisitions"
import { ApiProblemError } from "../../../api/api-error"
import { CONFLICT_RETRY_ATTEMPTS, isVersionConflict, retryAfterConflict } from "../conflict-retry"

const CONFLICT_STATUS = 409
const UNPROCESSABLE_STATUS = 422
const SERVER_ERROR_STATUS = 503
const FIRST_VERSION = 3
const CONFLICTS_BEFORE_SAVE = 2

const draftOf = (version: number) => ({ acquisition_id: "record", version, files: [] }) as unknown as AcquisitionDraft
const conflict = () => new ApiProblemError(CONFLICT_STATUS, ERROR_CODE.ACQUISITION_VERSION_CONFLICT)
const rejection = () => new ApiProblemError(UNPROCESSABLE_STATUS, ERROR_CODE.RECORD_REJECTED)
const isConflictOrRejection = (error: unknown) =>
	isVersionConflict(error) || (error as { code?: string }).code === ERROR_CODE.RECORD_REJECTED

function freshVersions() {
	let version = FIRST_VERSION
	return vi.fn(async () => {
		version += 1
		return draftOf(version)
	})
}

function failing(error: () => Error) {
	return vi.fn(async (_draft: AcquisitionDraft): Promise<string> => {
		throw error()
	})
}

describe("work retried after a version conflict", () => {
	it("E115 repeats the work on each fresh version while the change allows it", async () => {
		const versions: number[] = []
		const work = vi.fn(async (draft: AcquisitionDraft) => {
			versions.push(draft.version)
			if (versions.length <= CONFLICTS_BEFORE_SAVE) {
				throw conflict()
			}
			return "saved"
		})
		const isRetryable = vi.fn(() => true)

		const result = await retryAfterConflict(draftOf(FIRST_VERSION), work, {
			isConflict: isVersionConflict,
			refresh: freshVersions(),
			isRetryable,
		})

		expect(result).toBe("saved")
		expect(versions).toEqual([FIRST_VERSION, FIRST_VERSION + 1, FIRST_VERSION + 2])
		expect(isRetryable.mock.calls).toEqual([[draftOf(FIRST_VERSION + 1)], [draftOf(FIRST_VERSION + 2)]])
	})

	it("CAP-021-R32 gives up with the conflict when the record changed in another way", async () => {
		const work = failing(conflict)

		await expect(
			retryAfterConflict(draftOf(FIRST_VERSION), work, {
				isConflict: isVersionConflict,
				refresh: freshVersions(),
				isRetryable: async () => false,
			}),
		).rejects.toMatchObject({ code: ERROR_CODE.ACQUISITION_VERSION_CONFLICT })
		expect(work).toHaveBeenCalledTimes(1)
	})

	it("CAP-021-R32 gives up at once when the fresh record has the version the work already had", async () => {
		const work = failing(rejection)
		const refresh = vi.fn(async () => draftOf(FIRST_VERSION))

		await expect(
			retryAfterConflict(draftOf(FIRST_VERSION), work, {
				isConflict: isConflictOrRejection,
				refresh,
				isRetryable: () => true,
			}),
		).rejects.toMatchObject({ code: ERROR_CODE.RECORD_REJECTED })
		expect(work).toHaveBeenCalledTimes(1)
		expect(refresh).toHaveBeenCalledTimes(1)
	})

	it("CAP-021-R32 passes any other failure on without reading the record again", async () => {
		const refresh = freshVersions()
		const work = failing(() => new ApiProblemError(SERVER_ERROR_STATUS, ERROR_CODE.RETRY))

		await expect(
			retryAfterConflict(draftOf(FIRST_VERSION), work, {
				isConflict: isVersionConflict,
				refresh,
				isRetryable: () => true,
			}),
		).rejects.toMatchObject({ code: ERROR_CODE.RETRY })
		expect(refresh).not.toHaveBeenCalled()
	})

	it("E115 stops after the last attempt and reports the conflict", async () => {
		const refresh = freshVersions()
		const work = failing(conflict)

		await expect(
			retryAfterConflict(draftOf(FIRST_VERSION), work, {
				isConflict: isVersionConflict,
				refresh,
				isRetryable: () => true,
			}),
		).rejects.toMatchObject({ code: ERROR_CODE.ACQUISITION_VERSION_CONFLICT })
		expect(work).toHaveBeenCalledTimes(CONFLICT_RETRY_ATTEMPTS)
		expect(refresh).toHaveBeenCalledTimes(CONFLICT_RETRY_ATTEMPTS - 1)
	})
})
