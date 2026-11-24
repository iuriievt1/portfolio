import type { AcquisitionDraft } from "../../api/acquisitions"
import { isChangedOnlyInFiles } from "../capture/draft-conflict"

type DraftFiles = Pick<AcquisitionDraft, "files">

// CAP-015-R35, CAP-018-R11
export function keysInSequence(files: AcquisitionDraft["files"]): string[] {
	return [...files].sort((first, second) => first.sequence - second.sequence).map((file) => file.file_key)
}

// CAP-021-R32, CAP-018-S10
export function isKeyOrderKept(knownOrder: readonly string[], freshOrder: readonly string[]): boolean {
	const knownCommon = knownOrder.filter((fileKey) => freshOrder.includes(fileKey))
	const freshCommon = freshOrder.filter((fileKey) => knownCommon.includes(fileKey))
	return knownCommon.every((fileKey, index) => freshCommon[index] === fileKey)
}

// CAP-021-R32, CAP-018-S10
export function isOrderKept(known: DraftFiles, fresh: DraftFiles): boolean {
	return isKeyOrderKept(keysInSequence(known.files), keysInSequence(fresh.files))
}

// CAP-021-R32, CAP-015-R35, E115
export function isChangedOnlyByUploads(
	known: AcquisitionDraft,
	fresh: AcquisitionDraft,
	ownKeys: readonly string[],
): boolean {
	const knownKeys = known.files.map((file) => file.file_key)
	const freshKeys = fresh.files.map((file) => file.file_key)
	const isNothingRemoved = knownKeys.every((fileKey) => freshKeys.includes(fileKey))
	const isEveryNewFileOwn = freshKeys.every((fileKey) => knownKeys.includes(fileKey) || ownKeys.includes(fileKey))
	return isChangedOnlyInFiles(known, fresh) && isNothingRemoved && isEveryNewFileOwn && isOrderKept(known, fresh)
}
