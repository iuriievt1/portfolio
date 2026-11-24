import { randomBytes } from "node:crypto"
import { ADMINISTRATION_ERROR_CODE, ERROR_CODE, type ErrorCode } from "@ansora/contracts"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	CARD_IDENTITY_MODE,
	type JsonObject,
	secondsAfter,
	sha256Hex,
	shortCardUid,
	verifySignedBody,
} from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type { Request } from "express"
import { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { DeviceProofService } from "../../device/services/device-proof.service"
import type { Device } from "../../device/types/device.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { SIGNED_BODY_DETAIL_PREFIX } from "../constants/login-failure.constants"
import { AppUserRepository } from "../repositories/app-user.repository"
import { CardRepository } from "../repositories/card.repository"
import type { CardBindingCode, CardBindingReceipt } from "../types/login.types"
import { loginRejection } from "../utils/login-rejection"
import { LoginChallengeService } from "./login-challenge.service"
import { LoginPolicyService } from "./login-policy.service"

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const CODE_LENGTH = 12

@Injectable()
export class CardBindingService {
	constructor(
		private readonly database: DatabaseService,
		private readonly proofs: DeviceProofService,
		private readonly policies: LoginPolicyService,
		private readonly challenges: LoginChallengeService,
		private readonly cards: CardRepository,
		private readonly users: AppUserRepository,
		private readonly audit: AuditRepository,
	) {}

	async issueCode(
		userId: string,
		administrator: AdministrationSession,
		note: string | undefined,
	): Promise<CardBindingCode> {
		const policy = await this.policies.current()
		if (policy.cardIdentityMode !== CARD_IDENTITY_MODE.UID_BINDING) {
			throw new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.CARD_BINDING_NOT_APPLICABLE)
		}
		const user = await this.users.findById(userId)
		if (user === undefined) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		}
		if (!user.isActive) {
			throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ADMINISTRATION_ERROR_CODE.RECORD_REJECTED)
		}
		const now = new Date()
		const code = newBindingCode()
		const expiresAt = secondsAfter(now, policy.cardBindingCodeLifetimeSeconds)
		await this.database.sql.begin(async (tx) => {
			// CAP-005-R12
			if (!(await this.users.lockActive(tx, user.id))) {
				throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ADMINISTRATION_ERROR_CODE.RECORD_REJECTED)
			}
			await this.cards.supersedeBindingCodes(tx, user.id, now)
			await this.cards.insertBindingCode(tx, {
				codeHash: sha256Hex(code),
				userId: user.id,
				issuedByUserId: administrator.userId,
				issuedAt: now,
				expiresAt,
			})
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.CARD_BINDING_CODE_ISSUED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: administrator.userId,
				objectId: user.id,
				outcome: AUDIT_OUTCOME.SUCCESS,
				// NAB-438
				details: { user_id: user.id, expires_at: expiresAt.toISOString(), note: note ?? null },
			})
		})
		return { code, expires_at: expiresAt.toISOString(), user_id: user.id, user_display_name: user.displayName }
	}

	async complete(request: Request, body: string): Promise<CardBindingReceipt> {
		const device = await this.proofs.ofApprovedDevice(request)
		const policy = await this.policies.current()
		if (policy.cardIdentityMode !== CARD_IDENTITY_MODE.UID_BINDING) {
			throw loginRejection(ERROR_CODE.CARD_BINDING_DISABLED)
		}
		const now = new Date()
		const verdict = verifySignedBody(body, device.publicKeyJwk, now)
		if (!verdict.ok) {
			throw await this.reject(device, null, ERROR_CODE.LOGIN_FAILED, {
				detail: `${SIGNED_BODY_DETAIL_PREFIX}${verdict.reason}`,
			})
		}
		const { claims } = verdict
		if (claims.bindingCode === undefined) {
			throw loginRejection(ERROR_CODE.RECORD_REJECTED)
		}
		if ((await this.challenges.consume(claims.challengeId, device.id, claims.value, now)) === undefined) {
			throw await this.reject(device, null, ERROR_CODE.CHALLENGE_INVALID, {})
		}
		const codeHash = sha256Hex(claims.bindingCode)
		const code = await this.cards.findBindingCode(codeHash)
		const identifierHash = sha256Hex(claims.identifier)
		if (code === undefined || code.consumed_at !== null || code.expires_at.getTime() <= now.getTime()) {
			await this.consumeCode(codeHash, device.id, now)
			throw await this.reject(device, code?.user_id ?? null, ERROR_CODE.CARD_BINDING_CODE_INVALID, {
				card: identifierHash,
			})
		}
		const existing = await this.cards.findValidCard(identifierHash)
		if (existing !== undefined && existing.user_id !== code.user_id) {
			await this.consumeCode(codeHash, device.id, now)
			throw await this.reject(device, code.user_id, ERROR_CODE.CARD_ALREADY_BOUND, { card: identifierHash })
		}
		const user = await this.users.findById(code.user_id)
		if (user === undefined) {
			throw new Error(`binding code names unknown user ${code.user_id}`)
		}
		// CAP-005-R12
		if (!user.isActive) {
			await this.consumeCode(codeHash, device.id, now)
			throw await this.reject(device, user.id, ERROR_CODE.CARD_BINDING_CODE_INVALID, { card: identifierHash })
		}
		return await this.database.sql.begin(async (tx) => {
			if (!(await this.users.lockActive(tx, user.id))) {
				throw loginRejection(ERROR_CODE.CARD_BINDING_CODE_INVALID)
			}
			await this.cards.consumeBindingCode(tx, codeHash, device.id, now)
			const card =
				existing ??
				(await this.cards.insertCard(tx, {
					userId: user.id,
					identifierHash,
					shortUid: shortCardUid(claims.identifier),
					boundByDeviceId: device.id,
					boundAt: now,
				}))
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.CARD_BINDING_CREATED,
				actorKind: AUDIT_ACTOR_KIND.DEVICE,
				actorDeviceId: device.id,
				objectId: card.id,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: { user_id: user.id, card: identifierHash },
			})
			return {
				card_id: card.id,
				short_uid: card.short_uid,
				user_display_name: user.displayName,
				bound_at: card.bound_at.toISOString(),
			}
		})
	}

	private async consumeCode(codeHash: string, deviceId: string, now: Date): Promise<void> {
		await this.cards.consumeBindingCode(this.database.sql, codeHash, deviceId, now)
	}

	private async reject(
		device: Device,
		userId: string | null,
		code: ErrorCode,
		details: JsonObject,
	): Promise<ProblemException> {
		await this.database.sql.begin(async (tx) => {
			await this.audit.append(tx, {
				eventType: AUDIT_EVENT_TYPE.CARD_BINDING_CREATED,
				actorKind: AUDIT_ACTOR_KIND.DEVICE,
				actorDeviceId: device.id,
				outcome: AUDIT_OUTCOME.FAILURE,
				details: { reason: code, user_id: userId, ...details },
			})
		})
		return loginRejection(code)
	}
}

function newBindingCode(): string {
	const bytes = randomBytes(CODE_LENGTH)
	let code = ""
	for (const byte of bytes) {
		code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
	}
	return code
}
