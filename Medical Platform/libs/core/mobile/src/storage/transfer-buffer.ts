import type { MobileContract } from "@ansora/contracts"
import type { EncryptedFile, SecuredPhoto } from "../native"
import type { EncryptedFileStore, StoredFile } from "./encrypted-file-store"
import type { SqlDatabase, TransactionalSqlDatabase } from "./sql-database"
import { oneOf } from "./stored-value"

type Schemas = MobileContract.components["schemas"]

export type BufferedFileKind = Schemas["AcquisitionFileAnnouncement"]["file_kind"]
export type FileEdit = Schemas["AcquisitionFileReplacement"]["edit"]

// CAP-015-R35
export const BUFFERED_FILE_KIND = {
	IMAGE: "image",
	DOCUMENT_PAGE: "document_page",
} as const satisfies Record<string, BufferedFileKind>

// CAP-015-R34
export const FILE_EDIT = {
	ROTATION: "rotation",
	CROP: "crop",
	ROTATION_AND_CROP: "rotation_and_crop",
} as const satisfies Record<string, FileEdit>

// CAP-019-R24, CAP-015-R36, CAP-009-S05, Q-076
export const UPLOAD_STATE = {
	WAITING: "waiting",
	UPLOADING: "uploading",
	RECEIVED: "received",
	REJECTED: "rejected",
	UNREADABLE: "unreadable",
} as const

export type UploadState = (typeof UPLOAD_STATE)[keyof typeof UPLOAD_STATE]

// CAP-019-R14, CAP-019-S12, CAP-009-S05, Q-076
export const FAILED_UPLOAD_STATES: readonly UploadState[] = [UPLOAD_STATE.REJECTED, UPLOAD_STATE.UNREADABLE]

export interface BufferedFile {
	fileKey: string
	acquisitionId: string
	operatorUserId: string
	position: number
	kind: BufferedFileKind
	contentFileId: string
	thumbnailFileId: string
	originalFileId: string | null
	corners: string | null
	width: number
	height: number
	capturedAt: string
	uploadState: UploadState
	sentContentFileId: string | null
	receivedContentFileId: string | null
	contentEdit: FileEdit | null
	rejectionCode: string | null
	editFailedContentFileId: string | null
	// CAP-015-R36, CAP-019-S12
	replacesFileKey: string | null
}

export interface BufferedFileOwner {
	fileKey: string
	acquisitionId: string
	operatorUserId: string
}

export type BufferedContent = Pick<BufferedFile, "contentFileId" | "thumbnailFileId" | "width" | "height">

export type UnplacedBufferedFile = Pick<
	BufferedFile,
	| "fileKey"
	| "acquisitionId"
	| "operatorUserId"
	| "kind"
	| "contentFileId"
	| "thumbnailFileId"
	| "originalFileId"
	| "corners"
	| "width"
	| "height"
	| "capturedAt"
>

// NAB-191–195, CAP-018-R11
export interface SecuredPage extends SecuredPhoto {
	original: EncryptedFile
	corners: string | null
}

export interface BufferedFileRecords {
	insertAtNextPosition(file: UnplacedBufferedFile): Promise<BufferedFile>
	insertInPlaceOf(file: UnplacedBufferedFile, replacedKey: string, at: string): Promise<BufferedFile>
	find(fileKey: string): Promise<BufferedFile | undefined>
	list(acquisitionId: string, operatorUserId: string): Promise<BufferedFile[]>
	listFailedInRecords(operatorUserId: string): Promise<BufferedFile[]>
	listAll(): Promise<BufferedFile[]>
	replaceContent(
		fileKey: string,
		content: BufferedContent,
		edit: FileEdit | null,
		corners: string | null,
	): Promise<void>
	reorder(acquisitionId: string, fileKeys: readonly string[]): Promise<void>
	markUploading(fileKey: string, contentFileId: string): Promise<void>
	markReceived(fileKey: string, contentFileId: string, receivedAt: string): Promise<void>
	receivedBefore(cutoff: string): Promise<BufferedFile[]>
	markRejected(fileKey: string, code: string | null): Promise<void>
	markEditFailed(fileKey: string, contentFileId: string, code: string | null): Promise<void>
	markWaiting(fileKey: string): Promise<void>
	markUnreadable(fileKey: string, contentFileId: string): Promise<void>
	setAsideFailed(fileKey: string, at: string): Promise<boolean>
	remove(fileKey: string): Promise<void>
}

