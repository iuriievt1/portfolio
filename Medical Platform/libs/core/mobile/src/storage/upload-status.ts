import { ERROR_CODE, type MobileContract } from "@ansora/contracts"
import { type BufferedFile, FAILED_UPLOAD_STATES, needsReplacement, orderedKeys, UPLOAD_STATE } from "./transfer-buffer"

type ServerFile = Pick<
	MobileContract.components["schemas"]["AcquisitionDraftFile"],
	"file_key" | "status" | "pending_on_other_device"
>

type SequencedServerFile = Pick<MobileContract.components["schemas"]["AcquisitionDraftFile"], "file_key" | "sequence">

export type ServerRecordFile = ServerFile & SequencedServerFile

export const SERVER_FILE_STATUS = {
	ANNOUNCED: "announced",
	RECEIVED: "received",
	REJECTED: "rejected",
} as const satisfies Record<string, ServerFile["status"]>

export const RECONCILIATION = {
	RECEIVED: "received",
	REJECTED: "rejected",
} as const

export type Reconciliation =
	| { kind: typeof RECONCILIATION.RECEIVED; fileKey: string; contentFileId: string }
	| { kind: typeof RECONCILIATION.REJECTED; fileKey: string }

// CAP-019-R14, CAP-015-R36, E112, E113, E27
export const REJECTION = {
	OPEN_RECORD: "open_record",
	DECIDED: "decided",
	UNKNOWN_RECORD: "unknown_record",
} as const

export type Rejection = (typeof REJECTION)[keyof typeof REJECTION]

// CAP-019-R24, CAP-015-R34
export const UPLOAD_STEP = {
	SEND: "send",
	REPLACE: "replace",
	NONE: "none",
} as const

export type UploadStep = (typeof UPLOAD_STEP)[keyof typeof UPLOAD_STEP]

// CAP-021-R25, CAP-021-R32, CAP-015-R35, CAP-015-R36, CAP-009-S05, Q-076
export const RECORD_FILES = {
	COMPLETE: "complete",
	UPLOADING: "uploading",
	REJECTED: "rejected",
	UNREADABLE: "unreadable",
	ON_OTHER_DEVICE: "on_other_device",
	CHANGED: "changed",
} as const

export type RecordFiles = (typeof RECORD_FILES)[keyof typeof RECORD_FILES]

// CAP-015-R35, CAP-015-R36, CAP-015-S51, CAP-009-S05, Q-076
export const FILE_CONDITION = {
	KEPT: "kept",
	REJECTED: "rejected",
	UNREADABLE: "unreadable",
	ON_OTHER_DEVICE: "on_other_device",
} as const

export type FileCondition = (typeof FILE_CONDITION)[keyof typeof FILE_CONDITION]

export const SHOWN_FILE = {
	LOCAL: "local",
	SERVER: "server",
} as const

// CAP-015-R35, CAP-015-R36, CAP-018-R14, Q-076
export type ShownFile<Server extends ServerRecordFile = ServerRecordFile> =
	| { kind: typeof SHOWN_FILE.LOCAL; fileKey: string; condition: FileCondition; local: BufferedFile }
	| { kind: typeof SHOWN_FILE.SERVER; fileKey: string; condition: FileCondition; server: Server }

// E112
const OPEN_RECORD_REJECTIONS: ReadonlySet<string> = new Set([
	ERROR_CODE.RECORD_REJECTED,
	ERROR_CODE.IDEMPOTENCY_CONFLICT,
	ERROR_CODE.PATIENT_MISMATCH,
	ERROR_CODE.OPERATOR_UNVERIFIED,
])

// CAP-019-R14, CAP-019-R27, E112, E113, E27
export function rejectionOf(code: string | null): Rejection {
	if (code === null || OPEN_RECORD_REJECTIONS.has(code)) {
		return REJECTION.OPEN_RECORD
	}
	return code === ERROR_CODE.ACQUISITION_ALREADY_DECIDED ? REJECTION.DECIDED : REJECTION.UNKNOWN_RECORD
}

// CAP-019-R14, CAP-019-S18, E113
export function isRecordFile(file: BufferedFile): boolean {
	return file.uploadState !== UPLOAD_STATE.REJECTED || rejectionOf(file.rejectionCode) !== REJECTION.DECIDED
}

