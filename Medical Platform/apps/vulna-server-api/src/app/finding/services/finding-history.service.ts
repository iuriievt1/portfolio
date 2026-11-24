import { ERROR_CODE } from "@ansora/contracts"
import type { HistoryRecords } from "@ansora/vulna-domain"
import { HttpStatus, Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { DocumentationUnavailableException } from "../../clinical-record/exceptions/documentation-unavailable.exception"
import { ClinicalReadService } from "../../clinical-record/services/clinical-read.service"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { RELEASED_NONE } from "../../image/constants/image.constants"
import { RecordFileRepository } from "../../image/repositories/record-file.repository"
import { RecordReleaseService } from "../../image/services/record-release.service"
import { filesByRecord } from "../../image/utils/record-files"
import type { PageInput } from "../../infra/dto/page.input.dto"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { pageLimit } from "../../infra/utils/page-limit"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import { UNAVAILABLE_TIMELINE } from "../constants/finding.constants"
import { FindingRepository } from "../repositories/finding.repository"
import { FindingHistoryRepository } from "../repositories/finding-history.repository"
import { WoundTypeChangeRepository } from "../repositories/wound-type-change.repository"
import type { FindingRow } from "../types/finding.types"
import type { TimelinePageView } from "../types/finding-history.types"
import { historyWoundTypeOf } from "../utils/closed-wound-type"
import { withHistoryWound } from "../utils/record-content"
import { timelineItemOf, woundTypeChangeViewOf, woundTypeVersionText } from "../utils/timeline-view"

// CAP-020-R01, CAP-020-R04, CAP-020-R05, CAP-020-R16, CAP-020-R19, CAP-020-R20, ADR-054 bod 2
@Injectable()
export class FindingHistoryService {
	constructor(
		private readonly database: DatabaseService,
		private readonly findings: FindingRepository,
		private readonly reads: ClinicalReadService,
		private readonly history: FindingHistoryRepository,
		private readonly changes: WoundTypeChangeRepository,
		private readonly files: RecordFileRepository,
		private readonly patients: PatientLookupService,
		private readonly releases: RecordReleaseService,
		private readonly configuration: ConfigurationService,
	) {}

	async timeline(current: CurrentSession, findingId: string, page: PageInput): Promise<TimelinePageView> {
		const sql = this.database.sql
		const finding = await this.findings.findById(sql, findingId)
		if (finding === undefined) {
			await this.recordRelease(current, findingId, finding, RELEASED_NONE)
			throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
		const records = await this.recordsOf(current, finding.id)
		if (records === undefined) {
			await this.recordRelease(current, findingId, finding, RELEASED_NONE)
			return UNAVAILABLE_TIMELINE
		}
		const visible = records.findings.find((candidate) => candidate.findingId === finding.id)
		if (visible === undefined) {
			await this.recordRelease(current, findingId, finding, RELEASED_NONE)
			throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
		const wounds = new Map(records.wounds.map((wound) => [wound.acquisitionId, wound]))
		const limit = pageLimit(page.limit, await this.configuration.pageSize())
		const closed = await this.history.closedRecords(finding.id, [...wounds.keys()], page.cursor, limit)
		const files = filesByRecord(
			await this.files.imagesOf(
				sql,
				closed.rows.map((row) => row.id),
			),
		)
		const items = closed.rows.map((row) => {
			const wound = wounds.get(row.id)
			if (wound === undefined) {
				throw new Error(`the record ${row.id} is not among the visible records of finding ${finding.id}`)
			}
			return timelineItemOf(withHistoryWound(row, wound), files.get(row.id) ?? [])
		})
		const woundType = historyWoundTypeOf(finding, visible.woundTypeCode)
		await this.recordRelease(current, findingId, finding, items.length)
		return {
			items,
			next_cursor: closed.nextCursor,
			wound_type_code: woundType.code,
			wound_type_code_list_version: woundTypeVersionText(woundType),
			wound_type_changes: (await this.changes.listOf(sql, finding.id)).map(woundTypeChangeViewOf),
			source_unavailable: false,
		}
	}

	// CAP-020-R16, CAP-020-S10
	private async recordsOf(current: CurrentSession, findingId: string): Promise<HistoryRecords | undefined> {
		try {
			return await this.reads.closedRecordsOfFinding(current, findingId)
		} catch (error) {
			if (error instanceof DocumentationUnavailableException) {
				return undefined
			}
			throw error
		}
	}

	// CAP-020-R05, CAP-025-R28
	private async recordRelease(
		current: CurrentSession,
		findingId: string,
		finding: FindingRow | undefined,
		releasedItemCount: number,
	): Promise<void> {
		const patient = finding === undefined ? undefined : await this.patients.findPatient(finding.patient_id)
		await this.releases.record(current, {
			kind: undefined,
			objectId: findingId,
			patient,
			encounterId: undefined,
			acquisitionId: undefined,
			releasedItemCount,
		})
	}
}
