import { ACQUISITION_KIND, type AcquisitionKind } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { Executor } from "../../../libs/database/database.service"
import { FILE_STATUS } from "../constants/acquisition-file.constants"
import type {
	AcquisitionFileRow,
	FileCountRow,
	NewAnnouncedFile,
	ReceivedContent,
	ReceivedCountRow,
	ReceivedFileKeyRow,
	ReplacedContent,
} from "../types/acquisition-file.types"

type Fragment = postgres.PendingQuery<postgres.Row[]>

const FIRST_SEQUENCE = 1

// datovy-model.md 2
function fileStatusesOf(sql: Executor, acquisitionIds: readonly string[]): Fragment {
	return sql`(
		SELECT i.acquisition_id, i.file_key, i.status, i.announced_by_device_id FROM image i
		WHERE i.acquisition_id IN ${sql([...acquisitionIds])}
		UNION ALL
		SELECT d.acquisition_id, p.file_key, p.status, p.announced_by_device_id
		FROM document_page p JOIN document d ON d.id = p.document_id
		WHERE d.acquisition_id IN ${sql([...acquisitionIds])}
	)`
}

// datovy-model.md 2
function filesOf(sql: Executor, kind: AcquisitionKind, acquisitionId: string): Fragment {
	switch (kind) {
		case ACQUISITION_KIND.PHOTO:
			return sql`(
				SELECT i.id, i.file_key, i.sequence, i.proposed_sequence, i.status, i.binary_object_id,
					t.binary_object_id AS thumbnail_binary_object_id, i.sha256, i.original_upload_sha256, i.edit_kind,
					i.edited_at, i.announced_by_device_id, i.replaces_file_id, i.announced_at, i.received_at
				FROM image i LEFT JOIN thumbnail t ON t.image_id = i.id
				WHERE i.acquisition_id = ${acquisitionId}
			)`
		case ACQUISITION_KIND.SCAN:
			return sql`(
				SELECT p.id, p.file_key, p.sequence, p.proposed_sequence, p.status, p.binary_object_id,
					p.thumbnail_binary_object_id, p.sha256, p.original_upload_sha256, p.edit_kind, p.edited_at,
					p.announced_by_device_id, p.replaces_file_id, p.announced_at, p.received_at
				FROM document_page p JOIN document d ON d.id = p.document_id
				WHERE d.acquisition_id = ${acquisitionId}
			)`
		default:
			return kind satisfies never
	}
}

function tableOf(sql: Executor, kind: AcquisitionKind): Fragment {
	switch (kind) {
		case ACQUISITION_KIND.PHOTO:
			return sql`image`
		case ACQUISITION_KIND.SCAN:
			return sql`document_page`
		default:
			return kind satisfies never
	}
}

// datovy-model.md 2, CAP-015-R35, CAP-015-R36, CAP-021-R23
@Injectable()
export class AcquisitionFileRepository {
	// CAP-015-R35
	async listHeld(sql: Executor, acquisitionId: string, kind: AcquisitionKind): Promise<AcquisitionFileRow[]> {
		return await sql<AcquisitionFileRow[]>`
			SELECT * FROM ${filesOf(sql, kind, acquisitionId)} AS f
			WHERE f.status <> ${FILE_STATUS.REMOVED}
			ORDER BY f.sequence, f.announced_at, f.id
		`
	}

	// CAP-021-R23
	async findByKey(
		sql: Executor,
		acquisitionId: string,
		kind: AcquisitionKind,
		fileKey: string,
	): Promise<AcquisitionFileRow | undefined> {
		const [row] = await sql<AcquisitionFileRow[]>`
			SELECT * FROM ${filesOf(sql, kind, acquisitionId)} AS f WHERE f.file_key = ${fileKey}
		`
		return row
	}

	async findById(
		sql: Executor,
		acquisitionId: string,
		kind: AcquisitionKind,
		fileId: string,
	): Promise<AcquisitionFileRow | undefined> {
		const [row] = await sql<AcquisitionFileRow[]>`
			SELECT * FROM ${filesOf(sql, kind, acquisitionId)} AS f WHERE f.id = ${fileId}
		`
		return row
	}

	async requireById(
		sql: Executor,
		acquisitionId: string,
		kind: AcquisitionKind,
		fileId: string,
	): Promise<AcquisitionFileRow> {
		const file = await this.findById(sql, acquisitionId, kind, fileId)
		if (file === undefined) {
			throw new Error(`the file ${fileId} of acquisition ${acquisitionId} is missing`)
		}
		return file
	}

