import { ACQUISITION_KIND, ERROR_CODE, RELEASE_KIND } from "@ansora/contracts"
import { HttpStatus, Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { ClinicalReadService } from "../../clinical-record/services/clinical-read.service"
import { readOrRecordNone } from "../../clinical-record/utils/read-or-record-none"
import { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import { EncounterViewService } from "../../encounter/services/encounter-view.service"
import type { EncounterView } from "../../encounter/types/encounter.types"
import { RELEASED_NONE, RELEASED_ONE } from "../../image/constants/image.constants"
import { RecordFileRepository } from "../../image/repositories/record-file.repository"
import { RecordReleaseService } from "../../image/services/record-release.service"
import type { RecordFileRow } from "../../image/types/image.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { CurrentSession } from "../../login/types/login.types"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { FoundPatient } from "../../registry/types/registry.types"
import { patientViewOf } from "../../registry/utils/patient-view"
import { DetailRecordRepository } from "../repositories/detail-record.repository"
import type { AcquisitionDetailView, ClosedDetailRecord, DetailRecordRow } from "../types/acquisition-detail.types"
import { acquisitionDetailOf } from "../utils/acquisition-detail-view"
import { closedRecordOf, visibleRecordOf } from "../utils/closed-record"

// CAP-020-R17, CAP-020-R19, CAP-020-R05, CAP-025-R28, CAP-020-S11, CAP-020-S14, ADR-054 bod 2
@Injectable()
export class AcquisitionDetailService {
	constructor(
		private readonly database: DatabaseService,
		private readonly records: DetailRecordRepository,
		private readonly files: RecordFileRepository,
		private readonly encounters: EncounterRepository,
		private readonly encounterViews: EncounterViewService,
		private readonly reads: ClinicalReadService,
		private readonly patients: PatientLookupService,
		private readonly releases: RecordReleaseService,
	) {}

	async detail(current: CurrentSession, acquisitionId: string, now: Date): Promise<AcquisitionDetailView> {
		const record = await this.records.findById(acquisitionId)
		const patient = record === undefined ? undefined : await this.patients.findPatient(record.patient_id)
		const view = await readOrRecordNone(
			() => this.visibleViewOf(current, record, patient, now),
			() => this.recordRelease(current, acquisitionId, record, patient, RELEASED_NONE),
		)
		if (view === undefined) {
			await this.recordRelease(current, acquisitionId, record, patient, RELEASED_NONE)
			throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
		await this.recordRelease(current, acquisitionId, record, patient, RELEASED_ONE)
		return view
	}

	private async visibleViewOf(
		current: CurrentSession,
		record: DetailRecordRow | undefined,
		patient: FoundPatient | undefined,
		now: Date,
	): Promise<AcquisitionDetailView | undefined> {
		const closed = closedRecordOf(record)
		if (closed === undefined || patient === undefined) {
			return undefined
		}
		const history = await this.reads.closedRecord(current, { acquisitionId: closed.id, kind: closed.kind })
		const visible = visibleRecordOf(closed, history)
		if (visible === undefined) {
			return undefined
		}
		return acquisitionDetailOf(visible, {
			patient: patientViewOf(patient),
			encounter: await this.encounterOf(current, visible, now),
			files: await this.filesOf(visible),
		})
	}

	private async encounterOf(current: CurrentSession, record: ClosedDetailRecord, now: Date): Promise<EncounterView> {
		const encounter = await this.encounters.findById(this.database.sql, record.encounter_id)
		if (encounter === undefined) {
			throw new Error(`the record ${record.id} points to the missing visit ${record.encounter_id}`)
		}
		return await this.encounterViews.viewOf(current, encounter, now)
	}

	// CAP-020-R17, CAP-018-R11
	private async filesOf(record: ClosedDetailRecord): Promise<RecordFileRow[]> {
		switch (record.kind) {
			case ACQUISITION_KIND.PHOTO:
				return await this.files.imagesOf(this.database.sql, [record.id])
			case ACQUISITION_KIND.SCAN:
				return await this.files.pagesOf(this.database.sql, [record.id])
			default:
				return record.kind satisfies never
		}
	}

	// CAP-025-R28
	private async recordRelease(
		current: CurrentSession,
		acquisitionId: string,
		record: DetailRecordRow | undefined,
		patient: FoundPatient | undefined,
		releasedItemCount: number,
	): Promise<void> {
		await this.releases.record(current, {
			kind: RELEASE_KIND.ACQUISITION_DETAIL,
			objectId: acquisitionId,
			patient,
			encounterId: record?.encounter_id,
			acquisitionId,
			releasedItemCount,
		})
	}
}
