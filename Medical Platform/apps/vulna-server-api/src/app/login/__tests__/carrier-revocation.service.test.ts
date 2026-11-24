import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, PERMISSIONS } from "@ansora/core-server"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { ProblemException } from "../../infra/exceptions/problem.exception"
import type { CardRepository } from "../repositories/card.repository"
import { CarrierRevocationService } from "../services/carrier-revocation.service"

const ADMINISTRATOR: AdministrationSession = {
	sessionId: "99999999-9999-4999-8999-999999999999",
	userId: "11111111-1111-4111-8111-111111111111",
	permissions: PERMISSIONS,
}
const USER_ID = "22222222-2222-4222-8222-222222222222"
const CARD_ID = "33333333-3333-4333-8333-333333333333"
const QR_CODE_ID = "44444444-4444-4444-8444-444444444444"
const UNKNOWN_ID = "55555555-5555-4555-8555-555555555555"
const NOW = new Date("2026-10-26T09:00:00Z")
const TX = {} as postgres.TransactionSql

interface Carrier {
	id: string
	userId: string
	revoked: boolean
}

interface Harness {
	service: CarrierRevocationService
	cards: Carrier[]
	qrCodes: Carrier[]
	audited: NewAuditEvent[]
	supersededCodesOf: string[]
}

function harness(cards: Carrier[], qrCodes: Carrier[]): Harness {
	const audited: NewAuditEvent[] = []
	const supersededCodesOf: string[] = []
	const revokeOne = (carriers: Carrier[], id: string) => {
		const carrier = carriers.find((candidate) => candidate.id === id && !candidate.revoked)
		if (carrier === undefined) {
			return false
		}
		carrier.revoked = true
		return true
	}
	const revokeAll = (carriers: Carrier[], userId: string) =>
		carriers
			.filter((carrier) => carrier.userId === userId && !carrier.revoked)
			.map((carrier) => {
				carrier.revoked = true
				return carrier.id
			})
	const repository = {
		ownerOfCard: async (_sql: unknown, id: string) => cards.find((card) => card.id === id)?.userId,
		revokeCard: async (_sql: unknown, id: string) => revokeOne(cards, id),
		revokeCardsOf: async (_sql: unknown, userId: string) => revokeAll(cards, userId),
		ownerOfQrCode: async (_sql: unknown, id: string) => qrCodes.find((code) => code.id === id)?.userId,
		revokeQrCode: async (_sql: unknown, id: string) => revokeOne(qrCodes, id),
		revokeQrCodesOf: async (_sql: unknown, userId: string) => revokeAll(qrCodes, userId),
		supersedeBindingCodes: async (_sql: unknown, userId: string) => {
			supersededCodesOf.push(userId)
		},
	} as unknown as CardRepository
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work({} as never) },
	} as unknown as DatabaseService
	const audit = {
		append: async (_tx: unknown, event: NewAuditEvent) => {
			audited.push(event)
		},
	} as unknown as AuditRepository
	return {
		service: new CarrierRevocationService(database, repository, audit),
		cards,
		qrCodes,
		audited,
		supersededCodesOf,
	}
}

function validCard(): Carrier {
	return { id: CARD_ID, userId: USER_ID, revoked: false }
}

function validQrCode(): Carrier {
	return { id: QR_CODE_ID, userId: USER_ID, revoked: false }
}

describe("revocation of a carrier by the administrator", () => {
	it("CAP-005-R03 revokes the card binding and records who revoked it", async () => {
		const { service, cards, audited } = harness([validCard()], [])

		await service.revokeCard(CARD_ID, ADMINISTRATOR)

		expect(cards[0]?.revoked).toBe(true)
		expect(audited).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.CARD_REVOCATION,
				actorUserId: ADMINISTRATOR.userId,
				objectId: CARD_ID,
				details: { user_id: USER_ID },
			}),
		])
	})

	it("CAP-005-S03 revokes the QR code and records who revoked it", async () => {
		const { service, qrCodes, audited } = harness([], [validQrCode()])

		await service.revokeQrCode(QR_CODE_ID, ADMINISTRATOR)

		expect(qrCodes[0]?.revoked).toBe(true)
		expect(audited).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.QR_CODE_REVOCATION,
				actorUserId: ADMINISTRATOR.userId,
				objectId: QR_CODE_ID,
				details: { user_id: USER_ID },
			}),
		])
	})

	it("changes and records nothing when the carrier is already revoked", async () => {
		const { service, audited } = harness([{ ...validCard(), revoked: true }], [{ ...validQrCode(), revoked: true }])

		await service.revokeCard(CARD_ID, ADMINISTRATOR)
		await service.revokeQrCode(QR_CODE_ID, ADMINISTRATOR)

		expect(audited).toEqual([])
	})

	it("refuses a carrier it does not know", async () => {
		const { service, audited } = harness([], [])

		const card = await service.revokeCard(UNKNOWN_ID, ADMINISTRATOR).catch((error: unknown) => error)
		const qrCode = await service.revokeQrCode(UNKNOWN_ID, ADMINISTRATOR).catch((error: unknown) => error)

		expect((card as ProblemException).code).toBe(ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		expect((qrCode as ProblemException).code).toBe(ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		expect(audited).toEqual([])
	})

	it("CAP-005-R12 revokes every valid carrier of the user and records each", async () => {
		const otherCard = { id: UNKNOWN_ID, userId: ADMINISTRATOR.userId, revoked: false }
		const { service, cards, qrCodes, audited, supersededCodesOf } = harness([validCard(), otherCard], [validQrCode()])

		await service.revokeAllOf(TX, USER_ID, ADMINISTRATOR, NOW)

		expect(cards.map((card) => card.revoked)).toEqual([true, false])
		expect(qrCodes[0]?.revoked).toBe(true)
		expect(supersededCodesOf).toEqual([USER_ID])
		expect(audited).toMatchObject([
			{ eventType: AUDIT_EVENT_TYPE.CARD_REVOCATION, objectId: CARD_ID },
			{ eventType: AUDIT_EVENT_TYPE.QR_CODE_REVOCATION, objectId: QR_CODE_ID },
		])
	})
})