export interface SealedCopyRecords {
	insert(fileKey: string, path: string, createdAt: string): Promise<void>
	paths(fileKey: string): Promise<string[]>
	remove(path: string): Promise<void>
}

export class BufferedFileNotFoundError extends Error {
	readonly code = "buffered-file-not-found"

	constructor(readonly fileKey: string) {
		super(`No buffered file with key ${fileKey}`)
		this.name = "BufferedFileNotFoundError"
	}
}

// CAP-015-R34
export function mergedEdit(earlier: FileEdit | null, next: FileEdit): FileEdit {
	if (earlier === null || earlier === next) {
		return next
	}
	return FILE_EDIT.ROTATION_AND_CROP
}

// CAP-015-R34, CAP-015-S56
export function needsReplacement(file: BufferedFile): boolean {
	return isEditPending(file) && file.editFailedContentFileId !== file.contentFileId
}

function isEditPending(file: BufferedFile): boolean {
	return file.uploadState === UPLOAD_STATE.RECEIVED && file.receivedContentFileId !== file.contentFileId
}

// CAP-009-R17, CAP-015-R15, CAP-015-S04
export class TransferBuffer {
	constructor(
		private readonly files: EncryptedFileStore,
		private readonly records: BufferedFileRecords,
		private readonly sealed: SealedCopyRecords,
		private readonly now: () => Date = () => new Date(),
	) {}

	// CAP-015-R36, CAP-019-S12
	async addPhoto(
		owner: BufferedFileOwner,
		photo: SecuredPhoto,
		replacedKey: string | null = null,
	): Promise<BufferedFile> {
		const capturedAt = this.now().toISOString()
		return this.adoptPhoto(photo, (content) =>
			this.insert(
				{
					...owner,
					...content,
					kind: BUFFERED_FILE_KIND.IMAGE,
					originalFileId: null,
					corners: null,
					capturedAt,
				},
				replacedKey,
			),
		)
	}

	// CAP-018-R08, CAP-018-R11, CAP-015-R36
	async addPage(owner: BufferedFileOwner, page: SecuredPage, replacedKey: string | null = null): Promise<BufferedFile> {
		const capturedAt = this.now().toISOString()
		const original = await this.adoptOriginal(page)
		try {
			return await this.adoptPhoto(page, (content) =>
				this.insert(
					{
						...owner,
						...content,
						kind: BUFFERED_FILE_KIND.DOCUMENT_PAGE,
						originalFileId: original.id,
						corners: page.corners,
						capturedAt,
					},
					replacedKey,
				),
			)
		} catch (failure) {
			await this.files.destroy(original.id)
			throw failure
		}
	}

	async photos(acquisitionId: string, operatorUserId: string): Promise<BufferedFile[]> {
		return this.records.list(acquisitionId, operatorUserId)
	}

	async find(fileKey: string): Promise<BufferedFile | undefined> {
		return this.records.find(fileKey)
	}

	// CAP-015-R36, CAP-009-S05, Q-076
	async failedInRecords(operatorUserId: string): Promise<BufferedFile[]> {
		return this.records.listFailedInRecords(operatorUserId)
	}

	// CAP-019-R04, CAP-019-R23, CAP-019-R24
	async queued(): Promise<BufferedFile[]> {
		return this.records.listAll()
	}

	async thumbnail(file: BufferedFile): Promise<Uint8Array> {
		return this.files.read(file.thumbnailFileId)
	}

	async content(file: BufferedFile): Promise<StoredFile> {
		return this.files.find(file.contentFileId)
	}

	async storedThumbnail(file: BufferedFile): Promise<StoredFile> {
		return this.files.find(file.thumbnailFileId)
	}

	// CAP-018-R11
	async original(file: Pick<BufferedFile, "originalFileId">): Promise<StoredFile | undefined> {
		return file.originalFileId === null ? undefined : this.files.find(file.originalFileId)
	}