	// CAP-015-R35
	async nextSequence(tx: postgres.TransactionSql, acquisitionId: string, kind: AcquisitionKind): Promise<number> {
		const [row] = await tx<{ next: number }[]>`
			SELECT (COALESCE(max(f.sequence), 0) + ${FIRST_SEQUENCE})::int AS next
			FROM ${filesOf(tx, kind, acquisitionId)} AS f
		`
		return row?.next ?? FIRST_SEQUENCE
	}

	// CAP-015-R35, CAP-015-R36
	async insertAnnounced(tx: postgres.TransactionSql, file: NewAnnouncedFile): Promise<void> {
		switch (file.kind) {
			case ACQUISITION_KIND.PHOTO:
				await tx`
					INSERT INTO image (
						id, acquisition_id, file_key, sequence, proposed_sequence, status, announced_by_device_id,
						replaces_file_id, announced_at
					) VALUES (
						${file.id}, ${file.acquisitionId}, ${file.fileKey}, ${file.sequence}, ${file.proposedSequence},
						${FILE_STATUS.ANNOUNCED}, ${file.deviceId}, ${file.replacesFileId}, ${file.announcedAt}
					)
				`
				return
			case ACQUISITION_KIND.SCAN:
				await tx`
					INSERT INTO document_page (
						id, document_id, file_key, sequence, proposed_sequence, status, announced_by_device_id,
						replaces_file_id, announced_at
					) VALUES (
						${file.id}, (SELECT d.id FROM document d WHERE d.acquisition_id = ${file.acquisitionId}), ${file.fileKey},
						${file.sequence}, ${file.proposedSequence}, ${FILE_STATUS.ANNOUNCED}, ${file.deviceId},
						${file.replacesFileId}, ${file.announcedAt}
					)
				`
				return
			default:
				file.kind satisfies never
		}
	}

	// CAP-019-R24, CAP-021-R35
	async markReceived(
		tx: postgres.TransactionSql,
		kind: AcquisitionKind,
		fileId: string,
		content: ReceivedContent,
	): Promise<void> {
		await tx`
			UPDATE ${tableOf(tx, kind)} SET
				status = ${FILE_STATUS.RECEIVED}, binary_object_id = ${content.binaryObjectId}, sha256 = ${content.sha256},
				original_upload_sha256 = ${content.sha256}, received_at = ${content.receivedAt}
			WHERE id = ${fileId}
		`
		await this.attachThumbnail(tx, kind, fileId, content.thumbnailBinaryObjectId)
	}

	// CAP-015-R36
	async markRejected(tx: postgres.TransactionSql, kind: AcquisitionKind, fileId: string): Promise<void> {
		await tx`UPDATE ${tableOf(tx, kind)} SET status = ${FILE_STATUS.REJECTED} WHERE id = ${fileId}`
	}

	// CAP-015-R18, CAP-026-R17
	async markRemoved(tx: postgres.TransactionSql, kind: AcquisitionKind, fileId: string): Promise<void> {
		await this.detachThumbnail(tx, kind, fileId)
		await tx`
			UPDATE ${tableOf(tx, kind)} SET status = ${FILE_STATUS.REMOVED}, binary_object_id = NULL, received_at = NULL
			WHERE id = ${fileId}
		`
	}

	// CAP-015-R34, CAP-026-R17
	async replaceContent(
		tx: postgres.TransactionSql,
		kind: AcquisitionKind,
		fileId: string,
		content: ReplacedContent,
	): Promise<void> {
		await this.detachThumbnail(tx, kind, fileId)
		await tx`
			UPDATE ${tableOf(tx, kind)} SET
				binary_object_id = ${content.binaryObjectId}, sha256 = ${content.sha256}, edit_kind = ${content.editKind},
				edited_at = ${content.editedAt}
			WHERE id = ${fileId}
		`
		await this.attachThumbnail(tx, kind, fileId, content.thumbnailBinaryObjectId)
	}

	// CAP-015-R33, CAP-018-R11, CAP-021-R25
	async renumber(tx: postgres.TransactionSql, kind: AcquisitionKind, orderedIds: readonly string[]): Promise<void> {
		if (orderedIds.length === 0) {
			return
		}
		const positions = orderedIds.map((id, index) => [id, String(index + FIRST_SEQUENCE)])
		await tx`
			UPDATE ${tableOf(tx, kind)} AS f SET sequence = (o.sequence)::int
			FROM (VALUES ${tx(positions)}) AS o (id, sequence)
			WHERE f.id = (o.id)::uuid
		`
	}

