import { Controller, Get, UseGuards } from "@nestjs/common"
import { CurrentSession } from "../../login/decorators/current-session.decorator"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import type { CurrentSession as CurrentSessionValue } from "../../login/types/login.types"
import { PATIENTS_PATH } from "../../registry/constants/registry.constants"
import { RECENT_SUBPATH } from "../constants/recent-patients.constants"
import { RecentPatientsService } from "../services/recent-patients.service"
import type { RecentPatientListView } from "../types/recent-patients.types"

// clinical-workflow.yaml listRecentPatients, CAP-013-R19
@UseGuards(UserSessionGuard, ClinicianRoleGuard)
@Controller(PATIENTS_PATH)
export class RecentPatientsController {
	constructor(private readonly recents: RecentPatientsService) {}

	@Get(RECENT_SUBPATH)
	async listRecentPatients(@CurrentSession() current: CurrentSessionValue): Promise<RecentPatientListView> {
		return await this.recents.list(current)
	}
}
