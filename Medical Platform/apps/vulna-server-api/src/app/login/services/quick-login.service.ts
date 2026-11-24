import { ERROR_CODE, type ErrorCode } from "@ansora/contracts"
import {
	attemptsExhausted,
	FULL_LOGIN_REASON,
	fullLoginRequirement,
	IDENTITY_PROVIDER_FAILURE,
	LOGIN_METHOD,
	type LoginMethod,
	loginNameOfBarcode,
	nextAttemptDelaySeconds,
	parsePinProof,
	parseQrCodeContent,
	remainingDelaySeconds,
	SESSION_END_REASON,
	type UserDeviceCredential,
	verifyPinProof,
	verifySignedBody,
} from "@ansora/core-server"
import { Injectable, Logger } from "@nestjs/common"
import type { Request } from "express"
import { DatabaseService } from "../../../libs/database/database.service"
import { QrCodeKeyService } from "../../../libs/qr-code/qr-code-key.service"
import { DeviceProofService } from "../../device/services/device-proof.service"
import type { Device } from "../../device/types/device.types"
import { EffectiveConfigurationService } from "../../effective-configuration/services/effective-configuration.service"
import type { ProblemException } from "../../infra/exceptions/problem.exception"
import {
	LOGIN_FAILURE_DETAIL,
	OUTSIDE_AUTHORIZED_GROUP,
	SIGNED_BODY_DETAIL_PREFIX,
} from "../constants/login-failure.constants"
import { AppUserRepository } from "../repositories/app-user.repository"
import { CardRepository } from "../repositories/card.repository"
import { SessionRepository } from "../repositories/session.repository"
import { UserDeviceCredentialRepository } from "../repositories/user-device-credential.repository"
import type { AppUser, ConsumedChallenge, PinLoginInput, SessionResponse } from "../types/login.types"
import type { LoginPolicy } from "../types/login-policy.types"
import { loginRejection } from "../utils/login-rejection"
import { CardIdentityService } from "./card-identity.service"
import { LoginAttemptService } from "./login-attempt.service"
import { LoginChallengeService } from "./login-challenge.service"
import { LoginPolicyService } from "./login-policy.service"
import { SessionService } from "./session.service"
import { UserIdentityService } from "./user-identity.service"

type CarrierMethod = typeof LOGIN_METHOD.CARD | typeof LOGIN_METHOD.QR | typeof LOGIN_METHOD.BARCODE

interface LoginContext {
	device: Device
	method: LoginMethod
	policy: LoginPolicy
	now: Date
}

interface FailureCount {
	user: AppUser
	limit: number
	delayBaseSeconds: number
	detail: string
}

@Injectable()
export class QuickLoginService {
	private readonly logger = new Logger(QuickLoginService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly proofs: DeviceProofService,
		private readonly policies: LoginPolicyService,
		private readonly effectiveConfiguration: EffectiveConfigurationService,
		private readonly challenges: LoginChallengeService,
		private readonly cardIdentity: CardIdentityService,
		private readonly qrKeys: QrCodeKeyService,
		private readonly cards: CardRepository,
		private readonly users: AppUserRepository,
		private readonly credentials: UserDeviceCredentialRepository,
		private readonly sessions: SessionService,
		private readonly sessionRows: SessionRepository,
		private readonly identities: UserIdentityService,
		private readonly attempts: LoginAttemptService,
	) {}

	async loginWithCard(request: Request, body: string): Promise<SessionResponse> {
		return await this.loginWithCarrier(request, body, LOGIN_METHOD.CARD)
	}

	async loginWithQrCode(request: Request, body: string): Promise<SessionResponse> {
		return await this.loginWithCarrier(request, body, LOGIN_METHOD.QR)
	}

	async loginWithBarcode(request: Request, body: string): Promise<SessionResponse> {
		return await this.loginWithCarrier(request, body, LOGIN_METHOD.BARCODE)
	}