	// CAP-018-R10
	async originalBytes(file: Pick<BufferedFile, "originalFileId">): Promise<Uint8Array | undefined> {
		return file.originalFileId === null ? undefined : this.files.read(file.originalFileId)
	}

	// CAP-015-R34, Q-131
	async replacePhoto(fileKey: string, photo: SecuredPhoto, edit: FileEdit): Promise<BufferedFile> {
		const current = await this.bufferedOrDiscard(fileKey, photo)
		return this.replaceContent(current, photo, edit, current.corners)
	}

	// CAP-018-R11
	async replacePage(
		fileKey: string,
		page: SecuredPhoto,
		corners: string | null,
		edit: FileEdit,
	): Promise<BufferedFile> {
		const current = await this.bufferedOrDiscard(fileKey, page)
		return this.replaceContent(current, page, edit, corners)
	}

	// CAP-018-R11, CAP-015-R33
	async reorder(acquisitionId: string, fileKeys: readonly string[]): Promise<void> {
		await this.records.reorder(acquisitionId, fileKeys)
	}

	// CAP-019-R24
	async markUploading(file: BufferedFile): Promise<void> {
		await this.records.markUploading(file.fileKey, file.contentFileId)
	}

	// CAP-019-R24, CAP-015-R34, CAP-026-R08
	async markReceived(fileKey: string, contentFileId: string): Promise<void> {
		await this.records.markReceived(fileKey, contentFileId, this.now().toISOString())
	}

	// CAP-026-R08, CAP-026-S04, CAP-026-S12
	async expiredCopies(receivedBefore: Date): Promise<BufferedFile[]> {
		return (await this.records.receivedBefore(receivedBefore.toISOString())).filter((file) => !needsReplacement(file))
	}

	// CAP-015-R36, CAP-019-R14
	async markRejected(fileKey: string, code: string | null): Promise<void> {
		await this.records.markRejected(fileKey, code)
	}

	// CAP-015-R34, CAP-021-R32, E115
	async markEditFailed(file: BufferedFile, code: string | null): Promise<void> {
		await this.records.markEditFailed(file.fileKey, file.contentFileId, code)
	}

	async markWaiting(fileKey: string): Promise<void> {
		await this.records.markWaiting(fileKey)
	}

	// CAP-009-S05, Q-076
	async markUnreadable(file: Pick<BufferedFile, "fileKey" | "contentFileId">): Promise<void> {
		await this.records.markUnreadable(file.fileKey, file.contentFileId)
	}

	// CAP-015-R18, CAP-019-R14, CAP-019-S12, CAP-009-R18, ADR-038, Q-076
	async removeFromRecord(fileKey: string): Promise<void> {
		if (await this.records.setAsideFailed(fileKey, this.now().toISOString())) {
			return
		}
		await this.remove(fileKey)
	}

	// CAP-009-R13
	async keepSealedCopy(fileKey: string, copy: Pick<EncryptedFile, "path">): Promise<void> {
		try {
			await this.sealed.insert(fileKey, copy.path, this.now().toISOString())
		} catch (failure) {
			await this.files.discardPath(copy.path)
			throw failure
		}
	}

	// CAP-009-R13, NAB-159
	async discardSealedCopies(fileKey: string): Promise<void> {
		for (const path of await this.sealed.paths(fileKey)) {
			await this.files.discardPath(path)
			await this.sealed.remove(path)
		}
	}

	// CAP-009-R18
	async remove(fileKey: string): Promise<void> {
		const current = await this.buffered(fileKey)
		await this.records.remove(fileKey)
		await this.destroyAll(storedIdsOf(current))
		await this.discardSealedCopies(fileKey)
	}

	private async insert(file: UnplacedBufferedFile, replacedKey: string | null): Promise<BufferedFile> {
		if (replacedKey === null) {
			return await this.records.insertAtNextPosition(file)
		}
		return await this.records.insertInPlaceOf(file, replacedKey, this.now().toISOString())
	}

