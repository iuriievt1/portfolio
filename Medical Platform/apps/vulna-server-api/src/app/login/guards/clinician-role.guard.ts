import { ERROR_CODE } from "@ansora/contracts"
import { ROLE } from "@ansora/core-server"
import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { UserIdentityService } from "../services/user-identity.service"
import type { UserSessionRequest } from "../types/login.types"

// CAP-003-R09
@Injectable()
export class ClinicianRoleGuard implements CanActivate {
	constructor(
		private readonly database: DatabaseService,
		private readonly identities: UserIdentityService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const current = context.switchToHttp().getRequest<UserSessionRequest>().userSession
		if (current === undefined) {
			throw new Error("the clinician role is checked only after the user session guard")
		}
		const roles = await this.identities.rolesOf(this.database.sql, current.session.userId)
		if (!roles.includes(ROLE.CLINICIAN)) {
			throw new ProblemException(HttpStatus.FORBIDDEN, ERROR_CODE.RECORD_REJECTED)
		}
		return true
	}
}
