import { CARD_IDENTITY_MODE, type CardIdentityMode, sha256Hex } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { AppUserRepository } from "../repositories/app-user.repository"
import type { CardRepository } from "../repositories/card.repository"
import { CardIdentityService } from "../services/card-identity.service"
import type { LoginPolicyService } from "../services/login-policy.service"
import type { AppUser } from "../types/login.types"

const EMPLOYEE_IDENTIFIER = "000303"
const USER: AppUser = {
	id: "66666666-6666-4666-8666-666666666666",
	personalNumber: EMPLOYEE_IDENTIFIER,
	displayName: "Petr Svoboda",
	isActive: true,
	loginName: null,
	email: null,
	preferredLanguage: null,
}

function serviceIn(mode: CardIdentityMode, revoked: readonly string[] = []): CardIdentityService {
	const policies = { current: async () => ({ cardIdentityMode: mode }) } as unknown as LoginPolicyService
	const cards = {
		findValidCard: async () => undefined,
		isRevokedIdentifier: async (hash: string) => revoked.includes(hash),
	} as unknown as CardRepository
	const users = {
		findByPersonalNumber: async (number: string) => (number === EMPLOYEE_IDENTIFIER ? USER : undefined),
	} as unknown as AppUserRepository
	return new CardIdentityService(policies, cards, users)
}

describe("CardIdentityService", () => {
	it("CAP-005-S13 finds the user by the employee identifier on the card without a binding", async () => {
		const identity = await serviceIn(CARD_IDENTITY_MODE.CARD_APPLICATION_IDENTIFIER).resolve(EMPLOYEE_IDENTIFIER)
		expect(identity).toEqual({ userId: USER.id })
	})

	it("CAP-005-S15 refuses a card whose identifier the administrator revoked", async () => {
		const service = serviceIn(CARD_IDENTITY_MODE.CARD_APPLICATION_IDENTIFIER, [sha256Hex(EMPLOYEE_IDENTIFIER)])
		expect(await service.resolve(EMPLOYEE_IDENTIFIER)).toBeUndefined()
	})

	it("CAP-005-S14 knows no card in the binding mode without a binding", async () => {
		expect(await serviceIn(CARD_IDENTITY_MODE.UID_BINDING).resolve(EMPLOYEE_IDENTIFIER)).toBeUndefined()
	})
})