	private async replaceContent(
		current: BufferedFile,
		photo: SecuredPhoto,
		edit: FileEdit,
		corners: string | null,
	): Promise<BufferedFile> {
		const contentEdit = mergedEdit(current.contentEdit, edit)
		const replacement = await this.adoptPhoto(photo, async (content) => {
			await this.records.replaceContent(current.fileKey, content, contentEdit, corners)
			return content
		})
		await this.destroyAll([current.contentFileId, current.thumbnailFileId])
		return { ...current, ...replacement, contentEdit, corners }
	}

	private async buffered(fileKey: string): Promise<BufferedFile> {
		const file = await this.records.find(fileKey)
		if (file === undefined) {
			throw new BufferedFileNotFoundError(fileKey)
		}
		return file
	}

	private async bufferedOrDiscard(fileKey: string, photo: SecuredPhoto): Promise<BufferedFile> {
		try {
			return await this.buffered(fileKey)
		} catch (failure) {
			await this.files.discard(photo.image)
			await this.files.discard(photo.thumbnail)
			throw failure
		}
	}

	private async adoptOriginal(page: SecuredPage): Promise<StoredFile> {
		try {
			return await this.files.adopt(page.original.path, page.original)
		} catch (failure) {
			await this.files.discard(page.image)
			await this.files.discard(page.thumbnail)
			throw failure
		}
	}

	// CAP-009-R09
	private async adoptPhoto<Written>(
		photo: SecuredPhoto,
		write: (content: BufferedContent) => Promise<Written>,
	): Promise<Written> {
		const image = await this.adoptImage(photo)
		const thumbnail = await this.adoptThumbnail(photo, image)
		try {
			return await write({
				contentFileId: image.id,
				thumbnailFileId: thumbnail.id,
				width: photo.width,
				height: photo.height,
			})
		} catch (failure) {
			await this.destroyAll([image.id, thumbnail.id])
			throw failure
		}
	}

	private async adoptImage(photo: SecuredPhoto): Promise<StoredFile> {
		try {
			return await this.files.adopt(photo.image.path, photo.image)
		} catch (failure) {
			await this.files.discard(photo.thumbnail)
			throw failure
		}
	}

	private async adoptThumbnail(photo: SecuredPhoto, image: StoredFile): Promise<StoredFile> {
		try {
			return await this.files.adopt(photo.thumbnail.path, photo.thumbnail)
		} catch (failure) {
			await this.files.destroy(image.id)
			throw failure
		}
	}

	private async destroyAll(ids: readonly string[]): Promise<void> {
		for (const id of ids) {
			await this.files.destroy(id)
		}
	}
}

// CAP-018-R11
export function orderedKeys(current: readonly string[], wanted: readonly string[]): string[] {
	const placed = wanted.filter((fileKey) => current.includes(fileKey))
	return [...placed, ...current.filter((fileKey) => !placed.includes(fileKey))]
}

function storedIdsOf(file: BufferedFile): string[] {
	const ids = [file.contentFileId, file.thumbnailFileId]
	return file.originalFileId === null ? ids : [...ids, file.originalFileId]
}

interface BufferedFileRow {
	file_key: string
	acquisition_id: string
	operator_user_id: string
	position: number
	file_kind: string
	content_file_id: string
	thumbnail_file_id: string
	original_file_id: string | null
	corners: string | null
	width: number
	height: number
	captured_at: string
	upload_state: string
	sent_content_file_id: string | null
	received_content_file_id: string | null
	content_edit: string | null
	rejection_code: string | null
	edit_failed_content_file_id: string | null
	replaces_file_key: string | null
}

const COLUMNS =
	"file_key, acquisition_id, operator_user_id, position, file_kind, content_file_id, thumbnail_file_id, " +
	"original_file_id, corners, width, height, captured_at, upload_state, sent_content_file_id, " +
	"received_content_file_id, content_edit, rejection_code, edit_failed_content_file_id, replaces_file_key"

const INSERTED_COLUMNS =
	"file_key, acquisition_id, operator_user_id, position, file_kind, content_file_id, thumbnail_file_id, " +
	"original_file_id, corners, width, height, captured_at"