// CAP-019-R24, CAP-015-R34
export function isUploaded(file: BufferedFile): boolean {
	return file.uploadState === UPLOAD_STATE.RECEIVED && !needsReplacement(file)
}

// CAP-019-R24, CAP-015-R34, ADR-015
export function uploadStepOf(file: BufferedFile): UploadStep {
	if (file.uploadState === UPLOAD_STATE.WAITING) {
		return UPLOAD_STEP.SEND
	}
	return needsReplacement(file) ? UPLOAD_STEP.REPLACE : UPLOAD_STEP.NONE
}

// CAP-015-R35, CAP-015-R36, CAP-019-R24
export function reconciliationsOf(local: readonly BufferedFile[], server: readonly ServerFile[]): Reconciliation[] {
	return local.flatMap((file): Reconciliation[] => {
		const status = server.find((candidate) => candidate.file_key === file.fileKey)?.status
		if (status === SERVER_FILE_STATUS.RECEIVED && file.uploadState !== UPLOAD_STATE.RECEIVED) {
			const contentFileId = file.sentContentFileId ?? file.contentFileId
			return [{ kind: RECONCILIATION.RECEIVED, fileKey: file.fileKey, contentFileId }]
		}
		if (status === SERVER_FILE_STATUS.REJECTED && file.uploadState !== UPLOAD_STATE.REJECTED) {
			return [{ kind: RECONCILIATION.REJECTED, fileKey: file.fileKey }]
		}
		return []
	})
}

// CAP-015-R18, CAP-021-R32, CAP-015-R35
export function removedElsewhereOf(
	local: readonly BufferedFile[],
	server: readonly Pick<ServerFile, "file_key">[],
): BufferedFile[] {
	const serverKeys = new Set(server.map((file) => file.file_key))
	return local.filter((file) => file.uploadState === UPLOAD_STATE.RECEIVED && !serverKeys.has(file.fileKey))
}

// CAP-015-R35, CAP-018-R11, CAP-021-R25
export function serverOrderOf(
	local: readonly BufferedFile[],
	server: readonly SequencedServerFile[],
): string[] | undefined {
	const localKeys = local.map((file) => file.fileKey)
	const serverKeys = [...server]
		.sort((first, second) => first.sequence - second.sequence)
		.map((file) => file.file_key)
		.filter((fileKey) => localKeys.includes(fileKey))
	const localOnServer = localKeys.filter((fileKey) => serverKeys.includes(fileKey))
	if (localOnServer.every((fileKey, index) => serverKeys[index] === fileKey)) {
		return undefined
	}
	return orderedKeys(localKeys, serverKeys)
}

// CAP-019-R14, CAP-019-S12, CAP-009-S05, Q-076
export function isFailed(file: Pick<BufferedFile, "uploadState">): boolean {
	return FAILED_UPLOAD_STATES.includes(file.uploadState)
}

function isWaitingOnOtherDevice(file: ServerFile | undefined): boolean {
	return file?.status === SERVER_FILE_STATUS.ANNOUNCED && file.pending_on_other_device === true
}

// CAP-015-R36, CAP-015-S51, CAP-009-S05, Q-076
function localConditionOf(file: BufferedFile, server: ServerFile | undefined): FileCondition {
	if (file.uploadState === UPLOAD_STATE.REJECTED || server?.status === SERVER_FILE_STATUS.REJECTED) {
		return FILE_CONDITION.REJECTED
	}
	if (file.uploadState === UPLOAD_STATE.UNREADABLE && server?.status !== SERVER_FILE_STATUS.RECEIVED) {
		return FILE_CONDITION.UNREADABLE
	}
	return isWaitingOnOtherDevice(server) ? FILE_CONDITION.ON_OTHER_DEVICE : FILE_CONDITION.KEPT
}

// CAP-015-R35, CAP-015-R36, CAP-015-S51, CAP-009-S05, Q-076
function serverConditionOf(file: ServerFile): FileCondition {
	switch (file.status) {
		case SERVER_FILE_STATUS.REJECTED:
			return FILE_CONDITION.REJECTED
		case SERVER_FILE_STATUS.ANNOUNCED:
			return isWaitingOnOtherDevice(file) ? FILE_CONDITION.ON_OTHER_DEVICE : FILE_CONDITION.UNREADABLE
		default:
			return FILE_CONDITION.KEPT
	}
}

