import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus, Injectable } from "@nestjs/common"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { PatientRepository } from "../repositories/patient.repository"
import type { FoundPatient } from "../types/registry.types"

// CAP-019-R20
@Injectable()
export class PatientLookupService {
	constructor(private readonly patients: PatientRepository) {}

	async patientOf(patientId: string): Promise<FoundPatient> {
		const [patient] = await this.patients.byIds([patientId])
		if (patient === undefined) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)
		}
		return patient
	}

	async findPatient(patientId: string): Promise<FoundPatient | undefined> {
		const [patient] = await this.patients.byIds([patientId])
		return patient
	}

	async patientsById(patientIds: readonly string[]): Promise<Map<string, FoundPatient>> {
		const found = await this.patients.byIds([...new Set(patientIds)])
		return new Map(found.map((patient) => [patient.patient.id, patient]))
	}
}
