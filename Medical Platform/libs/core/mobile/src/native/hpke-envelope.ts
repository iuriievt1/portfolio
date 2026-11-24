import type { MobileContract } from "@ansora/contracts"
import type { SealedCopy, ServerHpkeKey } from "./index"

export type HpkeEnvelope = MobileContract.components["schemas"]["HpkeEnvelope"]
export type EffectiveServerHpkeKey = NonNullable<
	MobileContract.components["schemas"]["EffectiveConfiguration"]["server_hpke_key"]
>

/** The one suite the contract admits; a sealed copy for another would be refused by the server. */
export const HPKE_SUITE: HpkeEnvelope["suite"] = "DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM"

/** The server key as the effective configuration carries it, in the shape the native module takes. */
export function serverHpkeKeyOf(effective: EffectiveServerHpkeKey): ServerHpkeKey {
	return { serverKeyVersion: effective.server_key_version, publicKey: effective.public_key }
}

/** The `encryption` part of the upload from a sealed copy ✓ `HpkeEnvelope`. */
export function hpkeEnvelopeOf(sealed: SealedCopy): HpkeEnvelope {
	if (sealed.suite !== HPKE_SUITE) {
		throw new Error(`The sealed copy uses the suite ${sealed.suite}, which the contract does not admit`)
	}
	return { enc: sealed.enc, suite: HPKE_SUITE, server_key_version: sealed.serverKeyVersion }
}
