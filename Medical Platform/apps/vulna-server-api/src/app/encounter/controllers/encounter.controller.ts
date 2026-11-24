import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from "@nestjs/common"
import { type PageInput, pageSchema } from "../../infra/dto/page.input.dto"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { CurrentSession } from "../../login/decorators/current-session.decorator"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import type { CurrentSession as CurrentSessionValue } from "../../login/types/login.types"
import {
	ACQUISITIONS_SUBPATH,
	CANCELLATION_SUBPATH,
	COMPLETION_SUBPATH,
	ENCOUNTER_ID_PARAMETER,
	ENCOUNTERS_PATH,
	SCHEDULED_PATH,
	UNFINISHED_PATH,
} from "../constants/encounter.constants"
import {
	encounterIdSchema,
	type PatientEncountersQuery,
	patientEncountersQuerySchema,
	type ScheduledEncountersQuery,
	scheduledEncountersQuerySchema,
} from "../dto/encounter.input.dto"
import { EncounterService } from "../services/encounter.service"
import { EncounterCancellationService } from "../services/encounter-cancellation.service"
import { UnfinishedEncounterService } from "../services/unfinished-encounter.service"
import type {
	EncounterAcquisitionsPageView,
	EncountersPageView,
	EncounterView,
	ScheduledEncounterListView,
	UnfinishedEncounterListView,
} from "../types/encounter.types"

// CAP-014-R16, CAP-014-R18, CAP-014-R19, CAP-014-R20, CAP-014-R22, CAP-014-R24, Q-150
@UseGuards(UserSessionGuard, ClinicianRoleGuard)
@Controller(ENCOUNTERS_PATH)
export class EncounterController {
	constructor(
		private readonly encounters: EncounterService,
		private readonly cancellations: EncounterCancellationService,
		private readonly unfinished: UnfinishedEncounterService,
	) {}

	@Get()
	async listPatientEncounters(
		@CurrentSession() current: CurrentSessionValue,
		@Query(new ZodValidationPipe(patientEncountersQuerySchema)) query: PatientEncountersQuery,
	): Promise<EncountersPageView> {
		return await this.encounters.listForPatient(current, query, new Date())
	}

	@Get(SCHEDULED_PATH)
	async listScheduledEncounters(
		@CurrentSession() current: CurrentSessionValue,
		@Query(new ZodValidationPipe(scheduledEncountersQuerySchema)) query: ScheduledEncountersQuery,
	): Promise<ScheduledEncounterListView> {
		return await this.encounters.listScheduled(current, query, new Date())
	}

	// clinical-workflow.yaml listUnfinishedEncounters
	@Get(UNFINISHED_PATH)
	async listUnfinishedEncounters(@CurrentSession() current: CurrentSessionValue): Promise<UnfinishedEncounterListView> {
		return await this.unfinished.list(current, new Date())
	}

	@Get(ACQUISITIONS_SUBPATH)
	async listEncounterAcquisitions(
		@CurrentSession() current: CurrentSessionValue,
		@Param(ENCOUNTER_ID_PARAMETER, new ZodValidationPipe(encounterIdSchema)) encounterId: string,
		@Query(new ZodValidationPipe(pageSchema)) page: PageInput,
	): Promise<EncounterAcquisitionsPageView> {
		return await this.encounters.listContent(current, encounterId, page, new Date())
	}

	@Post(COMPLETION_SUBPATH)
	@HttpCode(HttpStatus.OK)
	async completeEncounter(
		@CurrentSession() current: CurrentSessionValue,
		@Param(ENCOUNTER_ID_PARAMETER, new ZodValidationPipe(encounterIdSchema)) encounterId: string,
	): Promise<EncounterView> {
		return await this.encounters.complete(current, encounterId, new Date())
	}

	@Post(CANCELLATION_SUBPATH)
	@HttpCode(HttpStatus.NO_CONTENT)
	async cancelEncounter(
		@CurrentSession() current: CurrentSessionValue,
		@Param(ENCOUNTER_ID_PARAMETER, new ZodValidationPipe(encounterIdSchema)) encounterId: string,
	): Promise<void> {
		await this.cancellations.cancel(current, encounterId, new Date())
	}
}
