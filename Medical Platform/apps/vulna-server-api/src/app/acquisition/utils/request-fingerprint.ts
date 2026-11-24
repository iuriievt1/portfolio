import { createHash } from "node:crypto"
import { canonicalJson, type JsonObject } from "@ansora/core-server"

const SHA_256 = "sha256"

// CAP-021-R29
export function requestFingerprintOf(body: JsonObject): Buffer {
	return createHash(SHA_256).update(canonicalJson(body)).digest()
}
