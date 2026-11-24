import { CODE_LIST, ERROR_CODE } from "@ansora/contracts"
import type { HistoryFinding, HistoryWoundRecord } from "@ansora/vulna-domain"
import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { userAuditEventOf } from "../../audit/utils/user-audit-event"
import { ClinicalReadService } from "../../clinical-record/services/clinical-read.service"
import { FindingRecordService } from "../../clinical-record/services/finding-record.service"
import { CodeListChoiceService } from "../../code-list/services/code-list-choice.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { FindingWoundTypeChangeInput } from "../dto/finding.input.dto"
import { FindingRepository } from "../repositories/finding.repository"
import { WoundTypeChangeRepository } from "../repositories/wound-type-change.repository"
import type { FindingView } from "../types/finding.types"
import { findingViewOf, withHistoryFinding } from "../utils/finding-view"
import { woundTypeChangeAuditOf, woundTypeChangeOf, woundTypeChangeRecordOf } from "../utils/wound-type-change"

function notFound(): ProblemException {
	return new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
}

// CAP-020-R21, CAP-020-R16, CAP-017-R02, CAP-025-R30, CAP-020-S25, CAP-020-S26, ADR-054 bod 2, ADR-054 bod 3
@Injectable()
export class FindingWoundTypeChangeService {
	private readonly logger = new Logger(FindingWoundTypeChangeService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly findings: FindingRepository,
		private readonly reads: ClinicalReadService,
		private readonly changes: WoundTypeChangeRepository,
		private readonly records: FindingRecordService,
		private readonly choices: CodeListChoiceService,
		private readonly patients: PatientLookupService,
		private readonly audit: AuditRepository,
	) {}

	async change(
		current: CurrentSession,
		findingId: string,
		input: FindingWoundTypeChangeInput,
		now: Date,
	): Promise<FindingView> {
		const stored = await this.findings.findById(this.database.sql, findingId)
		const records = stored === undefined ? undefined : await this.reads.closedRecordsOfFinding(current, stored.id)
		const visible = records?.findings.find((finding) => finding.findingId === findingId)
		if (stored === undefined || records === undefined || visible === undefined) {
			throw notFound()
		}
		const patient = await this.patients.patientOf(stored.patient_id)
		const woundTypeCode = await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const finding = await this.findings.lockById(tx, findingId)
			if (finding === undefined) {
				throw notFound()
			}
			// CAP-021-R29
			if (finding.wound_type_code === input.wound_type_code) {
				return visible.woundTypeCode
			}
			if (finding.wound_type_code !== input.previous_wound_type_code) {
				throw new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.FINDING_WOUND_TYPE_CONFLICT)
			}
			const codeListVersion = await this.choices.choose(
				tx,
				CODE_LIST.WOUND_TYPE,
				input.wound_type_code,
				input.code_list_version,
			)
			const change = woundTypeChangeOf(finding, input.wound_type_code, codeListVersion, current.session.userId, now)
			await this.findings.setWoundType(tx, finding.id, {
				code: change.code,
				codeListVersion: change.codeListVersion,
				setBy: change.changedBy,
			})
			await this.changes.insert(tx, change)
			await this.records.recordWoundTypeChange(tx, woundTypeChangeRecordOf(finding, change))
			await this.audit.append(tx, userAuditEventOf(current, woundTypeChangeAuditOf(patient, change)))
			this.logger.log(`The wound type of the finding ${finding.id} changed (change ${change.id})`)
			return change.code
		})
		return await this.viewOf(findingId, { ...visible, woundTypeCode }, records.wounds)
	}

	// ADR-054 bod 2, CAP-020-R20
	private async viewOf(
		findingId: string,
		finding: HistoryFinding,
		wounds: readonly HistoryWoundRecord[],
	): Promise<FindingView> {
		const visibleWounds = new Map(wounds.map((wound) => [wound.acquisitionId, wound]))
		const tracked = await this.findings.trackedById(findingId, [...visibleWounds.keys()])
		if (tracked === undefined) {
			throw new Error(`the finding ${findingId} has no visible closed record`)
		}
		return findingViewOf(withHistoryFinding(tracked, finding, visibleWounds.get(tracked.last_acquisition_id)))
	}
}
