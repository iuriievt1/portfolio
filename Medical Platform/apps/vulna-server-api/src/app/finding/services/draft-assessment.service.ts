import { CODE_LIST } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { FindingRecordService } from "../../clinical-record/services/finding-record.service"
import type { DraftAssessmentRecord } from "../../clinical-record/types/clinical-record.types"
import { CodeListChoiceService } from "../../code-list/services/code-list-choice.service"
import { AssessmentRepository } from "../repositories/assessment.repository"
import { BodySiteRepository } from "../repositories/body-site.repository"
import { FindingRepository } from "../repositories/finding.repository"
import type {
	AssessmentChoice,
	AssessmentRequest,
	AssessmentRow,
	LocatedDraft,
	StoredAssessment,
} from "../types/finding.types"

function storedOf(row: AssessmentRow): StoredAssessment {
	return {
		acquisitionId: row.acquisition_id,
		healingPhaseCode: row.healing_phase_code,
		codeListVersion: row.code_list_version,
		description: row.description,
	}
}

// CAP-017-R16, CHG-181
function healingPhaseOf(
	choice: AssessmentChoice,
	before: AssessmentRow | undefined,
): Pick<StoredAssessment, "healingPhaseCode" | "codeListVersion"> {
	if (choice.healingPhaseCode !== undefined && choice.codeListVersion !== undefined) {
		return { healingPhaseCode: choice.healingPhaseCode, codeListVersion: choice.codeListVersion }
	}
	return { healingPhaseCode: before?.healing_phase_code ?? null, codeListVersion: before?.code_list_version ?? null }
}

// CAP-017-R04
function descriptionOf(requested: string | undefined, before: AssessmentRow | undefined): string | null {
	if (requested === undefined) {
		return before?.description ?? null
	}
	const text = requested.trim()
	return text === "" ? null : text
}

// CAP-017-R03, CAP-017-R04, CAP-017-R09, CAP-017-R16, ADR-054 bod 3
@Injectable()
export class DraftAssessmentService {
	constructor(
		private readonly assessments: AssessmentRepository,
		private readonly sites: BodySiteRepository,
		private readonly findings: FindingRepository,
		private readonly choices: CodeListChoiceService,
		private readonly records: FindingRecordService,
	) {}

	// CAP-017-R09, CAP-017-R16
	async check(tx: postgres.TransactionSql, request: AssessmentRequest): Promise<AssessmentChoice> {
		const { healingPhaseCode, codeListVersion, description } = request
		if (healingPhaseCode === undefined || codeListVersion === undefined) {
			return { healingPhaseCode: undefined, codeListVersion: undefined, description }
		}
		const version = await this.choices.choose(tx, CODE_LIST.HEALING_PHASE, healingPhaseCode, codeListVersion)
		return { healingPhaseCode, codeListVersion: version, description }
	}

	// ADR-054 bod 3
	async apply(
		tx: postgres.TransactionSql,
		draft: LocatedDraft,
		findingId: string,
		choice: AssessmentChoice,
		now: Date,
	): Promise<void> {
		const before = await this.assessments.findByAcquisition(tx, draft.id)
		const assessment: StoredAssessment = {
			acquisitionId: draft.id,
			...healingPhaseOf(choice, before),
			description: descriptionOf(choice.description, before),
		}
		// CAP-017-R04, CHG-181
		if (assessment.healingPhaseCode === null && assessment.description === null) {
			await this.withdraw(tx, draft)
			await this.assessments.remove(tx, draft.id)
			return
		}
		await this.assessments.upsert(tx, assessment, now)
		await this.records.recordAssessment(tx, await this.recordOf(tx, draft, findingId, assessment))
	}

	// CAP-016-R17, CAP-014-R26
	async followFinding(tx: postgres.TransactionSql, draft: LocatedDraft, findingId: string | null): Promise<void> {
		const stored = await this.assessments.findByAcquisition(tx, draft.id)
		if (stored === undefined || findingId === null) {
			return
		}
		await this.records.recordAssessment(tx, await this.recordOf(tx, draft, findingId, storedOf(stored)))
	}

	// ADR-050 (doplnění D33) bod 3, ADR-052 bod 6
	async withdraw(tx: postgres.TransactionSql, draft: LocatedDraft): Promise<void> {
		const stored = await this.assessments.findByAcquisition(tx, draft.id)
		if (stored === undefined || draft.finding_id === null) {
			return
		}
		await this.records.withdrawAssessment(tx, await this.recordOf(tx, draft, draft.finding_id, storedOf(stored)))
	}

	private async recordOf(
		tx: postgres.TransactionSql,
		draft: LocatedDraft,
		findingId: string,
		assessment: StoredAssessment,
	): Promise<DraftAssessmentRecord> {
		const finding = await this.findings.findById(tx, findingId)
		const site = await this.sites.findByAcquisition(tx, draft.id)
		if (finding === undefined || site === undefined) {
			throw new Error(`the record ${draft.id} has an assessment without a finding ${findingId} or a body site`)
		}
		return {
			acquisitionId: draft.id,
			findingId,
			patientId: finding.patient_id,
			departmentId: draft.department_id,
			bodyDiagramVersion: site.body_diagram_version,
			healingPhaseCode: assessment.healingPhaseCode ?? undefined,
			description: assessment.description,
		}
	}
}