const INSERT_AT_NEXT_POSITION = `
INSERT INTO buffered_file (${INSERTED_COLUMNS}, replaces_file_key)
SELECT ?, ?, ?, COALESCE(MAX(position), 0) + 1, ?, ?, ?, ?, ?, ?, ?, ?, ?
FROM buffered_file
WHERE acquisition_id = ?
RETURNING ${COLUMNS}`

// CAP-015-R36, CAP-019-S12
const REPLACED_FILE =
	"SELECT acquisition_id, position, upload_state, removed_from_record_at FROM buffered_file WHERE file_key = ?"
const PARK_FILE = "UPDATE buffered_file SET position = -position WHERE file_key = ?"
const SET_ASIDE_FILE = "UPDATE buffered_file SET removed_from_record_at = ? WHERE file_key = ?"
// CAP-019-R14, CAP-019-S12, Q-076
const FAILED_FILE = "SELECT file_key FROM buffered_file WHERE file_key = ? AND upload_state IN (?, ?)"

// CAP-018-R11
const ORDER_OF_ACQUISITION = "SELECT file_key FROM buffered_file WHERE acquisition_id = ? ORDER BY position"
const PARK_POSITIONS = "UPDATE buffered_file SET position = -position WHERE acquisition_id = ?"
const PLACE_FILE = "UPDATE buffered_file SET position = ? WHERE file_key = ?"

const UPLOAD_STATES: readonly string[] = Object.values(UPLOAD_STATE)

interface ReplacedFileRow {
	acquisition_id: string
	position: number
	upload_state: string
	removed_from_record_at: string | null
}

// CAP-015-R36, CAP-019-S12
function isReplaceableIn(acquisitionId: string, replaced: ReplacedFileRow): boolean {
	return (
		replaced.acquisition_id === acquisitionId &&
		replaced.upload_state === UPLOAD_STATE.REJECTED &&
		replaced.removed_from_record_at === null
	)
}

const FILE_EDITS: readonly string[] = Object.values(FILE_EDIT)
const FILE_KINDS: readonly string[] = Object.values(BUFFERED_FILE_KIND)

export class SqlBufferedFileRecords implements BufferedFileRecords {
	constructor(private readonly db: TransactionalSqlDatabase) {}

	// CAP-015-S04
	async insertAtNextPosition(file: UnplacedBufferedFile): Promise<BufferedFile> {
		return fileOf(await insertedRowOf(this.db, file, null))
	}

	// CAP-015-R36, CAP-019-S12
	async insertInPlaceOf(file: UnplacedBufferedFile, replacedKey: string, at: string): Promise<BufferedFile> {
		return await this.db.transaction(async (transaction) => {
			const replaced = await transaction.getFirstAsync<ReplacedFileRow>(REPLACED_FILE, [replacedKey])
			if (replaced === null) {
				return fileOf(await insertedRowOf(transaction, file, replacedKey))
			}
			if (!isReplaceableIn(file.acquisitionId, replaced)) {
				return fileOf(await insertedRowOf(transaction, file, null))
			}
			const inserted = await insertedRowOf(transaction, file, replacedKey)
			await transaction.runAsync(PARK_FILE, [replacedKey])
			await transaction.runAsync(PLACE_FILE, [replaced.position, file.fileKey])
			await transaction.runAsync(PLACE_FILE, [inserted.position, replacedKey])
			await transaction.runAsync(SET_ASIDE_FILE, [at, replacedKey])
			return { ...fileOf(inserted), position: replaced.position }
		})
	}

	async find(fileKey: string): Promise<BufferedFile | undefined> {
		const row = await this.db.getFirstAsync<BufferedFileRow>(
			`SELECT ${COLUMNS} FROM buffered_file WHERE file_key = ?`,
			[fileKey],
		)
		return row === null ? undefined : fileOf(row)
	}

	// CAP-015-R18, CAP-019-S12
	async list(acquisitionId: string, operatorUserId: string): Promise<BufferedFile[]> {
		const rows = await this.db.getAllAsync<BufferedFileRow>(
			`SELECT ${COLUMNS} FROM buffered_file
			WHERE acquisition_id = ? AND operator_user_id = ? AND removed_from_record_at IS NULL ORDER BY position`,
			[acquisitionId, operatorUserId],
		)
		return rows.map(fileOf)
	}

