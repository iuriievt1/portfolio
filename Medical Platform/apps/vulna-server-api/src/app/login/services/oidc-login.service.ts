import { ERROR_CODE, type ErrorCode } from "@ansora/contracts"
import {
	appReturnUrl,
	COMPLETION_CODE_LIFETIME_SECONDS,
	IDENTITY_PROVIDER_FAILURE,
	type IdentityProviderPort,
	isAuthenticationFresh,
	LOGIN_METHOD,
	newPkcePair,
	OIDC_FLOW_LIFETIME_SECONDS,
	type PinPublicKeyJwk,
	parsePinPublicKey,
	randomSecret,
	requiresPinSetup,
	secondsAfter,
	sha256Hex,
} from "@ansora/core-server"
import { Inject, Injectable, Logger } from "@nestjs/common"
import type { Request } from "express"
import { messageOf } from "../../../libs/common/utils/error-message"
import { DatabaseService } from "../../../libs/database/database.service"
import { IDENTITY_PROVIDER } from "../../../libs/identity-provider/identity-provider.module"
import { DeviceProofService } from "../../device/services/device-proof.service"
import { ReturnNotAcceptedException } from "../exceptions/return-not-accepted.exception"
import { AppUserRepository } from "../repositories/app-user.repository"
import { LoginChallengeRepository } from "../repositories/login-challenge.repository"
import { LoginFlowRepository } from "../repositories/login-flow.repository"
import { UserDeviceCredentialRepository } from "../repositories/user-device-credential.repository"
import type {
	LoginFlowOutcome,
	LoginFlowRow,
	OidcCallbackInput,
	OidcStartInput,
	OidcStartResponse,
	ProviderReturn,
	SessionResponse,
} from "../types/login.types"
import { isAuthorizedIdentity } from "../utils/identity-groups"
import { loginRejection } from "../utils/login-rejection"
import { personalNumberOfIdentity } from "../utils/personal-number-of-identity"
import { LoginAttemptService } from "./login-attempt.service"
import { LoginPolicyService } from "./login-policy.service"
import { SessionService } from "./session.service"
import { UserIdentityService } from "./user-identity.service"

const ACCESS_DENIED = "access_denied"

@Injectable()
export class OidcLoginService {
	private readonly logger = new Logger(OidcLoginService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly proofs: DeviceProofService,
		private readonly flows: LoginFlowRepository,
		private readonly challenges: LoginChallengeRepository,
		private readonly users: AppUserRepository,
		private readonly credentials: UserDeviceCredentialRepository,
		private readonly identities: UserIdentityService,
		private readonly sessions: SessionService,
		private readonly attempts: LoginAttemptService,
		private readonly policies: LoginPolicyService,
		@Inject(IDENTITY_PROVIDER) private readonly provider: IdentityProviderPort,
	) {}

	async start(request: Request, input: OidcStartInput): Promise<OidcStartResponse> {
		const device = await this.proofs.ofApprovedDevice(request)
		const now = new Date()
		await this.flows.deleteExpired(now)
		await this.challenges.deleteExpired(now)
		const state = randomSecret()
		const nonce = randomSecret()
		const pkce = newPkcePair()
		const authorizationUrl = await this.provider
			.authorizationUrl({ state, nonce, codeChallenge: pkce.codeChallenge })
			.catch((error: unknown) => {
				this.logger.warn(`The identity provider discovery failed for device ${device.id}: ${messageOf(error)}`)
				throw loginRejection(ERROR_CODE.PROVIDER_UNAVAILABLE)
			})
		const expiresAt = secondsAfter(now, OIDC_FLOW_LIFETIME_SECONDS)
		await this.flows.insert({
			state,
			deviceId: device.id,
			deviceKeyThumbprint: device.hwId,
			codeVerifier: pkce.codeVerifier,
			nonce,
			expectedPersonalNumber: input.expected_personal_number ?? null,
			startedAt: now,
			expiresAt,
		})
		return {
			authorization_url: authorizationUrl,
			issuer: this.provider.issuer(),
			state,
			expires_at: expiresAt.toISOString(),
		}
	}

	async processReturn(providerReturn: ProviderReturn): Promise<string> {
		const now = new Date()
		const flow = await this.flows.findByState(providerReturn.state)
		if (flow === undefined || flow.expires_at.getTime() <= now.getTime() || flow.returned_at !== null) {
			throw new ReturnNotAcceptedException("no open login flow for the returned state")
		}
		const outcome = await this.outcomeOf(flow, providerReturn)
		const completionCode = randomSecret()
		const recorded = await this.flows.recordReturn(flow.state, {
			returnedAt: now,
			outcome,
			completionCodeHash: sha256Hex(completionCode),
			completionExpiresAt: secondsAfter(now, COMPLETION_CODE_LIFETIME_SECONDS),
		})
		if (!recorded) {
			throw new ReturnNotAcceptedException("the login flow was returned to twice")
		}
		if (!outcome.ok) {
			await this.recordFailure(flow.device_id, null, outcome.code, now)
		}
		return appReturnUrl(flow.state, completionCode)
	}