	async loginWithPin(request: Request, input: PinLoginInput): Promise<SessionResponse> {
		const context = await this.contextOf(request, LOGIN_METHOD.PIN)
		const { device, policy, now } = context
		const proof = parsePinProof(input.proof)
		if (proof === undefined) {
			throw loginRejection(ERROR_CODE.RECORD_REJECTED)
		}
		const challenge = await this.consumeChallenge(context, proof.claims.challengeId, proof.claims.value)
		const user = await this.users.findByPersonalNumber(input.personal_number)
		if (user === undefined) {
			throw await this.fail(context, null, ERROR_CODE.LOGIN_FAILED, LOGIN_FAILURE_DETAIL.UNKNOWN_PERSONAL_NUMBER)
		}
		const credential = await this.requireFullLoginState(context, user)
		const state = await this.attempts.failureState(user.id, device.id, LOGIN_METHOD.PIN)
		const delay = nextAttemptDelaySeconds(state.consecutiveFailures, policy.pinDelaySeconds)
		const remaining = remainingDelaySeconds(state.lastFailedAt, delay, now)
		if (remaining > 0) {
			throw await this.fail(
				context,
				user.id,
				ERROR_CODE.LOGIN_FAILED,
				LOGIN_FAILURE_DETAIL.DELAY_NOT_ELAPSED,
				remaining,
			)
		}
		const verdict =
			credential.pinPublicKey === null
				? undefined
				: verifyPinProof(proof, credential.pinPublicKey, {
						deviceKey: device.publicKeyJwk,
						personalNumber: input.personal_number,
						now,
					})
		if (verdict === undefined || !verdict.ok) {
			throw await this.countFailure(context, {
				user,
				limit: policy.pinAttemptsLimit,
				delayBaseSeconds: policy.pinDelaySeconds,
				detail: verdict === undefined ? LOGIN_FAILURE_DETAIL.PIN_NOT_SET : verdict.reason,
			})
		}
		return await this.finish(context, user, challenge)
	}

	private async loginWithCarrier(request: Request, body: string, method: CarrierMethod): Promise<SessionResponse> {
		const context = await this.contextOf(request, method)
		const { device } = context
		const verdict = verifySignedBody(body, device.publicKeyJwk, context.now)
		if (!verdict.ok) {
			throw await this.fail(context, null, ERROR_CODE.LOGIN_FAILED, `${SIGNED_BODY_DETAIL_PREFIX}${verdict.reason}`)
		}
		const challenge = await this.consumeChallenge(context, verdict.claims.challengeId, verdict.claims.value)
		const userId = await this.userOfCarrier(method, verdict.claims.identifier)
		if (userId === undefined) {
			throw await this.failUnassigned(context)
		}
		const user = await this.users.findById(userId)
		if (user === undefined) {
			throw new Error(`carrier resolved to unknown user ${userId}`)
		}
		await this.requireFullLoginState(context, user)
		return await this.finish(context, user, challenge)
	}

	private async contextOf(request: Request, method: LoginMethod): Promise<LoginContext> {
		const device = await this.proofs.ofApprovedDevice(request)
		const policy = await this.policies.current()
		const configuration = await this.effectiveConfiguration.forDevice(device)
		if (!(configuration.allowed_login_methods ?? []).includes(method)) {
			throw loginRejection(ERROR_CODE.METHOD_DISABLED)
		}
		return { device, method, policy, now: new Date() }
	}

	private async consumeChallenge(
		context: LoginContext,
		challengeId: string,
		value: string,
	): Promise<ConsumedChallenge> {
		const consumed = await this.challenges.consume(challengeId, context.device.id, value, context.now)
		if (consumed === undefined) {
			throw await this.fail(context, null, ERROR_CODE.CHALLENGE_INVALID, LOGIN_FAILURE_DETAIL.CHALLENGE)
		}
		return consumed
	}

	private async userOfCarrier(method: CarrierMethod, identifier: string): Promise<string | undefined> {
		switch (method) {
			case LOGIN_METHOD.CARD:
				return (await this.cardIdentity.resolve(identifier))?.userId
			case LOGIN_METHOD.QR:
				return await this.userOfQrCode(identifier)
			case LOGIN_METHOD.BARCODE:
				return await this.userOfBarcode(identifier)
			default:
				return method satisfies never
		}
	}

	private async userOfQrCode(content: string): Promise<string | undefined> {
		const code = parseQrCodeContent(content)
		if (code === undefined || !this.qrKeys.verify(code)) {
			return undefined
		}
		return (await this.cards.findValidQrCode(code.identifier, code.keyVersion))?.user_id
	}

	// identity.yaml loginWithBarcode
	private async userOfBarcode(content: string): Promise<string | undefined> {
		const loginName = loginNameOfBarcode(content)
		return loginName === undefined ? undefined : (await this.users.findByLoginName(loginName))?.id
	}

	private async requireFullLoginState(context: LoginContext, user: AppUser): Promise<UserDeviceCredential> {
		const credential = await this.credentials.find(user.id, context.device.id)
		const reason = fullLoginRequirement(credential, context.now, context.policy.fullLoginIntervalSeconds)
		if (reason !== undefined || credential === undefined) {
			throw await this.fail(
				context,
				user.id,
				ERROR_CODE.FULL_LOGIN_REQUIRED,
				reason ?? FULL_LOGIN_REASON.NEVER_SIGNED_IN,
			)
		}
		return credential
	}

