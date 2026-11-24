import {
	CARD_IDENTITY_MODE,
	type CardIdentityResolverPort,
	type ResolvedCardIdentity,
	sha256Hex,
} from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { AppUserRepository } from "../repositories/app-user.repository"
import { CardRepository } from "../repositories/card.repository"
import { LoginPolicyService } from "./login-policy.service"

@Injectable()
export class CardIdentityService implements CardIdentityResolverPort {
	constructor(
		private readonly policies: LoginPolicyService,
		private readonly cards: CardRepository,
		private readonly users: AppUserRepository,
	) {}

	async resolve(identifier: string): Promise<ResolvedCardIdentity | undefined> {
		const { cardIdentityMode } = await this.policies.current()
		const hash = sha256Hex(identifier)
		switch (cardIdentityMode) {
			case CARD_IDENTITY_MODE.UID_BINDING: {
				const card = await this.cards.findValidCard(hash)
				return card === undefined ? undefined : { userId: card.user_id }
			}
			case CARD_IDENTITY_MODE.CARD_APPLICATION_IDENTIFIER: {
				if (await this.cards.isRevokedIdentifier(hash)) {
					return undefined
				}
				const user = await this.users.findByPersonalNumber(identifier)
				return user === undefined ? undefined : { userId: user.id }
			}
			case CARD_IDENTITY_MODE.CUSTOMER_CARD_SYSTEM:
				return undefined
			default:
				return cardIdentityMode satisfies never
		}
	}
}