interface PlacedFile<Server extends ServerRecordFile> {
	shown: ShownFile<Server>
	sequence: number
}

// CAP-015-R35, CAP-015-R36, CAP-018-R14, CAP-019-S12, CAP-009-S05, Q-076
export function shownFilesOf<Server extends ServerRecordFile>(
	local: readonly BufferedFile[],
	server: readonly Server[],
): ShownFile<Server>[] {
	const record = local.filter(isRecordFile)
	const serverByKey = new Map(server.map((file) => [file.file_key, file]))
	const recordKeys = new Set(record.map((file) => file.fileKey))
	const serverSequenceOf = (fileKey: string | null) =>
		fileKey === null ? undefined : serverByKey.get(fileKey)?.sequence
	const placedLocal = (file: BufferedFile): PlacedFile<Server> => ({
		shown: {
			kind: SHOWN_FILE.LOCAL,
			fileKey: file.fileKey,
			condition: localConditionOf(file, serverByKey.get(file.fileKey)),
			local: file,
		},
		sequence: serverSequenceOf(file.fileKey) ?? serverSequenceOf(file.replacesFileKey) ?? Number.POSITIVE_INFINITY,
	})
	const isInPlaceOfServerFile = (file: BufferedFile) =>
		file.replacesFileKey !== null && !recordKeys.has(file.replacesFileKey) && serverByKey.has(file.replacesFileKey)
	const keysOnDevice = new Set(record.flatMap((file) => [file.fileKey, file.replacesFileKey]))
	const shown = record.filter((file) => !isInPlaceOfServerFile(file)).map(placedLocal)
	const placedByServer = [
		...record.filter(isInPlaceOfServerFile).map(placedLocal),
		...server
			.filter((file) => !keysOnDevice.has(file.file_key))
			.map(
				(file): PlacedFile<Server> => ({
					shown: { kind: SHOWN_FILE.SERVER, fileKey: file.file_key, condition: serverConditionOf(file), server: file },
					sequence: file.sequence,
				}),
			),
	].sort((first, second) => first.sequence - second.sequence)
	for (const file of placedByServer) {
		const next = shown.findIndex((candidate) => candidate.sequence > file.sequence)
		shown.splice(next === -1 ? shown.length : next, 0, file)
	}
	return shown.map((file) => file.shown)
}

// CAP-021-R25, CAP-021-R32, CAP-015-R35, CAP-015-R36, CAP-019-R14, CAP-009-S05, Q-076
export function recordFilesStateOf(
	confirmedKeys: readonly string[],
	local: readonly BufferedFile[],
	server: readonly ServerRecordFile[],
): RecordFiles {
	const shown = shownFilesOf(local, server)
	const conditions = new Set(shown.map((file) => file.condition))
	if (conditions.has(FILE_CONDITION.REJECTED)) {
		return RECORD_FILES.REJECTED
	}
	if (conditions.has(FILE_CONDITION.UNREADABLE)) {
		return RECORD_FILES.UNREADABLE
	}
	if (conditions.has(FILE_CONDITION.ON_OTHER_DEVICE)) {
		return RECORD_FILES.ON_OTHER_DEVICE
	}
	const shownKeys = shown.map((file) => file.fileKey)
	const isSameSet =
		shownKeys.length === confirmedKeys.length && confirmedKeys.every((fileKey) => shownKeys.includes(fileKey))
	if (!isSameSet) {
		return RECORD_FILES.CHANGED
	}
	const statusOf = (fileKey: string) => server.find((file) => file.file_key === fileKey)?.status
	const isRemovedElsewhere = shown.some(
		(file) =>
			file.kind === SHOWN_FILE.LOCAL &&
			file.local.uploadState === UPLOAD_STATE.RECEIVED &&
			statusOf(file.fileKey) === undefined,
	)
	if (isRemovedElsewhere) {
		return RECORD_FILES.CHANGED
	}
	const isAllReceived = shown.every((file) => statusOf(file.fileKey) === SERVER_FILE_STATUS.RECEIVED)
	return isAllReceived ? RECORD_FILES.COMPLETE : RECORD_FILES.UPLOADING
}
