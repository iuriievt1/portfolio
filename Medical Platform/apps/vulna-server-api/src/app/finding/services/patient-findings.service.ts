import { Injectable } from "@nestjs/common"
import { ClinicalReadService } from "../../clinical-record/services/clinical-read.service"
import { readOrRecordNone } from "../../clinical-record/utils/read-or-record-none"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { RELEASED_NONE } from "../../image/constants/image.constants"
import { RecordReleaseService } from "../../image/services/record-release.service"
import type { ReleaseSubject } from "../../image/types/image.types"
import { pageLimit } from "../../infra/utils/page-limit"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { PatientFindingsInput } from "../dto/finding.input.dto"
import { FindingRepository } from "../repositories/finding.repository"
import type { FindingsPageView } from "../types/finding.types"
import { findingViewOf, withHistoryFinding } from "../utils/finding-view"

// CAP-016-R17, CAP-020-R04, CAP-020-R05, CAP-020-R20, CAP-020-R13, ADR-054 bod 2
@Injectable()
export class PatientFindingsService {
	constructor(
		private readonly findings: FindingRepository,
		private readonly reads: ClinicalReadService,
		private readonly configuration: ConfigurationService,
		private readonly patients: PatientLookupService,
		private readonly releases: RecordReleaseService,
	) {}

	async list(current: CurrentSession, input: PatientFindingsInput): Promise<FindingsPageView> {
		const release: ReleaseSubject = {
			kind: undefined,
			objectId: input.patient_id,
			patient: await this.patients.findPatient(input.patient_id),
			encounterId: undefined,
			acquisitionId: undefined,
		}
		const page = await readOrRecordNone(
			() => this.pageOf(current, input),
			() => this.releases.record(current, { ...release, releasedItemCount: RELEASED_NONE }),
		)
		await this.releases.record(current, { ...release, releasedItemCount: page.items.length })
		return page
	}

	private async pageOf(current: CurrentSession, input: PatientFindingsInput): Promise<Required<FindingsPageView>> {
		const history = await this.reads.closedWoundsOfPatient(current, input.patient_id)
		const visibleFindings = new Map(history.findings.map((finding) => [finding.findingId, finding]))
		const wounds = new Map(history.wounds.map((wound) => [wound.acquisitionId, wound]))
		const limit = pageLimit(input.limit, await this.configuration.pageSize())
		const { rows, nextCursor } = await this.findings.listTracked(
			input.patient_id,
			{ findingIds: [...visibleFindings.keys()], acquisitionIds: [...wounds.keys()] },
			input.cursor,
			limit,
		)
		const items = rows.map((row) => {
			const finding = visibleFindings.get(row.id)
			if (finding === undefined) {
				throw new Error(`the finding ${row.id} is not among the visible findings`)
			}
			return findingViewOf(withHistoryFinding(row, finding, wounds.get(row.last_acquisition_id)))
		})
		return { items, next_cursor: nextCursor }
	}
}
