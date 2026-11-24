import { type BufferedFile, FILE_CONDITION, SHOWN_FILE, type ShownFile, shownFilesOf } from "@ansora/core-mobile"
import type { AcquisitionDraftFile } from "../../api/acquisition-files"

// CAP-015-R35, CAP-015-R36, CAP-018-R14, Q-076
export type RecordFile = ShownFile<AcquisitionDraftFile>

// CAP-015-R18, CAP-015-R36, CAP-015-S51, Q-076
export function isOpenable(file: RecordFile): boolean {
	return file.kind === SHOWN_FILE.LOCAL || file.condition !== FILE_CONDITION.KEPT
}

// CAP-015-R13, CAP-018-R12, CAP-015-R36, CAP-019-S12
export function recordFileCountOf(
	local: readonly BufferedFile[],
	server: readonly AcquisitionDraftFile[],
	replacedKey: string | undefined,
): number {
	return shownFilesOf(local, server).filter((file) => file.fileKey !== replacedKey).length
}