	// CAP-015-R17, CAP-026-R16
	async binaryObjectIdsOf(sql: Executor, acquisitionId: string, kind: AcquisitionKind): Promise<string[]> {
		const rows = await sql<{ id: string }[]>`
			SELECT f.binary_object_id AS id FROM ${filesOf(sql, kind, acquisitionId)} AS f
			WHERE f.binary_object_id IS NOT NULL
			UNION
			SELECT f.thumbnail_binary_object_id AS id FROM ${filesOf(sql, kind, acquisitionId)} AS f
			WHERE f.thumbnail_binary_object_id IS NOT NULL
		`
		return rows.map((row) => row.id)
	}

	// CAP-014-R22, CAP-015-R29, CAP-015-R35, CAP-015-S51
	async countsOf(sql: Executor, acquisitionIds: readonly string[], deviceId: string): Promise<FileCountRow[]> {
		if (acquisitionIds.length === 0) {
			return []
		}
		return await sql<FileCountRow[]>`
			SELECT f.acquisition_id,
				(count(*) FILTER (WHERE f.status <> ${FILE_STATUS.REMOVED}))::int AS held,
				(count(*) FILTER (WHERE f.status = ${FILE_STATUS.RECEIVED}))::int AS received,
				(count(*) FILTER (WHERE f.status = ${FILE_STATUS.ANNOUNCED}))::int AS announced,
				(count(*) FILTER (WHERE f.status = ${FILE_STATUS.REJECTED}))::int AS rejected,
				(count(*) FILTER (
					WHERE f.status = ${FILE_STATUS.ANNOUNCED} AND f.announced_by_device_id IS DISTINCT FROM ${deviceId}::uuid
				))::int AS announced_elsewhere
			FROM ${fileStatusesOf(sql, acquisitionIds)} AS f
			GROUP BY f.acquisition_id
		`
	}

	// CAP-019-R24, CAP-004-R14
	async receivedCountsOf(sql: Executor, acquisitionIds: readonly string[]): Promise<ReceivedCountRow[]> {
		if (acquisitionIds.length === 0) {
			return []
		}
		return await sql<ReceivedCountRow[]>`
			SELECT f.acquisition_id, count(*)::int AS received
			FROM ${fileStatusesOf(sql, acquisitionIds)} AS f
			WHERE f.status = ${FILE_STATUS.RECEIVED}
			GROUP BY f.acquisition_id
		`
	}

	// CAP-019-R24, CAP-019-R12
	async receivedKeysOf(sql: Executor, acquisitionIds: readonly string[]): Promise<ReceivedFileKeyRow[]> {
		if (acquisitionIds.length === 0) {
			return []
		}
		return await sql<ReceivedFileKeyRow[]>`
			SELECT f.acquisition_id, f.file_key
			FROM ${fileStatusesOf(sql, acquisitionIds)} AS f
			WHERE f.status = ${FILE_STATUS.RECEIVED}
			ORDER BY f.acquisition_id, f.file_key
		`
	}

	private async attachThumbnail(
		tx: postgres.TransactionSql,
		kind: AcquisitionKind,
		fileId: string,
		thumbnailBinaryObjectId: string | undefined,
	): Promise<void> {
		if (thumbnailBinaryObjectId === undefined) {
			return
		}
		switch (kind) {
			case ACQUISITION_KIND.PHOTO:
				await tx`INSERT INTO thumbnail (image_id, binary_object_id) VALUES (${fileId}, ${thumbnailBinaryObjectId})`
				return
			case ACQUISITION_KIND.SCAN:
				await tx`UPDATE document_page SET thumbnail_binary_object_id = ${thumbnailBinaryObjectId} WHERE id = ${fileId}`
				return
			default:
				kind satisfies never
		}
	}

	private async detachThumbnail(tx: postgres.TransactionSql, kind: AcquisitionKind, fileId: string): Promise<void> {
		switch (kind) {
			case ACQUISITION_KIND.PHOTO:
				await tx`DELETE FROM thumbnail WHERE image_id = ${fileId}`
				return
			case ACQUISITION_KIND.SCAN:
				await tx`UPDATE document_page SET thumbnail_binary_object_id = NULL WHERE id = ${fileId}`
				return
			default:
				kind satisfies never
		}
	}
}
