import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res, UseGuards } from "@nestjs/common"
import type { Response } from "express"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { CurrentSession } from "../../login/decorators/current-session.decorator"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import type { CurrentSession as CurrentSessionValue } from "../../login/types/login.types"
import { IDENTIFICATION_SUBPATH, PATIENTS_PATH } from "../constants/registry.constants"
import { type PatientIdentificationInput, patientIdentificationSchema } from "../dto/patient-identification.input.dto"
import { type PatientSearchInput, patientSearchSchema } from "../dto/patient-search.input.dto"
import { PatientIdentificationService } from "../services/patient-identification.service"
import type { PatientSearchResult } from "../types/registry.types"
import { patientViewOf } from "../utils/patient-view"

// CAP-013-R07, CAP-013-R10, CAP-024-R05, CHG-175, CHG-176, CHG-182
@UseGuards(UserSessionGuard, ClinicianRoleGuard)
@Controller(PATIENTS_PATH)
export class PatientController {
	constructor(private readonly identification: PatientIdentificationService) {}

	// CHG-182
	@Get()
	async findPatients(
		@CurrentSession() current: CurrentSessionValue,
		@Query(new ZodValidationPipe(patientSearchSchema)) input: PatientSearchInput,
	): Promise<PatientSearchResult> {
		const found = await this.identification.find(current, input, new Date())
		return { items: found.map(patientViewOf) }
	}

	@Post(IDENTIFICATION_SUBPATH)
	@HttpCode(HttpStatus.CREATED)
	async identifyPatient(
		@CurrentSession() current: CurrentSessionValue,
		@Body(new ZodValidationPipe(patientIdentificationSchema)) input: PatientIdentificationInput,
		@Res({ passthrough: true }) response: Response,
	): Promise<PatientSearchResult> {
		const identified = await this.identification.identify(current, input, new Date())
		if (!identified.created) {
			response.status(HttpStatus.OK)
		}
		return { items: identified.found.map(patientViewOf) }
	}
}