	async complete(request: Request, input: OidcCallbackInput): Promise<SessionResponse> {
		const device = await this.proofs.ofApprovedDevice(request)
		const now = new Date()
		const flow = await this.flows.findByState(input.state)
		if (flow === undefined || flow.expires_at.getTime() <= now.getTime() || flow.consumed_at !== null) {
			throw loginRejection(ERROR_CODE.COMPLETION_CODE_INVALID)
		}
		if (flow.device_id !== device.id || flow.device_key_thumbprint !== device.hwId) {
			await this.recordFailure(device.id, null, ERROR_CODE.LOGIN_DEVICE_MISMATCH, now)
			throw loginRejection(ERROR_CODE.LOGIN_DEVICE_MISMATCH)
		}
		if (flow.returned_at === null || flow.outcome === null) {
			throw loginRejection(ERROR_CODE.LOGIN_INCOMPLETE)
		}
		if (
			flow.completion_code_hash !== sha256Hex(input.completion_code) ||
			flow.completion_expires_at === null ||
			flow.completion_expires_at.getTime() <= now.getTime()
		) {
			throw loginRejection(ERROR_CODE.COMPLETION_CODE_INVALID)
		}
		const outcome = flow.outcome
		if (!outcome.ok) {
			await this.consumeFlow(flow.state, now)
			throw loginRejection(outcome.code)
		}
		const policy = await this.policies.current()
		const personalNumber = personalNumberOfIdentity(outcome.identity, policy)
		if (personalNumber === undefined) {
			throw loginRejection(ERROR_CODE.LOGIN_PERSONAL_NUMBER_MISSING)
		}
		const knownIdentity = await this.users.findIdentity(this.provider.issuer(), outcome.identity.subjectId)
		const knownUser = knownIdentity === undefined ? undefined : await this.users.findById(knownIdentity.userId)
		if (knownUser !== undefined && !knownUser.isActive) {
			await this.consumeFlow(flow.state, now)
			await this.recordFailure(device.id, knownUser.id, ERROR_CODE.ACCOUNT_INACTIVE, now)
			throw loginRejection(ERROR_CODE.ACCOUNT_INACTIVE)
		}
		const pinKey = pinKeyOf(input)
		const credential = knownUser === undefined ? undefined : await this.credentials.find(knownUser.id, device.id)
		if (requiresPinSetup(credential) && pinKey === undefined) {
			throw loginRejection(ERROR_CODE.PIN_SETUP_REQUIRED)
		}
		return await this.database.sql.begin(async (tx) => {
			if (!(await this.flows.consume(tx, flow.state, now))) {
				throw loginRejection(ERROR_CODE.COMPLETION_CODE_INVALID)
			}
			const user = await this.identities.establish(tx, outcome.identity, personalNumber, policy, now)
			await this.credentials.recordFullLogin(tx, user.id, device.id, now, pinKey)
			const issued = await this.sessions.issueOrResume(tx, user.id, device.id, policy, now)
			await this.attempts.record(
				tx,
				{
					deviceId: device.id,
					userId: user.id,
					method: LOGIN_METHOD.OIDC,
					sessionId: issued.session.id,
					reason: undefined,
					details: { session_outcome: issued.outcome, pin_set: pinKey !== undefined },
				},
				now,
			)
			return await this.sessions.respond(tx, issued, user, device, policy)
		})
	}

	private async outcomeOf(flow: LoginFlowRow, providerReturn: ProviderReturn): Promise<LoginFlowOutcome> {
		if (providerReturn.error !== undefined) {
			this.logger.warn(
				`The identity provider returned ${providerReturn.error} for device ${flow.device_id}: ${providerReturn.errorDescription ?? ""}`,
			)
			return {
				ok: false,
				code: providerReturn.error === ACCESS_DENIED ? ERROR_CODE.ACCOUNT_INACTIVE : ERROR_CODE.LOGIN_FAILED,
			}
		}
		if (providerReturn.code === undefined) {
			return { ok: false, code: ERROR_CODE.LOGIN_FAILED }
		}
		const exchange = await this.provider.exchangeCode({
			code: providerReturn.code,
			codeVerifier: flow.code_verifier,
			nonce: flow.nonce,
		})
		if (!exchange.ok) {
			this.logger.warn(`The code exchange failed for device ${flow.device_id}: ${exchange.detail}`)
			const unavailable = exchange.failure === IDENTITY_PROVIDER_FAILURE.UNAVAILABLE
			return { ok: false, code: unavailable ? ERROR_CODE.PROVIDER_UNAVAILABLE : ERROR_CODE.LOGIN_FAILED }
		}
		const { identity } = exchange
		if (!isAuthenticationFresh(identity.authTime, flow.started_at)) {
			return { ok: false, code: ERROR_CODE.LOGIN_AUTHENTICATION_STALE }
		}
		const policy = await this.policies.current()
		const personalNumber = personalNumberOfIdentity(identity, policy)
		if (personalNumber === undefined) {
			return { ok: false, code: ERROR_CODE.LOGIN_PERSONAL_NUMBER_MISSING }
		}
		if (flow.expected_personal_number !== null && flow.expected_personal_number !== personalNumber) {
			return { ok: false, code: ERROR_CODE.LOGIN_IDENTITY_MISMATCH }
		}
		if (!isAuthorizedIdentity(identity, policy)) {
			return { ok: false, code: ERROR_CODE.ACCOUNT_INACTIVE }
		}
		return { ok: true, identity }
	}

	private async consumeFlow(state: string, now: Date): Promise<void> {
		await this.flows.consume(this.database.sql, state, now)
	}

	private async recordFailure(deviceId: string, userId: string | null, reason: ErrorCode, now: Date): Promise<void> {
		await this.attempts.recordFailure({ deviceId, userId, method: LOGIN_METHOD.OIDC, reason, details: {} }, now)
	}
}

function pinKeyOf(input: OidcCallbackInput): PinPublicKeyJwk | undefined {
	if (input.pin_proof_setup === undefined) {
		return undefined
	}
	const key = parsePinPublicKey(input.pin_proof_setup)
	if (key === undefined) {
		throw loginRejection(ERROR_CODE.RECORD_REJECTED)
	}
	return key
}
