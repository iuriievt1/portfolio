import { ADMINISTRATION_ERROR_CODE, AUDIT_SCOPE } from "@ansora/contracts"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	type AuthenticatedIdentity,
	IDENTITY_PROVIDER_FAILURE,
	type IdentityProviderPort,
	isAuthenticationFresh,
	LOGIN_METHOD,
	newPkcePair,
	OIDC_FLOW_LIFETIME_SECONDS,
	PERMISSION,
	randomSecret,
	secondsAfter,
} from "@ansora/core-server"
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common"
import { messageOf } from "../../../libs/common/utils/error-message"
import { DatabaseService } from "../../../libs/database/database.service"
import { ADMINISTRATION_IDENTITY_PROVIDER } from "../../../libs/identity-provider/identity-provider.module"
import { AdministrationSessionService } from "../../administration-session/services/administration-session.service"
import type { IssuedAdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { OUTSIDE_AUTHORIZED_GROUP } from "../constants/login-failure.constants"
import { AdministrationLoginFlowRepository } from "../repositories/administration-login-flow.repository"
import type { AppUser, ProviderReturn } from "../types/login.types"
import type { LoginPolicy } from "../types/login-policy.types"
import { isAuthorizedIdentity } from "../utils/identity-groups"
import { personalNumberOfIdentity } from "../utils/personal-number-of-identity"
import { staleAuthenticationWarning } from "../utils/stale-authentication-warning"
import { LoginPolicyService } from "./login-policy.service"
import { UserIdentityService } from "./user-identity.service"

const ADMINISTRATOR_REFUSAL = {
	AUTHENTICATION_STALE: "authentication_stale",
	INACTIVE: "account_inactive",
	OUTSIDE_AUTHORIZED_GROUP,
	NO_ADMINISTRATION_ACCESS: "no_administration_access",
} as const

type AdministratorRefusal = (typeof ADMINISTRATOR_REFUSAL)[keyof typeof ADMINISTRATOR_REFUSAL]

@Injectable()
export class AdministrationLoginService {
	private readonly logger = new Logger(AdministrationLoginService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly flows: AdministrationLoginFlowRepository,
		private readonly identities: UserIdentityService,
		private readonly policies: LoginPolicyService,
		private readonly sessions: AdministrationSessionService,
		private readonly audit: AuditRepository,
		@Inject(ADMINISTRATION_IDENTITY_PROVIDER) private readonly provider: IdentityProviderPort,
	) {}

	async start(): Promise<string> {
		const now = new Date()
		await this.flows.deleteExpired(now)
		const state = randomSecret()
		const nonce = randomSecret()
		const pkce = newPkcePair()
		const authorizationUrl = await this.provider
			.authorizationUrl({ state, nonce, codeChallenge: pkce.codeChallenge })
			.catch((error: unknown) => {
				this.logger.warn(`The identity provider discovery failed for the administration: ${messageOf(error)}`)
				throw unavailable()
			})
		await this.flows.insert({
			state,
			codeVerifier: pkce.codeVerifier,
			nonce,
			startedAt: now,
			expiresAt: secondsAfter(now, OIDC_FLOW_LIFETIME_SECONDS),
		})
		return authorizationUrl
	}

	async complete(providerReturn: ProviderReturn): Promise<IssuedAdministrationSession> {
		const now = new Date()
		const flow = await this.flows.take(providerReturn.state, now)
		if (flow === undefined) {
			throw reauthenticate()
		}
		if (providerReturn.error !== undefined || providerReturn.code === undefined) {
			this.logger.warn(
				`The identity provider returned ${providerReturn.error ?? "no code"} to the administration: ${providerReturn.errorDescription ?? ""}`,
			)
			throw reauthenticate()
		}
		const exchange = await this.provider.exchangeCode({
			code: providerReturn.code,
			codeVerifier: flow.code_verifier,
			nonce: flow.nonce,
		})
		if (!exchange.ok) {
			this.logger.warn(`The administration code exchange failed: ${exchange.detail}`)
			throw exchange.failure === IDENTITY_PROVIDER_FAILURE.UNAVAILABLE ? unavailable() : reauthenticate()
		}
		if (!isAuthenticationFresh(exchange.identity.authTime, flow.started_at)) {
			await this.refuseStaleAuthentication(exchange.identity, flow.started_at)
			throw reauthenticate()
		}
		const policy = await this.policies.current()
		const user = await this.establish(exchange.identity, policy, now)
		const refusal = await this.refusalOf(user, exchange.identity, policy)
		if (refusal !== undefined) {
			await this.recordRefusal(user, refusal)
			throw new ProblemException(HttpStatus.FORBIDDEN, ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		}
		return await this.database.sql.begin(async (tx) => {
			const issued = await this.sessions.issue(tx, user.id, now)
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.LOGIN,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: user.id,
				sessionId: issued.sessionId,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: { scope: AUDIT_SCOPE.ADMINISTRATION, method: LOGIN_METHOD.OIDC, reason: null },
			})
			return issued
		})
	}

	// CAP-004-R09, CAP-025-R03
	private async refuseStaleAuthentication(identity: AuthenticatedIdentity, flowStartedAt: Date): Promise<void> {
		const user = await this.identities.findKnownUser(identity)
		this.logger.warn(staleAuthenticationWarning(identity.authTime, flowStartedAt, user?.id))
		if (user !== undefined) {
			await this.recordRefusal(user, ADMINISTRATOR_REFUSAL.AUTHENTICATION_STALE)
		}
	}

	private async establish(identity: AuthenticatedIdentity, policy: LoginPolicy, now: Date): Promise<AppUser> {
		const personalNumber = personalNumberOfIdentity(identity, policy)
		if (personalNumber === undefined) {
			this.logger.warn("The identity provider returned no personal number to the administration")
			throw new ProblemException(HttpStatus.FORBIDDEN, ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED)
		}
		return await this.database.sql.begin(
			async (tx) => await this.identities.establish(tx, identity, personalNumber, policy, now),
		)
	}

	private async refusalOf(
		user: AppUser,
		identity: AuthenticatedIdentity,
		policy: LoginPolicy,
	): Promise<AdministratorRefusal | undefined> {
		if (!user.isActive) {
			return ADMINISTRATOR_REFUSAL.INACTIVE
		}
		if (!isAuthorizedIdentity(identity, policy)) {
			return ADMINISTRATOR_REFUSAL.OUTSIDE_AUTHORIZED_GROUP
		}
		// CAP-003-R13
		const permissions = await this.identities.permissionsOf(this.database.sql, user.id)
		return permissions.includes(PERMISSION.ADMINISTRATION_ACCESS)
			? undefined
			: ADMINISTRATOR_REFUSAL.NO_ADMINISTRATION_ACCESS
	}

	private async recordRefusal(user: AppUser, refusal: AdministratorRefusal): Promise<void> {
		await this.database.sql.begin(async (tx) => {
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.LOGIN,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: user.id,
				outcome: AUDIT_OUTCOME.FAILURE,
				details: { scope: AUDIT_SCOPE.ADMINISTRATION, method: LOGIN_METHOD.OIDC, reason: refusal },
			})
		})
	}
}

function reauthenticate(): ProblemException {
	return new ProblemException(HttpStatus.UNAUTHORIZED, ADMINISTRATION_ERROR_CODE.REAUTHENTICATION_REQUIRED)
}

function unavailable(): ProblemException {
	return new ProblemException(HttpStatus.SERVICE_UNAVAILABLE, ADMINISTRATION_ERROR_CODE.RETRY)
}
