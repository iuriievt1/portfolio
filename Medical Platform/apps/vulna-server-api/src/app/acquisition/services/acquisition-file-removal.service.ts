import { AUDIT_EVENT_TYPE } from "@ansora/core-server"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import { FILE_STATUS } from "../constants/acquisition-file.constants"
import { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import { AcquisitionFileRepository } from "../repositories/acquisition-file.repository"
import type { FileRemoval } from "../types/acquisition-file.types"
import { notFound, versionConflict } from "../utils/acquisition-problems"
import { draftAuditEventOf } from "../utils/draft-audit"
import { binaryObjectIdsOf } from "../utils/file-objects"
import { DraftAccessService } from "./draft-access.service"

// CAP-015-R18, CAP-018-R11, CAP-019-S19, CAP-021-R29, CAP-021-R32, CAP-025-R26, CAP-026-R17
@Injectable()
export class AcquisitionFileRemovalService {
	private readonly logger = new Logger(AcquisitionFileRemovalService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly access: DraftAccessService,
		private readonly drafts: AcquisitionDraftRepository,
		private readonly files: AcquisitionFileRepository,
		private readonly binaries: BinaryObjectService,
		private readonly patients: PatientLookupService,
		private readonly audit: AuditRepository,
	) {}

	async remove(current: CurrentSession, removal: FileRemoval, now: Date): Promise<void> {
		await this.access.changeableDraft(this.database.sql, current, removal.acquisitionId)
		const discarded = await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const draft = await this.access.lockedChangeableDraft(tx, current, removal.acquisitionId)
			const file = await this.files.findByKey(tx, draft.id, draft.kind, removal.fileKey)
			if (file === undefined) {
				throw notFound()
			}
			if (file.status === FILE_STATUS.REMOVED) {
				return []
			}
			if (draft.version !== removal.version) {
				throw versionConflict()
			}
			const patient = await this.patients.patientOf(draft.patient_id)
			const objectIds = binaryObjectIdsOf(file)
			await this.files.markRemoved(tx, draft.kind, file.id)
			await this.binaries.removeAll(tx, objectIds)
			const updated = await this.drafts.bump(tx, draft.id, now)
			await this.audit.append(
				tx,
				draftAuditEventOf(current, patient, updated, AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_UPDATED),
			)
			this.logger.log(`Removed file ${removal.fileKey} of acquisition ${draft.id}`)
			return objectIds
		})
		await this.binaries.discardBytes(discarded)
	}
}
