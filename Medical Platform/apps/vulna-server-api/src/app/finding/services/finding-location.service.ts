import { randomUUID } from "node:crypto"
import { ERROR_CODE } from "@ansora/contracts"
import { type BodySite, bodySiteProblemOf } from "@ansora/vulna-domain"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { FindingRecordService } from "../../clinical-record/services/finding-record.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { BodySiteRepository } from "../repositories/body-site.repository"
import { FindingRepository } from "../repositories/finding.repository"
import type { ChosenFinding, FindingRow, LocatedDraft } from "../types/finding.types"
import { bodySiteOfRow, isSameBodySite } from "../utils/body-site-view"

function notFound(): ProblemException {
	return new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
}

function rejected(): ProblemException {
	return new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.RECORD_REJECTED)
}

// CAP-014-R26
function patientMismatch(): ProblemException {
	return new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.PATIENT_MISMATCH)
}

// CAP-020-R04
function isInDepartment(finding: FindingRow, departmentId: string | null): boolean {
	return finding.department_id !== null && finding.department_id === departmentId
}

// CAP-016-R06, CAP-016-S02
function validated(site: BodySite): BodySite {
	if (bodySiteProblemOf(site) !== undefined) {
		throw rejected()
	}
	return site
}

// CAP-016-R14, CAP-016-R17, CAP-015-R31, CAP-020-R13, CAP-014-R26
@Injectable()
export class FindingLocationService {
	constructor(
		private readonly findings: FindingRepository,
		private readonly sites: BodySiteRepository,
		private readonly records: FindingRecordService,
	) {}

	// CAP-016-R17, CAP-016-S10, CAP-014-S44
	async chooseExisting(
		tx: postgres.TransactionSql,
		draft: LocatedDraft,
		findingId: string,
		site: BodySite | undefined,
	): Promise<string> {
		const chosen = await this.checkExisting(tx, draft, findingId, site)
		if (chosen.closedSite === undefined) {
			return site === undefined ? chosen.finding.id : await this.moveNew(tx, draft, site)
		}
		await this.withdrawNew(tx, draft)
		await this.sites.upsert(tx, draft.id, chosen.closedSite)
		return chosen.finding.id
	}

	// CAP-016-R17, CAP-020-R13
	async checkExisting(
		tx: postgres.TransactionSql,
		draft: LocatedDraft,
		findingId: string,
		site: BodySite | undefined,
	): Promise<ChosenFinding> {
		const own = await this.findings.newFindingOf(tx, draft.id)
		if (own !== undefined && own.id === findingId) {
			return { finding: own, closedSite: undefined }
		}
		const finding = await this.trackedFinding(tx, findingId, draft.patient_id, draft.department_id)
		const location = await this.sites.lastClosedOf(tx, finding.id)
		if (location === undefined) {
			throw new Error(`the finding ${finding.id} has a closed record without a body site`)
		}
		const closedSite = bodySiteOfRow(location)
		if (site !== undefined && !isSameBodySite(site, closedSite)) {
			throw rejected()
		}
		return { finding, closedSite }
	}

	// CAP-020-R04, CAP-020-R13, CAP-020-R20, CAP-014-R26
	async trackedFinding(
		tx: postgres.TransactionSql,
		findingId: string,
		patientId: string,
		departmentId: string | null,
	): Promise<FindingRow> {
		const finding = await this.findings.findById(tx, findingId)
		if (finding === undefined || !isInDepartment(finding, departmentId)) {
			throw notFound()
		}
		if (finding.patient_id !== patientId) {
			throw patientMismatch()
		}
		if (!(await this.findings.hasClosedRecord(tx, finding.id))) {
			throw notFound()
		}
		return finding
	}

	// CAP-016-S01, CAP-016-S11, CAP-020-R13
	async placeNew(
		tx: postgres.TransactionSql,
		draft: LocatedDraft,
		findingKey: string,
		site: BodySite,
		createdBy: string,
	): Promise<string> {
		const location = validated(site)
		const finding = await this.newFindingFor(tx, draft, findingKey, createdBy)
		await this.sites.upsert(tx, draft.id, location)
		await this.records.recordDraft(tx, {
			findingId: finding.id,
			acquisitionId: draft.id,
			patientId: finding.patient_id,
			departmentId: finding.department_id,
			site: location,
		})
		return finding.id
	}

	// CAP-016-R14, CAP-016-S06, CAP-016-S09
	async moveNew(tx: postgres.TransactionSql, draft: LocatedDraft, site: BodySite): Promise<string> {
		const finding = await this.findings.newFindingOf(tx, draft.id)
		if (finding === undefined) {
			throw rejected()
		}
		const location = validated(site)
		await this.sites.upsert(tx, draft.id, location)
		await this.records.recordDraft(tx, {
			findingId: finding.id,
			acquisitionId: draft.id,
			patientId: finding.patient_id,
			departmentId: finding.department_id,
			site: location,
		})
		return finding.id
	}

	async clear(tx: postgres.TransactionSql, draft: LocatedDraft): Promise<null> {
		await this.withdrawNew(tx, draft)
		await this.sites.delete(tx, draft.id)
		return null
	}

	// CAP-014-R26, CAP-014-S46, CAP-014-S47
	async followAssignment(tx: postgres.TransactionSql, before: LocatedDraft, findingId: string | null): Promise<void> {
		if (findingId !== null && findingId === before.finding_id) {
			return
		}
		await this.withdrawNew(tx, before)
		if (findingId === null) {
			await this.sites.delete(tx, before.id)
			return
		}
		const location = await this.sites.lastClosedOf(tx, findingId)
		if (location === undefined) {
			throw new Error(`the finding ${findingId} has a closed record without a body site`)
		}
		await this.sites.upsert(tx, before.id, bodySiteOfRow(location))
	}

	// ADR-050 (doplnění D33) bod 3, CAP-020-R13
	async withdrawNew(tx: postgres.TransactionSql, draft: LocatedDraft): Promise<void> {
		const finding = await this.findings.newFindingOf(tx, draft.id)
		if (finding === undefined) {
			return
		}
		const location = await this.sites.findByAcquisition(tx, draft.id)
		if (location === undefined) {
			throw new Error(`the new finding ${finding.id} of the draft ${draft.id} has no body site`)
		}
		await this.records.withdrawDraft(tx, {
			findingId: finding.id,
			acquisitionId: draft.id,
			patientId: finding.patient_id,
			departmentId: finding.department_id,
			site: bodySiteOfRow(location),
			woundTypeCode: finding.wound_type_code,
		})
		await this.findings.detachFrom(tx, draft.id, finding.id)
		await this.findings.delete(tx, finding.id)
	}

	// CAP-021-R29, CAP-020-R13
	private async newFindingFor(
		tx: postgres.TransactionSql,
		draft: LocatedDraft,
		findingKey: string,
		createdBy: string,
	): Promise<FindingRow> {
		const byKey = await this.findings.findByKey(tx, findingKey)
		if (byKey !== undefined) {
			if (byKey.origin_acquisition_id !== draft.id || byKey.patient_id !== draft.patient_id) {
				throw new ProblemException(HttpStatus.CONFLICT, ERROR_CODE.IDEMPOTENCY_CONFLICT)
			}
			return byKey
		}
		const own = await this.findings.newFindingOf(tx, draft.id)
		if (own !== undefined) {
			return own
		}
		return await this.findings.insert(tx, {
			id: randomUUID(),
			patientId: draft.patient_id,
			departmentId: draft.department_id,
			findingKey,
			originAcquisitionId: draft.id,
			createdBy,
		})
	}
}
