import { type AcquisitionKind, AUDIT_EVENT_TYPE } from "@ansora/contracts"
import { CONFIGURATION_KEY } from "@ansora/core-server"
import { mergedEditKindOf } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { FoundPatient } from "../../registry/types/registry.types"
import { FILE_STATUS } from "../constants/acquisition-file.constants"
import { RejectedContentError } from "../errors/rejected-content.error"
import { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import { AcquisitionFileRepository } from "../repositories/acquisition-file.repository"
import type { AcquisitionRow } from "../types/acquisition.types"
import type {
	AcquisitionDraftFileView,
	AcquisitionFileRow,
	FileReplacement,
	KeptContent,
	OpenedContent,
	ReplacementOutcome,
	StoredContent,
} from "../types/acquisition-file.types"
import { acquisitionDraftFileViewOf } from "../utils/acquisition-file-view"
import { notFound, rejected, tooLarge, versionConflict } from "../utils/acquisition-problems"
import { draftAuditEventOf } from "../utils/draft-audit"
import { binaryObjectIdsOf } from "../utils/file-objects"
import { sealedSizeOf } from "../utils/sealed-content"
import { DraftAccessService } from "./draft-access.service"
import { StoredContentService } from "./stored-content.service"
import { UploadedContentService } from "./uploaded-content.service"

// CAP-015-R34, CAP-015-S56
function receivedOrMissing(file: AcquisitionFileRow | undefined): AcquisitionFileRow {
	if (file?.status !== FILE_STATUS.RECEIVED) {
		throw notFound()
	}
	return file
}

// CAP-015-R34, CAP-018-R11, CAP-021-R07, CAP-021-R29, CAP-021-R32, CAP-025-R26, CAP-026-R17, Q-131
@Injectable()
export class AcquisitionFileReplacementService {
	private readonly logger = new Logger(AcquisitionFileReplacementService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly access: DraftAccessService,
		private readonly drafts: AcquisitionDraftRepository,
		private readonly files: AcquisitionFileRepository,
		private readonly contents: UploadedContentService,
		private readonly storedContents: StoredContentService,
		private readonly binaries: BinaryObjectService,
		private readonly configuration: ConfigurationService,
		private readonly patients: PatientLookupService,
		private readonly audit: AuditRepository,
	) {}

	async replace(current: CurrentSession, replacement: FileReplacement, now: Date): Promise<AcquisitionDraftFileView> {
		const known = await this.access.changeableDraft(this.database.sql, current, replacement.acquisitionId)
		const file = receivedOrMissing(
			await this.files.findByKey(this.database.sql, known.id, known.kind, replacement.fileKey),
		)
		if (file.sha256 === replacement.sha256) {
			return acquisitionDraftFileViewOf(known.kind, file, current.device.id)
		}
		if (known.version !== replacement.version) {
			throw versionConflict()
		}
		const maxBytes = await this.configuration.integer(CONFIGURATION_KEY.ACQUISITION_MAX_BYTES)
		if (sealedSizeOf(replacement.content) > maxBytes) {
			throw tooLarge(`the replacement is larger than ${maxBytes} bytes`)
		}
		const content = await this.storedContents.put(this.openedOrRejected(replacement, known.kind))
		const outcome = await this.storedContents.keptOrDiscarded(
			content,
			async () =>
				await this.database.sql.begin(
					async (tx: postgres.TransactionSql) => await this.replaced(tx, current, replacement, content, now),
				),
		)
		await this.binaries.discardBytes(outcome.discardedObjectIds)
		return acquisitionDraftFileViewOf(known.kind, outcome.file, current.device.id)
	}

	// CAP-021-R07
	private openedOrRejected(replacement: FileReplacement, kind: AcquisitionKind): OpenedContent {
		try {
			return this.contents.opened(replacement.content, {
				sha256: replacement.sha256,
				kind,
			})
		} catch (error) {
			if (error instanceof RejectedContentError) {
				this.logger.warn(
					`Rejected the replacement of file ${replacement.fileKey} of acquisition ${replacement.acquisitionId}: ${error.reason}`,
				)
				throw rejected(error.reason)
			}
			throw error
		}
	}

	// CAP-015-R34, CAP-021-R35, CAP-026-R14, CAP-026-R17
	private async replaced(
		tx: postgres.TransactionSql,
		current: CurrentSession,
		replacement: FileReplacement,
		content: StoredContent,
		now: Date,
	): Promise<KeptContent<ReplacementOutcome>> {
		const draft = await this.access.lockedChangeableDraft(tx, current, replacement.acquisitionId)
		const file = receivedOrMissing(await this.files.findByKey(tx, draft.id, draft.kind, replacement.fileKey))
		if (file.sha256 === replacement.sha256) {
			return { result: { file, discardedObjectIds: [] }, isContentKept: false }
		}
		if (draft.version !== replacement.version) {
			throw versionConflict()
		}
		const patient = await this.patients.patientOf(draft.patient_id)
		const previousObjectIds = binaryObjectIdsOf(file)
		const editKind = mergedEditKindOf(file.edit_kind, replacement.edit)
		await this.storedContents.record(tx, content)
		await this.files.replaceContent(tx, draft.kind, file.id, {
			binaryObjectId: content.file.id,
			thumbnailBinaryObjectId: content.thumbnail?.id,
			sha256: replacement.sha256,
			editKind,
			editedAt: now,
		})
		await this.binaries.removeAll(tx, previousObjectIds)
		const updated = await this.drafts.bump(tx, draft.id, now)
		await this.auditReplacement(tx, current, patient, updated, replacement.fileKey, editKind)
		this.logger.log(
			`Replaced file ${replacement.fileKey} of acquisition ${draft.id} by binary object ${content.file.id}`,
		)
		const replaced = await this.files.requireById(tx, draft.id, draft.kind, file.id)
		return { result: { file: replaced, discardedObjectIds: previousObjectIds }, isContentKept: true }
	}

	// CAP-025-R26, CAP-025-S26
	private async auditReplacement(
		tx: postgres.TransactionSql,
		current: CurrentSession,
		patient: FoundPatient,
		draft: AcquisitionRow,
		fileKey: string,
		editKind: string,
	): Promise<void> {
		await this.audit.append(
			tx,
			draftAuditEventOf(current, patient, draft, AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_FILE_REPLACED, {
				file_edit: { file_key: fileKey, edit: editKind },
			}),
		)
	}
}
