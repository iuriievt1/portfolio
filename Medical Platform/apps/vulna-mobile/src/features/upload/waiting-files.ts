import { type BufferedFile, isFailed, isUploaded, UPLOAD_STATE, type UploadState } from "@ansora/core-mobile"

const WAITING_STATES: ReadonlySet<UploadState> = new Set([UPLOAD_STATE.WAITING, UPLOAD_STATE.UPLOADING])

// CAP-012-R25, CAP-019-R17, CAP-019-R23
export function waitingFileCountOf(files: readonly Pick<BufferedFile, "uploadState">[]): number {
	return files.filter((file) => WAITING_STATES.has(file.uploadState)).length
}

// CAP-019-R17, CAP-019-S13, E24
export function isQueueFull(files: readonly Pick<BufferedFile, "uploadState">[], limit: number | undefined): boolean {
	return limit !== undefined && waitingFileCountOf(files) >= limit
}

// CAP-019-R24, CAP-019-R14, CAP-015-R34, CAP-009-S05, Q-076
export function isAwaitingServer(file: BufferedFile): boolean {
	if (isFailed(file)) {
		return false
	}
	return !isUploaded(file)
}

// CAP-019-R29, E93
export function awaitedFilesOf(fileKeys: readonly string[], files: readonly BufferedFile[]): BufferedFile[] {
	return files.filter((file) => fileKeys.includes(file.fileKey) && isAwaitingServer(file))
}

// CAP-002-R14, CAP-002-S13
export function ownAwaitingFileCountOf(files: readonly BufferedFile[], userId: string): number {
	return files.filter((file) => file.operatorUserId === userId && isAwaitingServer(file)).length
}
