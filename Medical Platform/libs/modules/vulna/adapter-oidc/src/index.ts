import type {
	AuthenticatedIdentity,
	AuthorizationRequest,
	CodeExchange,
	IdentityOutcome,
	IdentityProviderPort,
	RefreshOutcome,
} from "@ansora/core-server/ports"
import { IDENTITY_PROVIDER_FAILURE } from "@ansora/core-server/ports"
import { DiscoveryClient, type Fetch, type ProviderMetadata } from "./discovery"
import { type IdTokenClaims, IdTokenError, verifyIdToken } from "./id-token"
import { JwksClient } from "./jwks"
import { messageOf, optionalText } from "./text"
import { TokenEndpoint, type TokenResponse } from "./token-endpoint"

export interface OidcSettings {
	issuer: string
	clientId: string
	clientSecret: string
	redirectUri: string
	scopes?: string
	fetch?: Fetch
}

const PROMPT = "login"
const MAX_AGE = "0"
const OPENID_SCOPE = "openid"
export const DEFAULT_SCOPES = "openid profile offline_access"
const SCOPE_SEPARATOR = /\s+/
const SCOPE_DELIMITER = " "
const NAME_DELIMITER = " "
const RESPONSE_TYPE = "code"
const AUTHORIZATION_CODE_GRANT = "authorization_code"
const REFRESH_TOKEN_GRANT = "refresh_token"
const NO_ID_TOKEN = "the token response carries no ID token"
const CODE_CHALLENGE_METHOD = "S256"

/**
 * Adapter for the IdentityProvider port — OAuth2/OIDC over Active Directory
 * ✓ ADR-003 ř. 30, NAB-051.
 *
 * The server is a **confidential client** towards the provider ✓ NAB-219 and **provider tokens
 * never leave the server** ✓ NAB-222. The PKCE verifier is created on and stays on the server;
 * the app only receives an authorization URL and an opaque state ✓ ADR-013.
 *
 * LDAPS and SAML are not built in the MOÚ profile — only by a contract amendment
 * ✓ ADR-003 ř. 33, SML-094.
 */
export class OidcIdentityProvider implements IdentityProviderPort {
	private readonly discovery: DiscoveryClient
	private readonly jwks: JwksClient
	private readonly tokens: TokenEndpoint
	private readonly scope: string

	constructor(private readonly settings: OidcSettings) {
		const fetchImplementation = settings.fetch ?? fetch
		this.discovery = new DiscoveryClient(settings.issuer, fetchImplementation)
		this.jwks = new JwksClient(fetchImplementation)
		this.tokens = new TokenEndpoint(settings.clientId, settings.clientSecret, fetchImplementation)
		this.scope = scopeParameter(settings.scopes ?? DEFAULT_SCOPES)
	}

	issuer(): string {
		return this.settings.issuer
	}

	async authorizationUrl(request: AuthorizationRequest): Promise<string> {
		const metadata = await this.discovery.metadata()
		const url = new URL(metadata.authorization_endpoint)
		url.searchParams.set("response_type", RESPONSE_TYPE)
		url.searchParams.set("client_id", this.settings.clientId)
		url.searchParams.set("redirect_uri", this.settings.redirectUri)
		url.searchParams.set("scope", this.scope)
		url.searchParams.set("state", request.state)
		url.searchParams.set("nonce", request.nonce)
		url.searchParams.set("code_challenge", request.codeChallenge)
		url.searchParams.set("code_challenge_method", CODE_CHALLENGE_METHOD)
		url.searchParams.set("prompt", PROMPT)
		url.searchParams.set("max_age", MAX_AGE)
		return url.toString()
	}

	async exchangeCode(exchange: CodeExchange): Promise<IdentityOutcome> {
		const metadata = await this.metadataOrUnavailable()
		if (!metadata.ok) {
			return metadata
		}
		const outcome = await this.tokens.exchange(metadata.value.token_endpoint, {
			grant_type: AUTHORIZATION_CODE_GRANT,
			code: exchange.code,
			redirect_uri: this.settings.redirectUri,
			code_verifier: exchange.codeVerifier,
		})
		if (!outcome.ok) {
			return outcome
		}
		return await this.identityOf(metadata.value, outcome.response, exchange.nonce)
	}

