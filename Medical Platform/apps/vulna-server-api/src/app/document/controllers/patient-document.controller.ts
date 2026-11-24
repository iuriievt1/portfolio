import { Controller, Get, Query, UseGuards } from "@nestjs/common"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { CurrentSession } from "../../login/decorators/current-session.decorator"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import type { CurrentSession as CurrentSessionValue } from "../../login/types/login.types"
import { DOCUMENTS_PATH } from "../constants/document.constants"
import { type PatientDocumentsInput, patientDocumentsSchema } from "../dto/patient-documents.input.dto"
import { PatientDocumentsService } from "../services/patient-documents.service"
import type { PatientDocumentsPageView } from "../types/document.types"

// CAP-020-R18, clinical-workflow.yaml listPatientDocuments
@UseGuards(UserSessionGuard, ClinicianRoleGuard)
@Controller(DOCUMENTS_PATH)
export class PatientDocumentController {
	constructor(private readonly documents: PatientDocumentsService) {}

	@Get()
	async listPatientDocuments(
		@CurrentSession() current: CurrentSessionValue,
		@Query(new ZodValidationPipe(patientDocumentsSchema)) input: PatientDocumentsInput,
	): Promise<PatientDocumentsPageView> {
		return await this.documents.list(current, input, new Date())
	}
}
