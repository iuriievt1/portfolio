import { ERROR_CODE } from "@ansora/contracts"
import { orderedKeys } from "@ansora/core-mobile"
import { acquisitionFileApi } from "../../api/acquisition-files"
import type { AcquisitionDraft } from "../../api/acquisitions"
import { errorCodeOf } from "../../api/api-error"
import { captureSessionOf, keepUnlessForgotten, rememberDraft } from "../capture/capture-session"
import { retryAfterConflict } from "../capture/conflict-retry"
import { knownDraft, refreshDraft } from "../capture/draft-update"
import { sessionCaller } from "../session/session-actions"
import { cancelQueuedClosure } from "./closure-queue"
import { isChangedOnlyByUploads } from "./draft-files"

// CAP-021-R32, CAP-018-R11
const STALE_ANSWERS: ReadonlySet<string> = new Set([
	ERROR_CODE.ACQUISITION_VERSION_CONFLICT,
	ERROR_CODE.RECORD_REJECTED,
])

function isStaleAnswer(error: unknown): boolean {
	const code = errorCodeOf(error)
	return code !== undefined && STALE_ANSWERS.has(code)
}

function ownKeysOf(acquisitionId: string): string[] {
	return captureSessionOf(acquisitionId).photos.map((photo) => photo.fileKey)
}

// CAP-021-R32, CAP-015-R35, E115
async function withKnownVersion<T>(
	acquisitionId: string,
	work: (draft: AcquisitionDraft) => Promise<T>,
	comparableOf: (known: AcquisitionDraft) => AcquisitionDraft = (known) => known,
): Promise<T> {
	const known = await knownDraft(acquisitionId)
	return await retryAfterConflict(known, work, {
		isConflict: isStaleAnswer,
		refresh: () => refreshDraft(acquisitionId),
		isRetryable: (fresh) => isChangedOnlyByUploads(comparableOf(known), fresh, ownKeysOf(acquisitionId)),
	})
}

// CAP-015-R18, CAP-018-R11, CAP-026-R17, CAP-019-R29, CAP-015-R35
export async function removeFileOnServer(acquisitionId: string, fileKey: string): Promise<void> {
	try {
		await withKnownVersion(
			acquisitionId,
			(draft) =>
				sessionCaller.call((sessionToken) => acquisitionFileApi.removeAcquisitionFile(sessionToken, draft, fileKey)),
			(known) => ({ ...known, files: known.files.filter((file) => file.file_key !== fileKey) }),
		)
	} catch (error) {
		if (errorCodeOf(error) !== ERROR_CODE.RESOURCE_NOT_FOUND) {
			throw error
		}
	}
	await cancelQueuedClosure(acquisitionId)
	await refreshDraft(acquisitionId).catch((failure: unknown) =>
		console.warn("the record could not be read again", failure),
	)
}

// CAP-018-R11, CAP-015-R33, CAP-015-R35, CAP-019-R29
export async function orderFilesOnServer(acquisitionId: string, fileKeys: readonly string[]): Promise<void> {
	await withKnownVersion(acquisitionId, async (draft) => {
		const order = orderedKeys(
			draft.files.map((file) => file.file_key),
			fileKeys,
		)
		if (order.length === 0) {
			return
		}
		await keepUnlessForgotten(
			() =>
				sessionCaller.call((sessionToken) => acquisitionFileApi.setAcquisitionFileOrder(sessionToken, draft, order)),
			rememberDraft,
		)
	})
	await cancelQueuedClosure(acquisitionId)
}
