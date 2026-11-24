import { AUDIT_EVENT_TYPE } from "@ansora/contracts"
import { calendarDayIn, INSTANCE_TIME_ZONE } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { ViewerService } from "../../clinical-record/services/viewer.service"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import { AcquisitionFileRepository } from "../repositories/acquisition-file.repository"
import type { AcquisitionDraftView } from "../types/acquisition.types"
import type { AcquisitionFileRow, FileOrder } from "../types/acquisition-file.types"
import { rejected, versionConflict } from "../utils/acquisition-problems"
import { draftAuditEventOf } from "../utils/draft-audit"
import { AcquisitionDraftViewService } from "./acquisition-draft-view.service"
import { DraftAccessService } from "./draft-access.service"

// CAP-015-R35
function isExactlyHeld(held: readonly AcquisitionFileRow[], fileKeys: readonly string[]): boolean {
	const heldKeys = new Set(held.map((file) => file.file_key))
	return fileKeys.length === heldKeys.size && fileKeys.every((key) => heldKeys.has(key))
}

// CAP-021-R29
function isSameOrder(held: readonly AcquisitionFileRow[], fileKeys: readonly string[]): boolean {
	return held.every((file, index) => file.file_key === fileKeys[index])
}

// CAP-015-R33, CAP-015-R35, CAP-018-R11, CAP-018-S10, CAP-021-R29, CAP-021-R32, CAP-025-R26
@Injectable()
export class AcquisitionFileOrderService {
	private readonly logger = new Logger(AcquisitionFileOrderService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly access: DraftAccessService,
		private readonly drafts: AcquisitionDraftRepository,
		private readonly files: AcquisitionFileRepository,
		private readonly views: AcquisitionDraftViewService,
		private readonly viewers: ViewerService,
		private readonly patients: PatientLookupService,
		private readonly audit: AuditRepository,
	) {}

	async reorder(current: CurrentSession, order: FileOrder, now: Date): Promise<AcquisitionDraftView> {
		await this.access.changeableDraft(this.database.sql, current, order.acquisitionId)
		const viewer = await this.viewers.viewerOf(current)
		const today = calendarDayIn(INSTANCE_TIME_ZONE, now)
		return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const draft = await this.access.lockedChangeableDraft(tx, current, order.acquisitionId)
			const patient = await this.patients.patientOf(draft.patient_id)
			const held = await this.files.listHeld(tx, draft.id, draft.kind)
			if (!isExactlyHeld(held, order.fileKeys)) {
				throw rejected("file_keys must name exactly the files the record holds")
			}
			if (isSameOrder(held, order.fileKeys)) {
				return await this.views.viewOf(tx, draft, patient, viewer, today, current.device.id)
			}
			if (draft.version !== order.version) {
				throw versionConflict()
			}
			const idOfKey = new Map(held.map((file) => [file.file_key, file.id]))
			const orderedIds = order.fileKeys.flatMap((key) => idOfKey.get(key) ?? [])
			await this.files.renumber(tx, draft.kind, orderedIds)
			const updated = await this.drafts.bump(tx, draft.id, now)
			await this.audit.append(
				tx,
				draftAuditEventOf(current, patient, updated, AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_FILE_ORDER_CHANGED, {
					file_order: [...order.fileKeys],
				}),
			)
			this.logger.log(`Reordered ${orderedIds.length} files of acquisition ${draft.id}`)
			return await this.views.viewOf(tx, updated, patient, viewer, today, current.device.id)
		})
	}
}
