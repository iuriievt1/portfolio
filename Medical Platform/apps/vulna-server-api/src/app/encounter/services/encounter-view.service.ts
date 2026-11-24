import { calendarDayIn, INSTANCE_TIME_ZONE } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { AcquisitionDraftRepository } from "../../acquisition/repositories/acquisition-draft.repository"
import { ClinicalReadService } from "../../clinical-record/services/clinical-read.service"
import type { RecordVisibility } from "../../clinical-record/types/clinical-record.types"
import type { CurrentSession } from "../../login/types/login.types"
import type { EncounterRow, EncounterView } from "../types/encounter.types"
import { encounterViewOf } from "../utils/encounter-view"

// CAP-014-R19, CAP-014-R27, CAP-014-S24
@Injectable()
export class EncounterViewService {
	constructor(
		private readonly database: DatabaseService,
		private readonly drafts: AcquisitionDraftRepository,
		private readonly reads: ClinicalReadService,
	) {}

	async viewsOf(current: CurrentSession, rows: readonly EncounterRow[], now: Date): Promise<EncounterView[]> {
		const visibility = await this.reads.recordVisibilityOf(
			current,
			rows.map((row) => row.id),
		)
		return await this.viewsWith(visibility, rows, now)
	}

	async viewOf(current: CurrentSession, row: EncounterRow, now: Date): Promise<EncounterView> {
		return await this.viewWith(await this.reads.recordVisibilityOf(current, [row.id]), row, now)
	}

	// CAP-014-R22
	async viewWith(visibility: RecordVisibility, row: EncounterRow, now: Date): Promise<EncounterView> {
		const [view] = await this.viewsWith(visibility, [row], now)
		if (view === undefined) {
			throw new Error(`the visit ${row.id} produced no view`)
		}
		return view
	}

	// CAP-003-R01, CAP-020-R16
	async viewsWith(visibility: RecordVisibility, rows: readonly EncounterRow[], now: Date): Promise<EncounterView[]> {
		const counts = await this.drafts.visibleCounts(
			this.database.sql,
			rows.map((row) => row.id),
			visibility,
		)
		const countOf = new Map(counts.map((count) => [count.encounter_id, count.count]))
		const today = calendarDayIn(INSTANCE_TIME_ZONE, now)
		return rows.map((row) => encounterViewOf(row, countOf.get(row.id) ?? 0, today))
	}
}
