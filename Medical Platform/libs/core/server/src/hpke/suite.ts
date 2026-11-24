import type { MobileContract } from "@ansora/contracts"

export type HpkeEnvelope = MobileContract.components["schemas"]["HpkeEnvelope"]

/** The one cipher suite the contract admits; any other envelope is refused ✓ CAP-021-R21. */
export const HPKE_SUITE: HpkeEnvelope["suite"] = "DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM"
