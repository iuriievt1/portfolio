import { CODE_LIST } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { FindingRecordService } from "../../clinical-record/services/finding-record.service"
import { CodeListChoiceService } from "../../code-list/services/code-list-choice.service"
import { WoundTypeLockedError } from "../errors/wound-type-locked.error"
import { FindingRepository } from "../repositories/finding.repository"
import type { FindingRow, LocatedDraft, WoundTypeChoice, WoundTypeRequest } from "../types/finding.types"

// CAP-017-R02, CAP-017-R16, CAP-020-R19, CAP-017-S13, CAP-017-S14
@Injectable()
export class FindingWoundTypeService {
	constructor(
		private readonly findings: FindingRepository,
		private readonly choices: CodeListChoiceService,
		private readonly records: FindingRecordService,
	) {}

	// CAP-017-R16, CAP-017-S14
	async check(
		tx: postgres.TransactionSql,
		existingFindingId: string | undefined,
		request: WoundTypeRequest,
	): Promise<WoundTypeChoice> {
		const version = await this.choices.choose(tx, CODE_LIST.WOUND_TYPE, request.code, request.codeListVersion)
		const choice: WoundTypeChoice = { code: request.code, codeListVersion: version, setBy: request.userId }
		// CAP-020-R13
		if (existingFindingId === undefined) {
			return choice
		}
		const finding = await this.findingOf(tx, existingFindingId)
		if (finding.wound_type_code !== request.code && (await this.isLocked(tx, finding, request.userId))) {
			throw new WoundTypeLockedError(finding.id, finding.wound_type_code, request.code, version)
		}
		return choice
	}

	// CAP-020-R19, ADR-054 bod 3
	async apply(
		tx: postgres.TransactionSql,
		draft: LocatedDraft,
		findingId: string,
		choice: WoundTypeChoice,
	): Promise<void> {
		const finding = await this.findingOf(tx, findingId)
		if (finding.wound_type_code === choice.code) {
			return
		}
		await this.findings.setWoundType(tx, finding.id, choice)
		await this.records.recordWoundType(tx, {
			findingId: finding.id,
			acquisitionId: draft.id,
			patientId: finding.patient_id,
			departmentId: finding.department_id,
			woundTypeCode: choice.code,
		})
	}

	private async findingOf(tx: postgres.TransactionSql, findingId: string): Promise<FindingRow> {
		const finding = await this.findings.findById(tx, findingId)
		if (finding === undefined) {
			throw new Error(`the finding ${findingId} of a wound type choice is missing`)
		}
		return finding
	}

	// CAP-017-R02
	private async isLocked(tx: postgres.TransactionSql, finding: FindingRow, userId: string): Promise<boolean> {
		if (await this.findings.hasClosedRecord(tx, finding.id)) {
			return true
		}
		return finding.created_by !== userId && finding.wound_type_set_by !== userId
	}
}
