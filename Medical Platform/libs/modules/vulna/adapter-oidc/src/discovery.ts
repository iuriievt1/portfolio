import { JSON_MEDIA_TYPE } from "./text"

export type Fetch = typeof fetch

export interface ProviderMetadata {
	issuer: string
	authorization_endpoint: string
	token_endpoint: string
	jwks_uri: string
}

const DISCOVERY_PATH = "/.well-known/openid-configuration"
const TRAILING_SLASH = /\/$/

export class DiscoveryClient {
	private cached: ProviderMetadata | undefined

	constructor(
		private readonly issuer: string,
		private readonly fetchImplementation: Fetch,
	) {}

	async metadata(): Promise<ProviderMetadata> {
		if (this.cached === undefined) {
			this.cached = await this.load()
		}
		return this.cached
	}

	private async load(): Promise<ProviderMetadata> {
		const response = await this.fetchImplementation(discoveryUrl(this.issuer), {
			headers: { accept: JSON_MEDIA_TYPE },
		})
		if (!response.ok) {
			throw new Error(`discovery of ${this.issuer} answered ${response.status}`)
		}
		const document: unknown = await response.json()
		const metadata = asMetadata(document)
		if (metadata === undefined) {
			throw new Error(`discovery of ${this.issuer} is incomplete`)
		}
		if (metadata.issuer !== this.issuer) {
			throw new Error(`discovery issuer ${metadata.issuer} differs from the configured ${this.issuer}`)
		}
		return metadata
	}
}

function discoveryUrl(issuer: string): string {
	return `${issuer.replace(TRAILING_SLASH, "")}${DISCOVERY_PATH}`
}

function asMetadata(document: unknown): ProviderMetadata | undefined {
	if (typeof document !== "object" || document === null) {
		return undefined
	}
	const { issuer, authorization_endpoint, token_endpoint, jwks_uri } = document as Record<string, unknown>
	if (
		typeof issuer !== "string" ||
		typeof authorization_endpoint !== "string" ||
		typeof token_endpoint !== "string" ||
		typeof jwks_uri !== "string"
	) {
		return undefined
	}
	return { issuer, authorization_endpoint, token_endpoint, jwks_uri }
}
