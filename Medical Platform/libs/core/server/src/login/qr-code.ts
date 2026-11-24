import {
	createPrivateKey,
	createPublicKey,
	generateKeyPairSync,
	type KeyObject,
	randomBytes,
	sign,
	verify,
} from "node:crypto"

const QR_CODE_FORMAT = "VULNA1"

const QR_CODE_PARTS = 4
const SEPARATOR = "."
const IDENTIFIER_BYTES = 16
const KEY_VERSION_PATTERN = /^(0|[1-9]\d*)$/
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const BASE32_PATTERN = /^[A-Z2-7]+$/
const BITS_PER_CHARACTER = 5
const BITS_PER_BYTE = 8
const BYTE_MASK = 0xff
const CHARACTER_MASK = 0x1f
const ED25519 = "ed25519"

export interface ParsedQrCode {
	keyVersion: number
	identifier: string
	signingInput: string
	signature: Buffer
}

export interface StoredQrSigningKey {
	version: number
	pem: string
}

export function parseQrCodeContent(content: string): ParsedQrCode | undefined {
	const parts = content.split(SEPARATOR)
	if (parts.length !== QR_CODE_PARTS) {
		return undefined
	}
	const [format, version, identifier, signature] = parts as [string, string, string, string]
	if (format !== QR_CODE_FORMAT || !isQrKeyVersion(version) || !BASE32_PATTERN.test(identifier)) {
		return undefined
	}
	const decodedSignature = base32Decode(signature)
	if (decodedSignature === undefined) {
		return undefined
	}
	return {
		keyVersion: Number(version),
		identifier,
		signingInput: [format, version, identifier].join(SEPARATOR),
		signature: decodedSignature,
	}
}

export function isQrKeyVersion(text: string): boolean {
	return KEY_VERSION_PATTERN.test(text)
}

function verifyQrCodeSignature(code: ParsedQrCode, publicKey: KeyObject): boolean {
	try {
		return verify(null, Buffer.from(code.signingInput), publicKey, code.signature)
	} catch {
		return false
	}
}

export function newQrCodeIdentifier(): string {
	return base32Encode(randomBytes(IDENTIFIER_BYTES))
}

function signQrCode(keyVersion: number, identifier: string, privateKey: KeyObject): string {
	const signingInput = [QR_CODE_FORMAT, String(keyVersion), identifier].join(SEPARATOR)
	const signature = sign(null, Buffer.from(signingInput), privateKey)
	return [signingInput, base32Encode(signature)].join(SEPARATOR)
}

export class UnknownQrKeyVersionError extends Error {
	constructor(version: number) {
		super(`QR signing key version ${version} is not known`)
	}
}

export class QrCodeKeyRing {
	private constructor(
		private readonly keys: ReadonlyMap<number, KeyObject>,
		readonly currentVersion: number,
	) {}

	static fromPem(stored: readonly StoredQrSigningKey[], currentVersion: number): QrCodeKeyRing {
		const keys = new Map<number, KeyObject>()
		for (const key of stored) {
			const privateKey = createPrivateKey(key.pem)
			if (privateKey.asymmetricKeyType !== ED25519) {
				throw new Error(`QR signing key version ${key.version} is not Ed25519`)
			}
			keys.set(key.version, privateKey)
		}
		if (!keys.has(currentVersion)) {
			throw new UnknownQrKeyVersionError(currentVersion)
		}
		return new QrCodeKeyRing(keys, currentVersion)
	}

	get versions(): number[] {
		return [...this.keys.keys()].sort((first, second) => first - second)
	}

	issue(identifier: string): string {
		return signQrCode(this.currentVersion, identifier, this.privateKey(this.currentVersion))
	}

	verify(code: ParsedQrCode): boolean {
		const privateKey = this.keys.get(code.keyVersion)
		return privateKey !== undefined && verifyQrCodeSignature(code, createPublicKey(privateKey))
	}

	private privateKey(version: number): KeyObject {
		const key = this.keys.get(version)
		if (key === undefined) {
			throw new UnknownQrKeyVersionError(version)
		}
		return key
	}
}

export function generateQrSigningKeyPem(): string {
	return generateKeyPairSync(ED25519).privateKey.export({ type: "pkcs8", format: "pem" }).toString()
}

export function base32Encode(bytes: Buffer): string {
	let output = ""
	let buffer = 0
	let bits = 0
	for (const byte of bytes) {
		buffer = (buffer << BITS_PER_BYTE) | byte
		bits += BITS_PER_BYTE
		while (bits >= BITS_PER_CHARACTER) {
			bits -= BITS_PER_CHARACTER
			output += BASE32_ALPHABET[(buffer >> bits) & CHARACTER_MASK]
		}
	}
	if (bits > 0) {
		output += BASE32_ALPHABET[(buffer << (BITS_PER_CHARACTER - bits)) & CHARACTER_MASK]
	}
	return output
}

export function base32Decode(text: string): Buffer | undefined {
	if (!BASE32_PATTERN.test(text)) {
		return undefined
	}
	const bytes: number[] = []
	let buffer = 0
	let bits = 0
	for (const character of text) {
		buffer = (buffer << BITS_PER_CHARACTER) | BASE32_ALPHABET.indexOf(character)
		bits += BITS_PER_CHARACTER
		if (bits >= BITS_PER_BYTE) {
			bits -= BITS_PER_BYTE
			bytes.push((buffer >> bits) & BYTE_MASK)
		}
	}
	return Buffer.from(bytes)
}
