import { createHash, generateKeyPairSync, type KeyObject, randomUUID, sign } from "node:crypto"
import { DEVICE_PROOF_TYPE, hardwareId, JWS_ALGORITHM, type PublicKeyJwk } from "@ansora/core-server"

// RFC 7515, RFC 7518 3.4, RFC 9449, ADR-013
const CURVE = "P-256"
const SIGNATURE_ENCODING = "ieee-p1363"
const SHA256 = "sha256"
const BASE64URL = "base64url"
const MILLISECONDS_PER_SECOND = 1000

interface DeviceProofInput {
	method: string
	url: string
	nonce: string | undefined
	sessionToken: string | undefined
}

function base64urlOf(text: string): string {
	return Buffer.from(text).toString(BASE64URL)
}

// RFC 9449 4.2
function proofUriOf(url: string): string {
	const parsed = new URL(url)
	return `${parsed.origin}${parsed.pathname}`
}

// RFC 9449 4.2
function accessTokenHashOf(token: string): string {
	return createHash(SHA256).update(token).digest(BASE64URL)
}

// ADR-013, Q-082
export class DeviceKey {
	readonly publicKeyJwk: PublicKeyJwk
	readonly hardwareId: string
	private readonly privateKey: KeyObject

	constructor() {
		const pair = generateKeyPairSync("ec", { namedCurve: CURVE })
		const { kty, crv, x, y } = pair.publicKey.export({ format: "jwk" })
		this.publicKeyJwk = { kty, crv, x, y } as PublicKeyJwk
		this.privateKey = pair.privateKey
		this.hardwareId = hardwareId(this.publicKeyJwk)
	}

	// RFC 9449 4.2
	proof(input: DeviceProofInput): string {
		const header = { typ: DEVICE_PROOF_TYPE, alg: JWS_ALGORITHM, jwk: this.publicKeyJwk }
		const claims = {
			jti: randomUUID(),
			htm: input.method.toUpperCase(),
			htu: proofUriOf(input.url),
			iat: Math.floor(Date.now() / MILLISECONDS_PER_SECOND),
			...(input.nonce === undefined ? {} : { nonce: input.nonce }),
			...(input.sessionToken === undefined ? {} : { ath: accessTokenHashOf(input.sessionToken) }),
		}
		const signingInput = `${base64urlOf(JSON.stringify(header))}.${base64urlOf(JSON.stringify(claims))}`
		const signature = sign(SHA256, Buffer.from(signingInput), { key: this.privateKey, dsaEncoding: SIGNATURE_ENCODING })
		return `${signingInput}.${signature.toString(BASE64URL)}`
	}
}