	async refresh(refreshToken: string): Promise<RefreshOutcome> {
		const metadata = await this.metadataOrUnavailable()
		if (!metadata.ok) {
			return metadata
		}
		const outcome = await this.tokens.exchange(metadata.value.token_endpoint, {
			grant_type: REFRESH_TOKEN_GRANT,
			refresh_token: refreshToken,
		})
		if (!outcome.ok) {
			return outcome
		}
		const identity =
			outcome.response.id_token === undefined
				? undefined
				: await this.identityOf(metadata.value, outcome.response, undefined)
		if (identity !== undefined && !identity.ok) {
			return identity
		}
		return {
			ok: true,
			refreshed: { refreshToken: outcome.response.refresh_token, identity: identity?.identity },
		}
	}

	private async metadataOrUnavailable(): Promise<
		| { ok: true; value: ProviderMetadata }
		| { ok: false; failure: typeof IDENTITY_PROVIDER_FAILURE.UNAVAILABLE; detail: string }
	> {
		try {
			return { ok: true, value: await this.discovery.metadata() }
		} catch (error) {
			return { ok: false, failure: IDENTITY_PROVIDER_FAILURE.UNAVAILABLE, detail: messageOf(error) }
		}
	}

	private async identityOf(
		metadata: ProviderMetadata,
		response: TokenResponse,
		nonce: string | undefined,
	): Promise<IdentityOutcome> {
		if (response.id_token === undefined) {
			return { ok: false, failure: IDENTITY_PROVIDER_FAILURE.REJECTED, detail: NO_ID_TOKEN }
		}
		let claims: IdTokenClaims
		try {
			claims = await verifyIdToken(response.id_token, {
				issuer: this.settings.issuer,
				clientId: this.settings.clientId,
				nonce,
				now: new Date(),
				keyOf: (kid, algorithm) => this.jwks.key(metadata.jwks_uri, kid, algorithm),
			})
		} catch (error) {
			if (error instanceof IdTokenError) {
				return { ok: false, failure: IDENTITY_PROVIDER_FAILURE.REJECTED, detail: error.message }
			}
			return { ok: false, failure: IDENTITY_PROVIDER_FAILURE.UNAVAILABLE, detail: messageOf(error) }
		}
		return { ok: true, identity: identityFromClaims(claims, response.refresh_token) }
	}
}

export function scopeParameter(scopes: string): string {
	const requested = [
		...new Set(
			scopes
				.trim()
				.split(SCOPE_SEPARATOR)
				.filter((scope) => scope.length > 0),
		),
	]
	if (!requested.includes(OPENID_SCOPE)) {
		throw new Error(`OIDC_SCOPES must contain ${OPENID_SCOPE}, got "${scopes}"`)
	}
	return requested.join(SCOPE_DELIMITER)
}

function identityFromClaims(claims: IdTokenClaims, refreshToken: string | undefined): AuthenticatedIdentity {
	const givenName = optionalText(claims.all.given_name)
	const familyName = optionalText(claims.all.family_name)
	return {
		subjectId: claims.subject,
		displayName: displayNameOf(claims.all, givenName, familyName),
		givenName,
		familyName,
		authTime: claims.authTime,
		claims: claims.all,
		refreshToken,
	}
}

function displayNameOf(
	claims: Readonly<Record<string, unknown>>,
	givenName: string | undefined,
	familyName: string | undefined,
): string {
	const name = optionalText(claims.name)
	if (name !== undefined) {
		return name
	}
	const joined = [givenName, familyName].filter((part) => part !== undefined).join(NAME_DELIMITER)
	return joined.length > 0 ? joined : (optionalText(claims.preferred_username) ?? "")
}