	// CAP-015-R36, CAP-009-S05, Q-076
	async listFailedInRecords(operatorUserId: string): Promise<BufferedFile[]> {
		const rows = await this.db.getAllAsync<BufferedFileRow>(
			`SELECT ${COLUMNS} FROM buffered_file
			WHERE operator_user_id = ? AND upload_state IN (?, ?) AND removed_from_record_at IS NULL
			ORDER BY acquisition_id, position`,
			[operatorUserId, ...FAILED_UPLOAD_STATES],
		)
		return rows.map(fileOf)
	}

	async listAll(): Promise<BufferedFile[]> {
		const rows = await this.db.getAllAsync<BufferedFileRow>(
			`SELECT ${COLUMNS} FROM buffered_file ORDER BY captured_at, position`,
			[],
		)
		return rows.map(fileOf)
	}

	async replaceContent(
		fileKey: string,
		content: BufferedContent,
		edit: FileEdit | null,
		corners: string | null,
	): Promise<void> {
		await this.db.runAsync(
			"UPDATE buffered_file SET content_file_id = ?, thumbnail_file_id = ?, width = ?, height = ?, content_edit = ?, corners = ? WHERE file_key = ?",
			[content.contentFileId, content.thumbnailFileId, content.width, content.height, edit, corners, fileKey],
		)
	}

	// CAP-018-R11, CAP-015-R33
	async reorder(acquisitionId: string, fileKeys: readonly string[]): Promise<void> {
		await this.db.transaction(async (transaction) => {
			const current = await transaction.getAllAsync<{ file_key: string }>(ORDER_OF_ACQUISITION, [acquisitionId])
			const order = orderedKeys(
				current.map((row) => row.file_key),
				fileKeys,
			)
			await transaction.runAsync(PARK_POSITIONS, [acquisitionId])
			for (const [index, fileKey] of order.entries()) {
				await transaction.runAsync(PLACE_FILE, [index + 1, fileKey])
			}
		})
	}

	async markUploading(fileKey: string, contentFileId: string): Promise<void> {
		await this.db.runAsync(
			"UPDATE buffered_file SET upload_state = ?, sent_content_file_id = ?, rejection_code = NULL WHERE file_key = ?",
			[UPLOAD_STATE.UPLOADING, contentFileId, fileKey],
		)
	}

	async markReceived(fileKey: string, contentFileId: string, receivedAt: string): Promise<void> {
		await this.db.runAsync(
			`UPDATE buffered_file SET upload_state = ?, received_content_file_id = ?, rejection_code = NULL,
			edit_failed_content_file_id = NULL,
			received_at = CASE WHEN upload_state = ? AND received_content_file_id = ? THEN received_at ELSE ? END,
			content_edit = CASE WHEN content_file_id = ? THEN NULL ELSE content_edit END WHERE file_key = ?`,
			[UPLOAD_STATE.RECEIVED, contentFileId, UPLOAD_STATE.RECEIVED, contentFileId, receivedAt, contentFileId, fileKey],
		)
	}

	async receivedBefore(cutoff: string): Promise<BufferedFile[]> {
		const rows = await this.db.getAllAsync<BufferedFileRow>(
			`SELECT ${COLUMNS} FROM buffered_file WHERE upload_state = ? AND received_at <= ? ORDER BY captured_at, position`,
			[UPLOAD_STATE.RECEIVED, cutoff],
		)
		return rows.map(fileOf)
	}

	async markRejected(fileKey: string, code: string | null): Promise<void> {
		await this.db.runAsync("UPDATE buffered_file SET upload_state = ?, rejection_code = ? WHERE file_key = ?", [
			UPLOAD_STATE.REJECTED,
			code,
			fileKey,
		])
	}

	async markEditFailed(fileKey: string, contentFileId: string, code: string | null): Promise<void> {
		await this.db.runAsync(
			"UPDATE buffered_file SET edit_failed_content_file_id = ?, rejection_code = ? WHERE file_key = ? AND upload_state = ?",
			[contentFileId, code, fileKey, UPLOAD_STATE.RECEIVED],
		)
	}

