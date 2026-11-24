import { type BufferedFile, FILE_CONDITION, type FileCondition, isRecordFile, UPLOAD_STATE } from "@ansora/core-mobile"
import type { Texts } from "../../i18n/texts"

// CAP-015-R36, CAP-009-S05, Q-076
export const RETAKE = {
	REJECTED: FILE_CONDITION.REJECTED,
	UNREADABLE: FILE_CONDITION.UNREADABLE,
} as const

export type Retake = (typeof RETAKE)[keyof typeof RETAKE]

// CAP-015-R36, CAP-009-S05, Q-076
export function retakeOfCondition(condition: FileCondition): Retake | undefined {
	switch (condition) {
		case FILE_CONDITION.REJECTED:
			return RETAKE.REJECTED
		case FILE_CONDITION.UNREADABLE:
			return RETAKE.UNREADABLE
		default:
			return undefined
	}
}

// CAP-015-R36, CAP-019-S18, CAP-009-S05, E113, Q-076
export function retakeOfFile(file: BufferedFile): Retake | undefined {
	if (!isRecordFile(file)) {
		return undefined
	}
	switch (file.uploadState) {
		case UPLOAD_STATE.REJECTED:
			return RETAKE.REJECTED
		case UPLOAD_STATE.UNREADABLE:
			return RETAKE.UNREADABLE
		default:
			return undefined
	}
}

// CAP-015-R36, CAP-019-S12, CAP-009-S05, Q-076
export async function retakeInPlace(
	retake: Retake,
	fileKey: string,
	removeFirst: () => Promise<boolean>,
	openCamera: (replacedKey: string | undefined) => void,
): Promise<void> {
	if (retake === RETAKE.REJECTED) {
		openCamera(fileKey)
		return
	}
	if (await removeFirst()) {
		openCamera(undefined)
	}
}

// E112, CAP-009-S05, Q-076
export function retakeMarkLabelOf(retake: Retake, texts: Texts): string {
	const closing = texts.capture.closing
	return retake === RETAKE.REJECTED ? closing.rejectedMark : closing.unreadableMark
}

// CAP-015-R35, CAP-015-R36, CAP-009-S05, E111, E112, Q-076
export function fileStateLabelOf(condition: FileCondition, texts: Texts): string | undefined {
	if (condition === FILE_CONDITION.ON_OTHER_DEVICE) {
		return texts.capture.closing.otherDeviceMark
	}
	const retake = retakeOfCondition(condition)
	return retake === undefined ? undefined : retakeMarkLabelOf(retake, texts)
}
