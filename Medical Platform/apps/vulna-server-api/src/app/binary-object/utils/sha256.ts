import { createHash } from "node:crypto"
import { HEX, SHA_256 } from "../constants/binary-object.constants"

// datovy-model.md 4 Binární objekt, ADR-015
export function sha256HexOf(bytes: Buffer): string {
	return createHash(SHA_256).update(bytes).digest(HEX)
}