	async markWaiting(fileKey: string): Promise<void> {
		await this.db.runAsync("UPDATE buffered_file SET upload_state = ? WHERE file_key = ? AND upload_state = ?", [
			UPLOAD_STATE.WAITING,
			fileKey,
			UPLOAD_STATE.UPLOADING,
		])
	}

	// CAP-009-S05, Q-076
	async markUnreadable(fileKey: string, contentFileId: string): Promise<void> {
		await this.db.runAsync(
			"UPDATE buffered_file SET upload_state = ? WHERE file_key = ? AND content_file_id = ? AND upload_state IN (?, ?)",
			[UPLOAD_STATE.UNREADABLE, fileKey, contentFileId, UPLOAD_STATE.WAITING, UPLOAD_STATE.UPLOADING],
		)
	}

	// CAP-019-R14, CAP-019-S12, ADR-038, Q-076
	async setAsideFailed(fileKey: string, at: string): Promise<boolean> {
		return await this.db.transaction(async (transaction) => {
			const failed = await transaction.getFirstAsync<{ file_key: string }>(FAILED_FILE, [
				fileKey,
				...FAILED_UPLOAD_STATES,
			])
			if (failed === null) {
				return false
			}
			await transaction.runAsync(SET_ASIDE_FILE, [at, fileKey])
			return true
		})
	}

	async remove(fileKey: string): Promise<void> {
		await this.db.runAsync("DELETE FROM buffered_file WHERE file_key = ?", [fileKey])
	}
}

export class SqlSealedCopyRecords implements SealedCopyRecords {
	constructor(private readonly db: SqlDatabase) {}

	async insert(fileKey: string, path: string, createdAt: string): Promise<void> {
		await this.db.runAsync("INSERT INTO sealed_copy (path, file_key, created_at) VALUES (?, ?, ?)", [
			path,
			fileKey,
			createdAt,
		])
	}

	async paths(fileKey: string): Promise<string[]> {
		const rows = await this.db.getAllAsync<{ path: string }>("SELECT path FROM sealed_copy WHERE file_key = ?", [
			fileKey,
		])
		return rows.map((row) => row.path)
	}

	async remove(path: string): Promise<void> {
		await this.db.runAsync("DELETE FROM sealed_copy WHERE path = ?", [path])
	}
}

// CAP-015-R34, CAP-021-R34
function knownEditOf(value: string | null): FileEdit | null {
	return value !== null && FILE_EDITS.includes(value) ? (value as FileEdit) : null
}

async function insertedRowOf(
	db: SqlDatabase,
	file: UnplacedBufferedFile,
	replacedKey: string | null,
): Promise<BufferedFileRow> {
	const row = await db.getFirstAsync<BufferedFileRow>(INSERT_AT_NEXT_POSITION, [
		file.fileKey,
		file.acquisitionId,
		file.operatorUserId,
		file.kind,
		file.contentFileId,
		file.thumbnailFileId,
		file.originalFileId,
		file.corners,
		file.width,
		file.height,
		file.capturedAt,
		replacedKey,
		file.acquisitionId,
	])
	if (row === null) {
		throw new BufferedFileNotFoundError(file.fileKey)
	}
	return row
}

function fileOf(row: BufferedFileRow): BufferedFile {
	return {
		fileKey: row.file_key,
		acquisitionId: row.acquisition_id,
		operatorUserId: row.operator_user_id,
		position: row.position,
		kind: oneOf<BufferedFileKind>(FILE_KINDS, row.file_kind, BUFFERED_FILE_KIND.IMAGE),
		contentFileId: row.content_file_id,
		thumbnailFileId: row.thumbnail_file_id,
		originalFileId: row.original_file_id,
		corners: row.corners,
		width: row.width,
		height: row.height,
		capturedAt: row.captured_at,
		uploadState: oneOf<UploadState>(UPLOAD_STATES, row.upload_state, UPLOAD_STATE.WAITING),
		sentContentFileId: row.sent_content_file_id,
		receivedContentFileId: row.received_content_file_id,
		contentEdit: knownEditOf(row.content_edit),
		rejectionCode: row.rejection_code,
		editFailedContentFileId: row.edit_failed_content_file_id,
		replacesFileKey: row.replaces_file_key,
	}
}
