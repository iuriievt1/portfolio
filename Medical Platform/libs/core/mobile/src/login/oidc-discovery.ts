import type { MobileContract } from "@ansora/contracts"

export type AuthorizationEndpointMismatchDetails =
	MobileContract.components["schemas"]["AuthorizationEndpointMismatchDetails"]

export interface DiscoveryDocument {
	issuer: string
	authorizationEndpoint: string
}

export interface AuthorizationStart {
	authorization_url: string
	issuer: string
}

export type AuthorizationVerdict = { ok: true } | { ok: false; details: AuthorizationEndpointMismatchDetails }

export function parseDiscoveryDocument(value: unknown): DiscoveryDocument | undefined {
	if (typeof value !== "object" || value === null) {
		return undefined
	}
	const { issuer, authorization_endpoint } = value as Record<string, unknown>
	if (typeof issuer !== "string" || typeof authorization_endpoint !== "string") {
		return undefined
	}
	return { issuer, authorizationEndpoint: authorization_endpoint }
}

export function verifyAuthorizationUrl(
	start: AuthorizationStart,
	discovery: DiscoveryDocument,
	discoveryUrl: string,
): AuthorizationVerdict {
	const serverEndpoint = originAndPath(start.authorization_url)
	const providerEndpoint = originAndPath(discovery.authorizationEndpoint)
	if (serverEndpoint === undefined) {
		return mismatch(start.authorization_url, providerEndpoint ?? null, discoveryUrl)
	}
	if (discovery.issuer !== start.issuer) {
		return mismatch(serverEndpoint, null, discoveryUrl)
	}
	if (providerEndpoint === undefined || providerEndpoint !== serverEndpoint) {
		return mismatch(serverEndpoint, providerEndpoint ?? null, discoveryUrl)
	}
	return { ok: true }
}

export function originAndPath(url: string): string | undefined {
	try {
		const parsed = new URL(url)
		return `${parsed.origin}${parsed.pathname}`
	} catch {
		return undefined
	}
}

function mismatch(serverEndpoint: string, providerEndpoint: string | null, discoveryUrl: string): AuthorizationVerdict {
	return {
		ok: false,
		details: {
			server_authorization_endpoint: serverEndpoint,
			provider_authorization_endpoint: providerEndpoint,
			discovery_url: discoveryUrl,
		},
	}
}
