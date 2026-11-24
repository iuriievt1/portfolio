import { Body, Controller, Get, Param, Put, Query, UseGuards } from "@nestjs/common"
import { AcceptsOutdatedAppForDraft } from "../../infra/decorators/accepts-outdated-app-for-draft.decorator"
import { type PageInput, pageSchema } from "../../infra/dto/page.input.dto"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { CurrentSession } from "../../login/decorators/current-session.decorator"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import type { CurrentSession as CurrentSessionValue } from "../../login/types/login.types"
import {
	FINDING_ID_PARAMETER,
	FINDINGS_PATH,
	HISTORY_SUBPATH,
	WOUND_TYPE_SUBPATH,
} from "../constants/finding.constants"
import {
	type FindingWoundTypeChangeInput,
	findingIdSchema,
	findingWoundTypeChangeSchema,
	type PatientFindingsInput,
	patientFindingsSchema,
} from "../dto/finding.input.dto"
import { FindingHistoryService } from "../services/finding-history.service"
import { FindingWoundTypeChangeService } from "../services/finding-wound-type-change.service"
import { PatientFindingsService } from "../services/patient-findings.service"
import type { FindingsPageView, FindingView } from "../types/finding.types"
import type { TimelinePageView } from "../types/finding-history.types"

// CAP-016-R17, CAP-020-R01, CAP-020-R20, CAP-020-R21
@UseGuards(UserSessionGuard, ClinicianRoleGuard)
@Controller(FINDINGS_PATH)
export class FindingController {
	constructor(
		private readonly patientFindings: PatientFindingsService,
		private readonly history: FindingHistoryService,
		private readonly woundTypes: FindingWoundTypeChangeService,
	) {}

	@Get()
	@AcceptsOutdatedAppForDraft()
	async listPatientFindings(
		@CurrentSession() current: CurrentSessionValue,
		@Query(new ZodValidationPipe(patientFindingsSchema)) input: PatientFindingsInput,
	): Promise<FindingsPageView> {
		return await this.patientFindings.list(current, input)
	}

	@Get(HISTORY_SUBPATH)
	async getFindingHistory(
		@CurrentSession() current: CurrentSessionValue,
		@Param(FINDING_ID_PARAMETER, new ZodValidationPipe(findingIdSchema)) findingId: string,
		@Query(new ZodValidationPipe(pageSchema)) page: PageInput,
	): Promise<TimelinePageView> {
		return await this.history.timeline(current, findingId, page)
	}

	@Put(WOUND_TYPE_SUBPATH)
	async changeFindingWoundType(
		@CurrentSession() current: CurrentSessionValue,
		@Param(FINDING_ID_PARAMETER, new ZodValidationPipe(findingIdSchema)) findingId: string,
		@Body(new ZodValidationPipe(findingWoundTypeChangeSchema)) input: FindingWoundTypeChangeInput,
	): Promise<FindingView> {
		return await this.woundTypes.change(current, findingId, input, new Date())
	}
}