	private async finish(context: LoginContext, user: AppUser, challenge: ConsumedChallenge): Promise<SessionResponse> {
		const { device, policy, now, method } = context
		if (!user.isActive) {
			throw await this.fail(context, user.id, ERROR_CODE.ACCOUNT_INACTIVE, LOGIN_FAILURE_DETAIL.INACTIVE)
		}
		if (challenge.confirmedUserId !== user.id) {
			await this.requireProviderConfirmation(context, user)
		}
		return await this.database.sql.begin(async (tx) => {
			const issued = await this.sessions.issueOrResume(tx, user.id, device.id, policy, now)
			await this.attempts.record(
				tx,
				{
					deviceId: device.id,
					userId: user.id,
					method,
					sessionId: issued.session.id,
					reason: undefined,
					details: { session_outcome: issued.outcome },
				},
				now,
			)
			return await this.sessions.respond(tx, issued, user, device, policy)
		})
	}

	// CAP-001-R07, CAP-002-R03
	private async requireProviderConfirmation(context: LoginContext, user: AppUser): Promise<void> {
		const confirmation = await this.identities.confirmWithProvider(user, context.policy, context.now)
		if (confirmation.ok) {
			return
		}
		const unavailable = confirmation.failure === IDENTITY_PROVIDER_FAILURE.UNAVAILABLE
		const code = unavailable ? ERROR_CODE.PROVIDER_UNAVAILABLE : ERROR_CODE.ACCOUNT_INACTIVE
		const detail =
			confirmation.failure === OUTSIDE_AUTHORIZED_GROUP
				? LOGIN_FAILURE_DETAIL.OUTSIDE_AUTHORIZED_GROUP
				: LOGIN_FAILURE_DETAIL.PROVIDER
		throw await this.fail(context, user.id, code, detail)
	}

	private async failUnassigned(context: LoginContext): Promise<ProblemException> {
		const active = await this.sessionRows.activeOnDevice(this.database.sql, context.device.id, context.now)
		const owner = active === undefined ? undefined : await this.users.findById(active.userId)
		if (owner === undefined) {
			return await this.fail(context, null, ERROR_CODE.LOGIN_FAILED, LOGIN_FAILURE_DETAIL.UNKNOWN_CARRIER)
		}
		return await this.countFailure(context, {
			user: owner,
			limit: context.policy.credentialAttemptsLimit,
			delayBaseSeconds: 0,
			detail: LOGIN_FAILURE_DETAIL.UNKNOWN_CARRIER,
		})
	}

	private async countFailure(context: LoginContext, count: FailureCount): Promise<ProblemException> {
		const { device, method, now } = context
		const state = await this.attempts.failureState(count.user.id, device.id, method)
		const failures = state.consecutiveFailures + 1
		const exhausted = attemptsExhausted(failures, count.limit)
		const code: ErrorCode = exhausted ? ERROR_CODE.ATTEMPTS_EXHAUSTED : ERROR_CODE.LOGIN_FAILED
		await this.database.sql.begin(async (tx) => {
			if (exhausted) {
				await this.credentials.block(tx, count.user.id, device.id, now)
				const active = await this.sessionRows.activeOnDevice(tx, device.id, now)
				if (active !== undefined && active.userId === count.user.id) {
					await this.sessions.end(tx, active, SESSION_END_REASON.ATTEMPTS_EXHAUSTED, now)
				}
			}
			await this.attempts.record(
				tx,
				{
					deviceId: device.id,
					userId: count.user.id,
					method,
					sessionId: null,
					reason: code,
					details: { detail: count.detail, consecutive_failures: failures },
				},
				now,
			)
		})
		this.logger.log(
			`Login by ${method} failed for user ${count.user.id} on device ${device.id} (${failures}/${count.limit})`,
		)
		const delay = nextAttemptDelaySeconds(failures, count.delayBaseSeconds)
		return loginRejection(code, exhausted || delay === 0 ? undefined : delay)
	}

	private async fail(
		context: LoginContext,
		userId: string | null,
		code: ErrorCode,
		detail: string,
		retryAfterSeconds?: number,
	): Promise<ProblemException> {
		await this.attempts.recordFailure(
			{ deviceId: context.device.id, userId, method: context.method, reason: code, details: { detail } },
			context.now,
		)
		return loginRejection(code, retryAfterSeconds)
	}
}
