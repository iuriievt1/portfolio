import {
	type AuthorizationRequest,
	type CodeExchange,
	type DependencyObservation,
	IDENTITY_PROVIDER_FAILURE,
	type IdentityOutcome,
	type IdentityProviderPort,
	type RefreshOutcome,
} from "@ansora/core-server"

// CAP-028-R05, CAP-028-R20
export class ObservedIdentityProvider implements IdentityProviderPort {
	constructor(
		private readonly provider: IdentityProviderPort,
		private readonly observation: DependencyObservation,
	) {}

	issuer(): string {
		return this.provider.issuer()
	}

	async authorizationUrl(request: AuthorizationRequest): Promise<string> {
		try {
			return await this.provider.authorizationUrl(request)
		} catch (error) {
			this.observation.recordUnavailability(Date.now())
			throw error
		}
	}

	async exchangeCode(exchange: CodeExchange): Promise<IdentityOutcome> {
		return this.observed(await this.provider.exchangeCode(exchange))
	}

	async refresh(refreshToken: string): Promise<RefreshOutcome> {
		return this.observed(await this.provider.refresh(refreshToken))
	}

	private observed<Outcome extends IdentityOutcome | RefreshOutcome>(outcome: Outcome): Outcome {
		if (!outcome.ok && outcome.failure === IDENTITY_PROVIDER_FAILURE.UNAVAILABLE) {
			this.observation.recordUnavailability(Date.now())
		} else {
			this.observation.recordAnswer()
		}
		return outcome
	}
}
