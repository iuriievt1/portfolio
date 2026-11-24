import { randomUUID } from "node:crypto"
import { ACQUISITION_KIND, type AcquisitionKind } from "@ansora/contracts"
import { CONFIGURATION_KEY } from "@ansora/core-server"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { FILE_STATUS } from "../constants/acquisition-file.constants"
import { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import { AcquisitionFileRepository } from "../repositories/acquisition-file.repository"
import type { AcquisitionRow } from "../types/acquisition.types"
import type {
	AcquisitionFileRow,
	AnnouncementResult,
	FileAnnouncement,
	NewAnnouncedFile,
	NewFileRequest,
} from "../types/acquisition-file.types"
import type { IssuedUploadPermission, QueueSender } from "../types/queue-sender.types"
import { acquisitionDraftFileViewOf, fileKindOf } from "../utils/acquisition-file-view"
import { alreadyDecided, idempotencyConflict, rejected, tooLarge } from "../utils/acquisition-problems"
import { senderDeviceOf, senderSessionOf } from "../utils/queue-sender"
import { DraftAccessService } from "./draft-access.service"
import { UploadPermissionService } from "./upload-permission.service"

// CAP-015-R35, CAP-015-R36, CAP-019-R14, CAP-021-R23, CAP-021-R29, CAP-021-S22, ADR-014
@Injectable()
export class AcquisitionFileAnnouncementService {
	private readonly logger = new Logger(AcquisitionFileAnnouncementService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly access: DraftAccessService,
		private readonly drafts: AcquisitionDraftRepository,
		private readonly files: AcquisitionFileRepository,
		private readonly permissions: UploadPermissionService,
		private readonly configuration: ConfigurationService,
	) {}

	async announce(sender: QueueSender, announcement: FileAnnouncement, now: Date): Promise<AnnouncementResult> {
		const known = await this.access.receivingRecord(this.database.sql, sender, announcement.acquisitionId)
		if (fileKindOf(known.kind) !== announcement.fileKind) {
			throw rejected(`a ${announcement.fileKind} does not belong to a ${known.kind} record`)
		}
		const fileLimit = await this.fileLimitOf(known.kind)
		const deviceId = senderDeviceOf(sender).id
		return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const record = await this.access.lockedReceivingRecord(tx, sender, announcement.acquisitionId)
			const existing = await this.files.findByKey(tx, record.id, record.kind, announcement.fileKey)
			if (existing !== undefined) {
				await this.requireSameAnnouncement(tx, record, existing, announcement)
				return {
					created: false,
					file: acquisitionDraftFileViewOf(record.kind, existing, deviceId),
					permission: await this.permissionFor(tx, record, announcement, sender, now),
				}
			}
			// CAP-019-R14, CAP-019-S18
			if (record.state !== ACQUISITION_STATE.DRAFT) {
				throw alreadyDecided()
			}
			const file = await this.announceWithin(tx, record, sender, announcement, fileLimit, now)
			await this.drafts.bump(tx, record.id, now)
			return {
				created: true,
				file: acquisitionDraftFileViewOf(record.kind, file, deviceId),
				permission: await this.permissionFor(tx, record, announcement, sender, now),
			}
		})
	}

	// CAP-015-R13, CAP-018-R12
	async fileLimitOf(kind: AcquisitionKind): Promise<number> {
		switch (kind) {
			case ACQUISITION_KIND.PHOTO:
				return await this.configuration.integer(CONFIGURATION_KEY.ACQUISITION_MAX_IMAGES)
			case ACQUISITION_KIND.SCAN:
				return await this.configuration.integer(CONFIGURATION_KEY.DOCUMENT_MAX_PAGES)
			default:
				return kind satisfies never
		}
	}

	// CAP-015-R35, CAP-015-R36
	async announceWithin(
		tx: postgres.TransactionSql,
		draft: AcquisitionRow,
		sender: QueueSender,
		request: NewFileRequest,
		fileLimit: number,
		now: Date,
	): Promise<AcquisitionFileRow> {
		const replaced = await this.replacedFileOf(tx, draft, request.replacesFileKey)
		if (replaced === undefined) {
			await this.requireRoomFor(tx, draft, fileLimit)
		} else {
			await this.files.markRemoved(tx, draft.kind, replaced.id)
		}
		const file: NewAnnouncedFile = {
			id: randomUUID(),
			acquisitionId: draft.id,
			kind: draft.kind,
			fileKey: request.fileKey,
			sequence: replaced?.sequence ?? (await this.files.nextSequence(tx, draft.id, draft.kind)),
			proposedSequence: request.proposedSequence ?? null,
			deviceId: senderDeviceOf(sender).id,
			replacesFileId: replaced?.id ?? null,
			announcedAt: now,
		}
		await this.files.insertAnnounced(tx, file)
		this.logger.log(`Announced file ${file.fileKey} of acquisition ${draft.id} at sequence ${file.sequence}`)
		return await this.files.requireById(tx, draft.id, draft.kind, file.id)
	}

	// ADR-014, CAP-025-R17
	private async permissionFor(
		tx: postgres.TransactionSql,
		record: AcquisitionRow,
		announcement: FileAnnouncement,
		sender: QueueSender,
		now: Date,
	): Promise<IssuedUploadPermission> {
		return await this.permissions.issue(
			tx,
			{
				acquisitionId: record.id,
				fileKey: announcement.fileKey,
				deviceId: senderDeviceOf(sender).id,
				senderSession: senderSessionOf(sender),
				sha256: announcement.sha256,
			},
			now,
		)
	}

	// CAP-015-R36, CAP-019-S12
	private async replacedFileOf(
		tx: postgres.TransactionSql,
		draft: AcquisitionRow,
		replacesFileKey: string | undefined,
	): Promise<AcquisitionFileRow | undefined> {
		if (replacesFileKey === undefined) {
			return undefined
		}
		const replaced = await this.files.findByKey(tx, draft.id, draft.kind, replacesFileKey)
		if (replaced?.status !== FILE_STATUS.REJECTED) {
			throw rejected("replaces_file_key names no rejected file of the record")
		}
		return replaced
	}

	// CAP-015-R13, CAP-018-R12
	private async requireRoomFor(tx: postgres.TransactionSql, draft: AcquisitionRow, fileLimit: number): Promise<void> {
		const held = await this.files.listHeld(tx, draft.id, draft.kind)
		if (held.length >= fileLimit) {
			throw tooLarge(`the record already holds ${held.length} of ${fileLimit} files`)
		}
	}

	// CAP-021-R29, CAP-019-S19
	private async requireSameAnnouncement(
		tx: postgres.TransactionSql,
		draft: AcquisitionRow,
		existing: AcquisitionFileRow,
		announcement: FileAnnouncement,
	): Promise<void> {
		if (existing.status === FILE_STATUS.REMOVED) {
			throw alreadyDecided()
		}
		const replaced =
			existing.replaces_file_id === null
				? undefined
				: await this.files.findById(tx, draft.id, draft.kind, existing.replaces_file_id)
		const isSame =
			(existing.proposed_sequence ?? undefined) === announcement.proposedSequence &&
			replaced?.file_key === announcement.replacesFileKey
		if (!isSame) {
			throw idempotencyConflict()
		}
	}
}
