import { ERROR_CODE } from "@ansora/contracts"
import type { ActorDepartment, ClinicalEncounter, EncounterResourceIds } from "@ansora/vulna-domain"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { EncounterRow } from "../../encounter/types/encounter.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND } from "../constants/clinical-record.constants"
import { ClinicalActorRepository } from "../repositories/clinical-actor.repository"
import { ClinicalPatientRepository } from "../repositories/clinical-patient.repository"
import { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import { ClinicalRecordStoreService } from "./clinical-record-store.service"

// CAP-014-R17, ADR-054 bod 3, ADR-054 bod 5
@Injectable()
export class EncounterRecordService {
	constructor(
		private readonly stores: ClinicalRecordStoreService,
		private readonly patients: ClinicalPatientRepository,
		private readonly actors: ClinicalActorRepository,
		private readonly links: FhirResourceLinkRepository,
	) {}

	async record(tx: postgres.TransactionSql, encounter: EncounterRow): Promise<EncounterResourceIds> {
		const subject = `visit ${encounter.id}`
		const store = await this.stores.requireStore(subject)
		const patient = await this.patients.patientOf(tx, encounter.patient_id)
		if (patient === undefined) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
		const clinical = clinicalEncounterOf(encounter, await this.actors.departmentOf(tx, encounter.department_id))
		let ids: EncounterResourceIds
		try {
			ids = await store.recordEncounter({ patient, encounter: clinical })
		} catch (error) {
			throw this.stores.unavailableProblem(subject, error)
		}
		await this.links.upsert(tx, [
			{
				resourceType: FHIR_RESOURCE_TYPE.PATIENT,
				localKind: LOCAL_KIND.PATIENT,
				localId: patient.patientId,
				resourceId: ids.patient,
			},
			{
				resourceType: FHIR_RESOURCE_TYPE.ENCOUNTER,
				localKind: LOCAL_KIND.ENCOUNTER,
				localId: encounter.id,
				resourceId: ids.encounter,
			},
		])
		return ids
	}
}

function clinicalEncounterOf(row: EncounterRow, department: ActorDepartment | undefined): ClinicalEncounter {
	return {
		encounterId: row.id,
		status: row.status,
		date: row.date,
		startedAt: row.started_at?.toISOString(),
		statusChangedAt: row.status_changed_at.toISOString(),
		studyInstanceUid: row.study_instance_uid,
		department,
		completedByUserId: row.completed_by ?? undefined,
	}
}
