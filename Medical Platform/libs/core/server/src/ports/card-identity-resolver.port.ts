import { CARD_IDENTITY_MODE, type CardIdentityMode } from "@ansora/contracts"

export { CARD_IDENTITY_MODE, type CardIdentityMode }

export interface ResolvedCardIdentity {
	userId: string
}

export interface CardIdentityResolverPort {
	resolve(identifier: string): Promise<ResolvedCardIdentity | undefined>
}
