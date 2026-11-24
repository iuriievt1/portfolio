import type {
	AcquisitionOfRecord,
	ClinicalReader,
	EncounterResources,
	HistoryRecords,
	HistoryScanRecord,
	HistoryWounds,
	ImageHistoryPort,
} from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import type { CurrentSession } from "../../login/types/login.types"
import {
	FHIR_RESOURCE_TYPE,
	LOCAL_KIND,
	NO_CLOSED_RECORDS,
	NO_CLOSED_WOUNDS,
} from "../constants/clinical-record.constants"
import { DocumentationUnavailableException } from "../exceptions/documentation-unavailable.exception"
import { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import type { RecordVisibility } from "../types/clinical-record.types"
import { ClinicalRecordStoreService } from "./clinical-record-store.service"
import { ReadCircuitService } from "./read-circuit.service"

// ADR-053 bod 3, ADR-054 bod 2, CAP-020-R03, CAP-020-R16, datovy-model.md 13.2
@Injectable()
export class ClinicalReadService {
	private readonly logger = new Logger(ClinicalReadService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly links: FhirResourceLinkRepository,
		private readonly stores: ClinicalRecordStoreService,
		private readonly circuit: ReadCircuitService,
	) {}

	// CAP-016-R17, CAP-020-R20
	async closedWoundsOfPatient(current: CurrentSession, patientId: string): Promise<HistoryWounds> {
		const patient = await this.patientResourceOf(patientId)
		if (patient === undefined) {
			return NO_CLOSED_WOUNDS
		}
		return await this.read(current, `closed wounds of patient ${patientId}`, (history, reader) =>
			history.closedWoundsOfPatient(reader, patient),
		)
	}

	// CAP-020-R18
	async closedScansOfPatient(current: CurrentSession, patientId: string): Promise<readonly HistoryScanRecord[]> {
		const patient = await this.patientResourceOf(patientId)
		if (patient === undefined) {
			return []
		}
		return await this.read(current, `closed documents of patient ${patientId}`, (history, reader) =>
			history.closedScansOfPatient(reader, patient),
		)
	}

	// CAP-014-R19, CAP-014-R22, CAP-015-R30
	async recordVisibilityOf(current: CurrentSession, encounterIds: readonly string[]): Promise<RecordVisibility> {
		return {
			userId: current.session.userId,
			closedAcquisitionIds: await this.closedAcquisitionsOfEncounters(current, encounterIds),
		}
	}

	// CAP-020-R01, CAP-020-R20
	async closedRecordsOfFinding(current: CurrentSession, findingId: string): Promise<HistoryRecords> {
		const condition = await this.links.resourceIdOf(this.database.sql, {
			resourceType: FHIR_RESOURCE_TYPE.CONDITION,
			localKind: LOCAL_KIND.FINDING,
			localId: findingId,
		})
		if (condition === undefined) {
			return NO_CLOSED_RECORDS
		}
		return await this.read(current, `closed records of finding ${findingId}`, (history, reader) =>
			history.closedRecordsOfFinding(reader, condition),
		)
	}

	// CAP-020-R17, CAP-020-R22
	async closedRecord(current: CurrentSession, acquisition: AcquisitionOfRecord): Promise<HistoryRecords> {
		return await this.read(current, `closed record ${acquisition.acquisitionId}`, (history, reader) =>
			history.closedRecord(reader, acquisition),
		)
	}

	// CAP-020-R16, CAP-020-R22, CAP-020-S29
	async isClosedRecordVisible(current: CurrentSession, acquisition: AcquisitionOfRecord): Promise<boolean> {
		const records = await this.closedRecord(current, acquisition)
		return records.wounds.length > 0 || records.scans.length > 0
	}

	private async read<T>(
		current: CurrentSession,
		subject: string,
		read: (history: ImageHistoryPort, reader: ClinicalReader) => Promise<T>,
	): Promise<T> {
		const history = await this.stores.history()
		if (history === undefined) {
			this.logger.error(`The ${subject} cannot be read: the clinical record store is not configured`)
			throw new DocumentationUnavailableException()
		}
		const reader = await this.readerOf(current.session.userId, subject)
		// backend.md 3.1, ADR-050 bod 11
		if (!this.circuit.allows(Date.now())) {
			throw new DocumentationUnavailableException()
		}
		try {
			const answer = await read(history, reader)
			this.circuit.recordAnswer()
			return answer
		} catch (error) {
			this.circuit.recordFailure(error, Date.now())
			this.stores.reportFailure(subject, error)
			throw new DocumentationUnavailableException()
		}
	}

	// ADR-053 bod 6, ADR-053 (doplnění 2026-09-24) bod 3, datovy-model.md 13.2
	private async readerOf(userId: string, subject: string): Promise<ClinicalReader> {
		const membership = await this.links.resourceIdOf(this.database.sql, {
			resourceType: FHIR_RESOURCE_TYPE.PROJECT_MEMBERSHIP,
			localKind: LOCAL_KIND.ACTOR,
			localId: userId,
		})
		if (membership === undefined) {
			this.logger.warn(`The ${subject} cannot be read: user ${userId} has no membership in the store yet`)
			throw new DocumentationUnavailableException()
		}
		return { membershipResourceId: membership }
	}

	// CAP-014-R19, CAP-014-R22, CAP-014-R27
	private async closedAcquisitionsOfEncounters(
		current: CurrentSession,
		encounterIds: readonly string[],
	): Promise<readonly string[]> {
		const encounters = await this.encounterResourcesOf(encounterIds)
		if (encounters.length === 0) {
			return []
		}
		return await this.read(current, `closed records of ${encounters.length} visits`, (history, reader) =>
			history.closedAcquisitionsOfEncounters(reader, encounters),
		)
	}

	private async patientResourceOf(patientId: string): Promise<string | undefined> {
		return await this.links.resourceIdOf(this.database.sql, {
			resourceType: FHIR_RESOURCE_TYPE.PATIENT,
			localKind: LOCAL_KIND.PATIENT,
			localId: patientId,
		})
	}

	private async encounterResourcesOf(encounterIds: readonly string[]): Promise<EncounterResources[]> {
		const sql = this.database.sql
		const encounters = await this.links.resourceIdsOf(
			sql,
			{ resourceType: FHIR_RESOURCE_TYPE.ENCOUNTER, localKind: LOCAL_KIND.ENCOUNTER },
			encounterIds,
		)
		const studies = await this.links.resourceIdsOf(
			sql,
			{ resourceType: FHIR_RESOURCE_TYPE.IMAGING_STUDY, localKind: LOCAL_KIND.IMAGING_STUDY },
			encounterIds,
		)
		return encounterIds.flatMap((encounterId) => {
			const encounter = encounters.get(encounterId)
			return encounter === undefined
				? []
				: [{ encounterResourceId: encounter, imagingStudyResourceId: studies.get(encounterId) }]
		})
	}
}
