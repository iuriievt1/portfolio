import { AUDIT_EVENT_TYPE, CONFIGURATION_KEY } from "@ansora/core-server"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { signInAgain } from "../../login/utils/login-rejection"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import { FILE_STATUS } from "../constants/acquisition-file.constants"
import { RejectedContentError } from "../errors/rejected-content.error"
import { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import { AcquisitionFileRepository } from "../repositories/acquisition-file.repository"
import type {
	AcquisitionFileRow,
	FileUpload,
	KeptContent,
	NewFileRequest,
	OpenedContent,
	StoredContent,
} from "../types/acquisition-file.types"
import type { QueueSender } from "../types/queue-sender.types"
import { rejected, tooLarge } from "../utils/acquisition-problems"
import { queueAuditEventOf } from "../utils/draft-audit"
import { isForeignToPermission, requirePermittedUpload } from "../utils/queue-sender"
import { sealedSizeOf } from "../utils/sealed-content"
import { storedUploadOf } from "../utils/upload-receipt"
import { AcquisitionFileAnnouncementService } from "./acquisition-file-announcement.service"
import { DraftAccessService } from "./draft-access.service"
import { StoredContentService } from "./stored-content.service"
import { UploadedContentService } from "./uploaded-content.service"

// CAP-015-R35
function requestOf(upload: FileUpload): NewFileRequest {
	return { fileKey: upload.fileKey, proposedSequence: upload.proposedSequence, replacesFileKey: undefined }
}

// CAP-015-R30, CAP-015-R35, CAP-019-R21, CAP-019-R24, CAP-021-R21, CAP-021-R23, CAP-021-R29, CAP-021-R35, ADR-015,
// ADR-014
@Injectable()
export class AcquisitionFileUploadService {
	private readonly logger = new Logger(AcquisitionFileUploadService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly access: DraftAccessService,
		private readonly drafts: AcquisitionDraftRepository,
		private readonly files: AcquisitionFileRepository,
		private readonly announcements: AcquisitionFileAnnouncementService,
		private readonly contents: UploadedContentService,
		private readonly storedContents: StoredContentService,
		private readonly configuration: ConfigurationService,
		private readonly patients: PatientLookupService,
		private readonly audit: AuditRepository,
	) {}

	async upload(sender: QueueSender, upload: FileUpload, now: Date): Promise<AcquisitionFileRow> {
		requirePermittedUpload(sender, upload)
		const known = await this.access.receivingRecord(this.database.sql, sender, upload.acquisitionId)
		if (known.kind !== upload.kind) {
			throw rejected(`the file does not belong to a ${known.kind} record`)
		}
		const maxBytes = await this.configuration.integer(CONFIGURATION_KEY.ACQUISITION_MAX_BYTES)
		if (sealedSizeOf(upload.content) > maxBytes) {
			throw tooLarge(`the upload is larger than ${maxBytes} bytes`)
		}
		const existing = await this.files.findByKey(this.database.sql, known.id, known.kind, upload.fileKey)
		const stored = storedUploadOf(known, existing, upload.sha256)
		if (stored !== undefined) {
			return stored
		}
		const fileLimit = await this.announcements.fileLimitOf(known.kind)
		const opened = await this.openedOrRejected(sender, upload, fileLimit, now)
		const content = await this.storedContents.put(opened)
		return await this.storedContents.keptOrDiscarded(
			content,
			async () =>
				await this.database.sql.begin(
					async (tx: postgres.TransactionSql) => await this.received(tx, sender, upload, content, fileLimit, now),
				),
		)
	}

	// CAP-021-R29, CAP-021-R35, CAP-025-R26
	private async received(
		tx: postgres.TransactionSql,
		sender: QueueSender,
		upload: FileUpload,
		content: StoredContent,
		fileLimit: number,
		now: Date,
	): Promise<KeptContent<AcquisitionFileRow>> {
		const record = await this.access.lockedReceivingRecord(tx, sender, upload.acquisitionId)
		const lockedFile = await this.files.findByKey(tx, record.id, record.kind, upload.fileKey)
		const raced = storedUploadOf(record, lockedFile, upload.sha256)
		if (raced !== undefined) {
			return { result: raced, isContentKept: false }
		}
		const patient = await this.patients.patientOf(record.patient_id)
		const file =
			lockedFile ?? (await this.announcements.announceWithin(tx, record, sender, requestOf(upload), fileLimit, now))
		await this.storedContents.record(tx, content)
		await this.files.markReceived(tx, record.kind, file.id, {
			binaryObjectId: content.file.id,
			thumbnailBinaryObjectId: content.thumbnail?.id,
			sha256: upload.sha256,
			receivedAt: now,
		})
		const updated = await this.drafts.bump(tx, record.id, now)
		await this.audit.append(tx, queueAuditEventOf(sender, patient, updated, AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_UPDATED))
		this.logger.log(`Received file ${upload.fileKey} of acquisition ${record.id} as binary object ${content.file.id}`)
		return { result: await this.files.requireById(tx, record.id, record.kind, file.id), isContentKept: true }
	}

	// CAP-015-R36, CAP-019-R14, CAP-019-S12, CAP-019-R32
	private async openedOrRejected(
		sender: QueueSender,
		upload: FileUpload,
		fileLimit: number,
		now: Date,
	): Promise<OpenedContent> {
		try {
			return this.contents.opened(upload.content, {
				sha256: upload.sha256,
				kind: upload.kind,
			})
		} catch (error) {
			if (!(error instanceof RejectedContentError)) {
				throw error
			}
			if (isForeignToPermission(sender, error)) {
				this.logger.warn(
					`Refused content of file ${upload.fileKey} of acquisition ${upload.acquisitionId} that its upload permission does not cover: ${error.reason}`,
				)
				throw signInAgain()
			}
			await this.recordRejection(sender, upload, fileLimit, now, error)
			throw rejected(error.reason)
		}
	}

	// CAP-015-R36, CAP-025-R26
	private async recordRejection(
		sender: QueueSender,
		upload: FileUpload,
		fileLimit: number,
		now: Date,
		reason: RejectedContentError,
	): Promise<void> {
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const record = await this.access.lockedReceivingRecord(tx, sender, upload.acquisitionId)
			const existing = await this.files.findByKey(tx, record.id, record.kind, upload.fileKey)
			const isRecordable =
				record.state === ACQUISITION_STATE.DRAFT &&
				(existing === undefined || existing.status === FILE_STATUS.ANNOUNCED)
			if (!isRecordable) {
				return
			}
			const patient = await this.patients.patientOf(record.patient_id)
			const file =
				existing ?? (await this.announcements.announceWithin(tx, record, sender, requestOf(upload), fileLimit, now))
			await this.files.markRejected(tx, record.kind, file.id)
			const updated = await this.drafts.bump(tx, record.id, now)
			await this.audit.append(
				tx,
				queueAuditEventOf(sender, patient, updated, AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_UPDATED),
			)
		})
		this.logger.warn(`Rejected file ${upload.fileKey} of acquisition ${upload.acquisitionId}: ${reason.reason}`)
	}
}
