export interface AuthorizationRequest {
	state: string
	nonce: string
	codeChallenge: string
}

export interface CodeExchange {
	code: string
	codeVerifier: string
	nonce: string
}

/**
 * The result of authenticating against the identity provider.
 *
 * **Provider tokens stay on the server** ✓ NAB-222 — they never leave through this port.
 */
export interface AuthenticatedIdentity {
	subjectId: string
	displayName: string
	givenName: string | undefined
	familyName: string | undefined
	authTime: number | undefined
	claims: Readonly<Record<string, unknown>>
	refreshToken: string | undefined
}

export const IDENTITY_PROVIDER_FAILURE = {
	UNAVAILABLE: "unavailable",
	REJECTED: "rejected",
} as const

export type IdentityProviderFailure = (typeof IDENTITY_PROVIDER_FAILURE)[keyof typeof IDENTITY_PROVIDER_FAILURE]

export type IdentityOutcome =
	| { ok: true; identity: AuthenticatedIdentity }
	| { ok: false; failure: IdentityProviderFailure; detail: string }

export interface RefreshedIdentity {
	refreshToken: string | undefined
	identity: AuthenticatedIdentity | undefined
}

export type RefreshOutcome =
	| { ok: true; refreshed: RefreshedIdentity }
	| { ok: false; failure: IdentityProviderFailure; detail: string }

export interface IdentityProviderPort {
	issuer(): string
	authorizationUrl(request: AuthorizationRequest): Promise<string>
	exchangeCode(exchange: CodeExchange): Promise<IdentityOutcome>
	refresh(refreshToken: string): Promise<RefreshOutcome>
}
