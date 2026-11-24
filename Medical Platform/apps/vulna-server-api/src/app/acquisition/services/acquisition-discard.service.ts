import { EMPTIED_BY } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE } from "@ansora/core-server"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { sessionActorOf } from "../../audit/utils/user-audit-event"
import { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import type { CurrentSession } from "../../login/types/login.types"
import { DECISION_REASON } from "../constants/acquisition.constants"
import type { DiscardRequest } from "../types/acquisition-file.types"
import { closed, versionConflict } from "../utils/acquisition-problems"
import { DraftAccessService } from "./draft-access.service"
import { DraftRemovalService } from "./draft-removal.service"

// CAP-015-R17, CAP-014-R29, CAP-019-R14, CAP-021-R29, CAP-021-R32, CAP-025-R20, CAP-025-R29, ADR-038, ADR-054
@Injectable()
export class AcquisitionDiscardService {
	constructor(
		private readonly database: DatabaseService,
		private readonly access: DraftAccessService,
		private readonly encounters: EncounterRepository,
		private readonly removal: DraftRemovalService,
		private readonly binaries: BinaryObjectService,
	) {}

	async discard(current: CurrentSession, request: DiscardRequest, now: Date): Promise<void> {
		const known = await this.access.undecidedDraft(this.database.sql, current, request.acquisitionId)
		if (known === undefined) {
			return
		}
		if (known.version !== request.version) {
			throw versionConflict()
		}
		const discarded = await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const [encounter] = await this.encounters.lockByIds(tx, [known.encounter_id])
			const draft = await this.access.lockOwn(tx, current, request.acquisitionId)
			if (draft === undefined) {
				return []
			}
			if (draft.state !== ACQUISITION_STATE.DRAFT) {
				throw closed()
			}
			if (encounter === undefined || draft.version !== request.version || encounter.id !== draft.encounter_id) {
				throw versionConflict()
			}
			return await this.removal.removeWithin(
				tx,
				sessionActorOf(current),
				draft,
				encounter,
				{
					reason: DECISION_REASON.DISCARDED,
					eventType: AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_DISCARD,
					emptiedBy: EMPTIED_BY.DISCARD,
					details: (discardedFileCount) => ({
						situation: request.situation,
						discarded_file_count: discardedFileCount,
					}),
				},
				now,
			)
		})
		await this.binaries.discardBytes(discarded)
	}
}
