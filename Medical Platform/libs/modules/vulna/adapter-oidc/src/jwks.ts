import { createPublicKey, type KeyObject } from "node:crypto"
import type { Fetch } from "./discovery"
import { type IdTokenAlgorithm, keyTypeOf } from "./id-token"
import { JSON_MEDIA_TYPE } from "./text"

interface JsonWebKey {
	kid?: string
	kty?: string
	alg?: string
	use?: string
	[member: string]: unknown
}

const MINIMUM_RELOAD_INTERVAL_MILLISECONDS = 60_000
const SIGNATURE_USE = "sig"

export class JwksClient {
	private keys: JsonWebKey[] = []
	private loadedAt = 0

	constructor(private readonly fetchImplementation: Fetch) {}

	async key(jwksUri: string, kid: string | undefined, algorithm: IdTokenAlgorithm): Promise<KeyObject | undefined> {
		let found = this.select(kid, algorithm)
		if (found === undefined && Date.now() - this.loadedAt >= MINIMUM_RELOAD_INTERVAL_MILLISECONDS) {
			await this.load(jwksUri)
			found = this.select(kid, algorithm)
		}
		return found === undefined ? undefined : createPublicKey({ key: found, format: "jwk" })
	}

	private select(kid: string | undefined, algorithm: IdTokenAlgorithm): JsonWebKey | undefined {
		const candidates = this.keys.filter(
			(key) =>
				key.kty === keyTypeOf(algorithm) &&
				(key.use === undefined || key.use === SIGNATURE_USE) &&
				(key.alg === undefined || key.alg === algorithm) &&
				(kid === undefined || key.kid === kid),
		)
		return candidates.length === 1 || (kid !== undefined && candidates.length > 0) ? candidates[0] : undefined
	}

	private async load(jwksUri: string): Promise<void> {
		this.loadedAt = Date.now()
		const response = await this.fetchImplementation(jwksUri, { headers: { accept: JSON_MEDIA_TYPE } })
		if (!response.ok) {
			throw new Error(`JWKS at ${jwksUri} answered ${response.status}`)
		}
		const document: unknown = await response.json()
		const keys = (document as { keys?: unknown }).keys
		if (!Array.isArray(keys)) {
			throw new Error(`JWKS at ${jwksUri} carries no keys`)
		}
		this.keys = keys.filter((key): key is JsonWebKey => typeof key === "object" && key !== null)
	}
}
