import { AUDIT_EVENT_TYPE, EMPTIED_BY } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { sessionActorOf } from "../../audit/utils/user-audit-event"
import { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import type { CurrentSession } from "../../login/types/login.types"
import { DECISION_REASON } from "../constants/acquisition.constants"
import { AcquisitionFileRepository } from "../repositories/acquisition-file.repository"
import { closed, hasFiles, versionConflict } from "../utils/acquisition-problems"
import { DraftAccessService } from "./draft-access.service"
import { DraftRemovalService } from "./draft-removal.service"

const NO_DETAILS = () => ({})

// CAP-015-R37, CAP-014-R29, CAP-015-S54, CAP-015-S55, CAP-018-S11, CAP-021-R29, CAP-025-R29, ADR-054
@Injectable()
export class AcquisitionCancellationService {
	constructor(
		private readonly database: DatabaseService,
		private readonly access: DraftAccessService,
		private readonly encounters: EncounterRepository,
		private readonly files: AcquisitionFileRepository,
		private readonly removal: DraftRemovalService,
		private readonly binaries: BinaryObjectService,
	) {}

	async cancel(current: CurrentSession, acquisitionId: string, now: Date): Promise<void> {
		const known = await this.access.undecidedDraft(this.database.sql, current, acquisitionId)
		if (known === undefined) {
			return
		}
		const discarded = await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const [encounter] = await this.encounters.lockByIds(tx, [known.encounter_id])
			const draft = await this.access.lockOwn(tx, current, acquisitionId)
			if (draft === undefined) {
				return []
			}
			if (draft.state !== ACQUISITION_STATE.DRAFT) {
				throw closed()
			}
			if (encounter === undefined || encounter.id !== draft.encounter_id) {
				throw versionConflict()
			}
			if ((await this.files.listHeld(tx, draft.id, draft.kind)).length > 0) {
				throw hasFiles()
			}
			return await this.removal.removeWithin(
				tx,
				sessionActorOf(current),
				draft,
				encounter,
				{
					reason: DECISION_REASON.CANCELLED,
					eventType: AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_CANCELLED,
					emptiedBy: EMPTIED_BY.CANCELLATION,
					details: NO_DETAILS,
				},
				now,
			)
		})
		await this.binaries.discardBytes(discarded)
	}
}
