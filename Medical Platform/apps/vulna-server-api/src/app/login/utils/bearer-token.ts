import { BEARER_PREFIX } from "@ansora/contracts"

// ADR-013
export function bearerToken(header: string | undefined): string | undefined {
	if (header === undefined || !header.startsWith(BEARER_PREFIX)) {
		return undefined
	}
	const token = header.slice(BEARER_PREFIX.length).trim()
	return token.length === 0 ? undefined : token
}
