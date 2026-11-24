import { BITS_PER_BYTE, BITS_PER_CHARACTER } from "./base64"

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
const BYTE_MASK = 0xff
const UUID_BYTES = 16
const VERSION_BYTE = 6
const VARIANT_BYTE = 8
const RANDOM_VERSION = 0x40
const RFC_4122_VARIANT = 0x80
const LOW_NIBBLE = 0x0f
const LOW_SIX_BITS = 0x3f
const HEX_RADIX = 16
const HEX_DIGITS = 2
const UUID_GROUPS = [4, 2, 2, 2, 6]

export function bytesOfBase64Url(text: string): number[] {
	const bytes: number[] = []
	let buffer = 0
	let bits = 0
	for (const character of text) {
		const value = BASE64URL_ALPHABET.indexOf(character)
		if (value < 0) {
			throw new Error("not a base64url text")
		}
		buffer = (buffer << BITS_PER_CHARACTER) | value
		bits += BITS_PER_CHARACTER
		if (bits >= BITS_PER_BYTE) {
			bits -= BITS_PER_BYTE
			bytes.push((buffer >> bits) & BYTE_MASK)
		}
	}
	return bytes
}

// RFC 9562 version 4
export function uuidOfRandomBytes(random: readonly number[]): string {
	if (random.length < UUID_BYTES) {
		throw new Error(`a UUID needs ${UUID_BYTES} random bytes`)
	}
	const bytes = random.slice(0, UUID_BYTES)
	bytes[VERSION_BYTE] = ((bytes[VERSION_BYTE] ?? 0) & LOW_NIBBLE) | RANDOM_VERSION
	bytes[VARIANT_BYTE] = ((bytes[VARIANT_BYTE] ?? 0) & LOW_SIX_BITS) | RFC_4122_VARIANT
	const hex = bytes.map((byte) => byte.toString(HEX_RADIX).padStart(HEX_DIGITS, "0"))
	let offset = 0
	return UUID_GROUPS.map((length) => {
		const group = hex.slice(offset, offset + length).join("")
		offset += length
		return group
	}).join("-")
}
