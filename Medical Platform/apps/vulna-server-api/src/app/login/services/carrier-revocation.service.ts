import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME, type AuditEventType } from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { CardRepository } from "../repositories/card.repository"

@Injectable()
export class CarrierRevocationService {
	constructor(
		private readonly database: DatabaseService,
		private readonly cards: CardRepository,
		private readonly audit: AuditRepository,
	) {}

	// CAP-005-R03, CAP-005-R13
	async revokeCard(cardId: string, administrator: AdministrationSession): Promise<void> {
		await this.database.sql.begin(async (tx) => {
			const userId = await this.cards.ownerOfCard(tx, cardId)
			if (userId === undefined) {
				throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
			}
			if (await this.cards.revokeCard(tx, cardId, administrator.userId, new Date())) {
				await this.audit.append(tx, revocationEvent(AUDIT_EVENT_TYPE.CARD_REVOCATION, cardId, userId, administrator))
			}
		})
	}

	// CAP-005-R05, CAP-005-R13
	async revokeQrCode(qrCodeId: string, administrator: AdministrationSession): Promise<void> {
		await this.database.sql.begin(async (tx) => {
			const userId = await this.cards.ownerOfQrCode(tx, qrCodeId)
			if (userId === undefined) {
				throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
			}
			if (await this.cards.revokeQrCode(tx, qrCodeId, administrator.userId, new Date())) {
				await this.audit.append(
					tx,
					revocationEvent(AUDIT_EVENT_TYPE.QR_CODE_REVOCATION, qrCodeId, userId, administrator),
				)
			}
		})
	}

	// CAP-005-R12
	async revokeAllOf(
		tx: postgres.TransactionSql,
		userId: string,
		administrator: AdministrationSession,
		now: Date,
	): Promise<void> {
		for (const cardId of await this.cards.revokeCardsOf(tx, userId, administrator.userId, now)) {
			await this.audit.append(tx, revocationEvent(AUDIT_EVENT_TYPE.CARD_REVOCATION, cardId, userId, administrator))
		}
		await this.revokeQrCodesOf(tx, userId, administrator, now)
		await this.cards.supersedeBindingCodes(tx, userId, now)
	}

	// CAP-005-R05
	async revokeQrCodesOf(
		tx: postgres.TransactionSql,
		userId: string,
		administrator: AdministrationSession,
		now: Date,
	): Promise<void> {
		for (const qrCodeId of await this.cards.revokeQrCodesOf(tx, userId, administrator.userId, now)) {
			await this.audit.append(tx, revocationEvent(AUDIT_EVENT_TYPE.QR_CODE_REVOCATION, qrCodeId, userId, administrator))
		}
	}
}

function revocationEvent(
	eventType: AuditEventType,
	carrierId: string,
	userId: string,
	administrator: AdministrationSession,
): NewAuditEvent {
	return {
		eventType,
		actorKind: AUDIT_ACTOR_KIND.USER,
		actorUserId: administrator.userId,
		objectId: carrierId,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: { user_id: userId },
	}
}
