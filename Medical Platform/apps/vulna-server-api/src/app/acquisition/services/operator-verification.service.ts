import { ERROR_CODE } from "@ansora/contracts"
import { wasSessionRunningAt } from "@ansora/vulna-domain"
import { HttpStatus, Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { SessionRepository } from "../../login/repositories/session.repository"
import type { CurrentSession } from "../../login/types/login.types"
import type { OperatorClaim } from "../types/acquisition.types"

function operatorUnverified(): ProblemException {
	return new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.OPERATOR_UNVERIFIED)
}

// CAP-021-R13, CAP-019-R29, CAP-021-S14, CAP-021-S19
@Injectable()
export class OperatorVerificationService {
	constructor(
		private readonly database: DatabaseService,
		private readonly sessions: SessionRepository,
	) {}

	async verify(current: CurrentSession, operator: OperatorClaim, at: Date): Promise<void> {
		if (operator.userId !== current.session.userId) {
			throw operatorUnverified()
		}
		if (operator.sessionId === current.session.id) {
			return
		}
		const session = await this.sessions.findById(this.database.sql, operator.sessionId)
		if (session === undefined) {
			throw new ProblemException(HttpStatus.UNAUTHORIZED, ERROR_CODE.SIGN_IN_AGAIN)
		}
		const isVerified =
			session.userId === current.session.userId &&
			session.deviceId === current.device.id &&
			wasSessionRunningAt(session, at)
		if (!isVerified) {
			throw operatorUnverified()
		}
	}
}
