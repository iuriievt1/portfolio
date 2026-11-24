import type { CryptoAndKeys, PublicKeyJwk } from "../native"

export type JwsSigner = Pick<CryptoAndKeys, "signJws" | "randomIdentifier">

export const DPOP_JWS_TYPE = "dpop+jwt"
export const JWS_ALGORITHM = "ES256"
export const SIGNED_BODY_JWS_TYPE = "JWT"

const MILLISECONDS_PER_SECOND = 1000

export interface DeviceProofInput {
	method: string
	url: string
	nonce?: string
	accessTokenHash?: string
}

export interface DeviceProofClaims {
	jti: string
	htm: string
	htu: string
	iat: number
	nonce?: string
	ath?: string
}

export function proofUri(url: string): string {
	const parsed = new URL(url)
	return `${parsed.origin}${parsed.pathname}`
}

export function epochSeconds(date: Date): number {
	return Math.floor(date.getTime() / MILLISECONDS_PER_SECOND)
}

export async function signBody(signer: Pick<JwsSigner, "signJws">, claims: object): Promise<string> {
	const header = { alg: JWS_ALGORITHM, typ: SIGNED_BODY_JWS_TYPE }
	return await signer.signJws(JSON.stringify(header), JSON.stringify(claims))
}

export async function createDeviceProof(
	signer: JwsSigner,
	publicKeyJwk: PublicKeyJwk,
	input: DeviceProofInput,
	now: () => Date = () => new Date(),
): Promise<string> {
	const header = { typ: DPOP_JWS_TYPE, alg: JWS_ALGORITHM, jwk: publicKeyJwk }
	const claims: DeviceProofClaims = {
		jti: await signer.randomIdentifier(),
		htm: input.method.toUpperCase(),
		htu: proofUri(input.url),
		iat: epochSeconds(now()),
	}
	if (input.nonce !== undefined) {
		claims.nonce = input.nonce
	}
	if (input.accessTokenHash !== undefined) {
		claims.ath = input.accessTokenHash
	}
	return signer.signJws(JSON.stringify(header), JSON.stringify(claims))
}
