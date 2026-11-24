import { issueChallenge, sha256Hex } from "@ansora/core-server"
import { Injectable, Logger } from "@nestjs/common"
import type { Request } from "express"
import { DatabaseService } from "../../../libs/database/database.service"
import { DeviceProofService } from "../../device/services/device-proof.service"
import { AppUserRepository } from "../repositories/app-user.repository"
import { LoginChallengeRepository } from "../repositories/login-challenge.repository"
import { SessionRepository } from "../repositories/session.repository"
import type { ChallengeResponse, ConsumedChallenge } from "../types/login.types"
import { LoginPolicyService } from "./login-policy.service"
import { UserIdentityService } from "./user-identity.service"

@Injectable()
export class LoginChallengeService {
	private readonly logger = new Logger(LoginChallengeService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly proofs: DeviceProofService,
		private readonly challenges: LoginChallengeRepository,
		private readonly sessions: SessionRepository,
		private readonly users: AppUserRepository,
		private readonly policies: LoginPolicyService,
		private readonly identities: UserIdentityService,
	) {}

	async issue(request: Request): Promise<ChallengeResponse> {
		const device = await this.proofs.ofApprovedDevice(request)
		const now = new Date()
		const confirmedUserId = await this.confirmSessionOwner(device.id, now)
		await this.challenges.deleteExpired(now)
		const challenge = issueChallenge(now)
		await this.challenges.insert(device.id, challenge, confirmedUserId)
		return { challenge_id: challenge.id, value: challenge.value, expires_at: challenge.expiresAt.toISOString() }
	}

	async consume(
		challengeId: string,
		deviceId: string,
		value: string,
		now: Date,
	): Promise<ConsumedChallenge | undefined> {
		const consumed = await this.challenges.consume(challengeId, deviceId, now)
		if (consumed === undefined || consumed.value_hash !== sha256Hex(value)) {
			return undefined
		}
		return { confirmedUserId: consumed.confirmed_user_id }
	}

	// CAP-001-R07, CAP-002-R03
	private async confirmSessionOwner(deviceId: string, now: Date): Promise<string | null> {
		const session = await this.sessions.activeOnDevice(this.database.sql, deviceId, now)
		if (session === undefined) {
			return null
		}
		const user = await this.users.findById(session.userId)
		if (user === undefined || !user.isActive) {
			return null
		}
		const confirmation = await this.identities.confirmWithProvider(user, await this.policies.current(), now)
		if (!confirmation.ok) {
			this.logger.log(
				`The provider did not confirm user ${user.id} ahead of a login on device ${deviceId}: ${confirmation.failure}`,
			)
			return null
		}
		return user.id
	}
}
