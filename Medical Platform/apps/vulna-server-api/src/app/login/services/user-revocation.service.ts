import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME, SESSION_END_REASON } from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { ADMINISTRATION_SESSION_END_REASON } from "../../administration-session/constants/administration-session.constants"
import { AdministrationSessionService } from "../../administration-session/services/administration-session.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { AppUserRepository } from "../repositories/app-user.repository"
import { CarrierRevocationService } from "./carrier-revocation.service"
import { SessionService } from "./session.service"

@Injectable()
export class UserRevocationService {
	constructor(
		private readonly database: DatabaseService,
		private readonly users: AppUserRepository,
		private readonly carriers: CarrierRevocationService,
		private readonly sessions: SessionService,
		private readonly administrationSessions: AdministrationSessionService,
		private readonly audit: AuditRepository,
	) {}

	// CAP-005-R07, CAP-005-R12, CAP-002-R08, CAP-002-R10
	async revoke(userId: string, administrator: AdministrationSession): Promise<void> {
		if ((await this.users.findById(userId)) === undefined) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		}
		const now = new Date()
		await this.database.sql.begin(async (tx) => {
			if (!(await this.users.deactivate(tx, userId))) {
				return
			}
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.USER_REVOCATION,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: administrator.userId,
				objectId: userId,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: {},
			})
			await this.carriers.revokeAllOf(tx, userId, administrator, now)
			await this.sessions.endAllOf(tx, userId, SESSION_END_REASON.USER_REVOKED, now)
			await this.administrationSessions.endAllOf(tx, userId, ADMINISTRATION_SESSION_END_REASON.ACCESS_REVOKED, now)
		})
	}
}
