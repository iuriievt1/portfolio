import { createHash } from "node:crypto"

const UUID_BYTES = 16
const VERSION_BYTE = 6
const VARIANT_BYTE = 8
const NAME_BASED_SHA1 = 0x50
const RFC_9562_VARIANT = 0x80
const LOW_NIBBLE = 0x0f
const LOW_SIX_BITS = 0x3f
const UUID_GROUPS = [8, 4, 4, 4, 12]

function bytesOf(uuid: string): Buffer {
	return Buffer.from(uuid.replaceAll("-", ""), "hex")
}

function formatted(bytes: Buffer): string {
	const hex = bytes.toString("hex")
	let offset = 0
	return UUID_GROUPS.map((length) => {
		const group = hex.slice(offset, offset + length)
		offset += length
		return group
	}).join("-")
}

// RFC 9562 version 5
export function nameBasedUuid(namespace: string, name: string): string {
	const hash = createHash("sha1")
		.update(Buffer.concat([bytesOf(namespace), Buffer.from(name, "utf8")]))
		.digest()
		.subarray(0, UUID_BYTES)
	hash[VERSION_BYTE] = ((hash[VERSION_BYTE] ?? 0) & LOW_NIBBLE) | NAME_BASED_SHA1
	hash[VARIANT_BYTE] = ((hash[VARIANT_BYTE] ?? 0) & LOW_SIX_BITS) | RFC_9562_VARIANT
	return formatted(hash)
}
