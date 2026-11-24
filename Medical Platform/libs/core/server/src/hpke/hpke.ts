import {
	createCipheriv,
	createDecipheriv,
	createHmac,
	createPrivateKey,
	createPublicKey,
	diffieHellman,
	generateKeyPairSync,
	type KeyObject,
} from "node:crypto"

/**
 * HPKE (RFC 9180) for one suite: DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM, base mode.
 *
 * The server only opens envelopes the device sealed for its static key ✓ CAP-021-R21; sealing is
 * here so the tests can round-trip and the conformance vectors of the RFC can be checked. Built
 * on `node:crypto` alone — a library would be one more component in the SBOM ✓ NAB-471.
 */
/** Identifiers and sizes of the suite as RFC 9180 sections 7.1 to 7.3 register them. */
const KEM_ID = 0x00_10
const KDF_ID = 0x00_01
const AEAD_ID = 0x00_02
const SHARED_SECRET_BYTES = 32
const PUBLIC_KEY_BYTES = 65
const AEAD_KEY_BYTES = 32
const NONCE_BYTES = 12
const TAG_BYTES = 16
const HASH_BYTES = 32
const COORDINATE_BYTES = 32
const UNCOMPRESSED_POINT_PREFIX = 0x04
/** Base mode: no pre-shared key and no sender authentication ✓ `HpkeEnvelope` (jednorázové šifrování). */
const MODE_BASE = 0x00
const CURVE = "prime256v1"
const HASH = "sha256"
const CIPHER = "aes-256-gcm"
const UINT16_BYTES = 2
const HKDF_COUNTER_BYTES = 1
const EMPTY = Buffer.alloc(0)
const VERSION_LABEL = Buffer.from("HPKE-v1")
const KEM_SUITE_ID = Buffer.concat([Buffer.from("KEM"), identifier(KEM_ID)])
const HPKE_SUITE_ID = Buffer.concat([Buffer.from("HPKE"), identifier(KEM_ID), identifier(KDF_ID), identifier(AEAD_ID)])

export interface SealedMessage {
	enc: Buffer
	ciphertext: Buffer
}

export class HpkeError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "HpkeError"
	}
}

export function generateKeyPair(): KeyObject {
	return generateKeyPairSync("ec", { namedCurve: CURVE }).privateKey
}

export function privateKeyFromPem(pem: string): KeyObject {
	const key = createPrivateKey(pem)
	if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== CURVE) {
		throw new HpkeError("The private key is not a P-256 key")
	}
	return key
}

/** `SerializePublicKey`: the uncompressed point of SEC 1, 0x04 followed by X and Y ✓ RFC 9180 7.1.1. */
export function serializePublicKey(key: KeyObject): Buffer {
	const jwk = (key.type === "public" ? key : createPublicKey(key)).export({ format: "jwk" })
	if (typeof jwk.x !== "string" || typeof jwk.y !== "string") {
		throw new HpkeError("The key has no P-256 coordinates")
	}
	return Buffer.concat([
		Buffer.from([UNCOMPRESSED_POINT_PREFIX]),
		Buffer.from(jwk.x, "base64url"),
		Buffer.from(jwk.y, "base64url"),
	])
}

/** `DeserializePublicKey`: OpenSSL refuses a point that is not on the curve. */
export function deserializePublicKey(point: Buffer): KeyObject {
	if (point.length !== PUBLIC_KEY_BYTES || point[0] !== UNCOMPRESSED_POINT_PREFIX) {
		throw new HpkeError("The public key is not an uncompressed P-256 point")
	}
	const x = point.subarray(1, 1 + COORDINATE_BYTES).toString("base64url")
	const y = point.subarray(1 + COORDINATE_BYTES).toString("base64url")
	try {
		return createPublicKey({ key: { kty: "EC", crv: "P-256", x, y }, format: "jwk" })
	} catch {
		throw new HpkeError("The public key is not a point on P-256")
	}
}

/** `Encap` with the ephemeral key passed in, so a conformance vector can drive it. */
export function encapsulate(
	recipientPublicKey: KeyObject,
	ephemeralPrivateKey: KeyObject = generateKeyPair(),
): {
	sharedSecret: Buffer
	enc: Buffer
} {
	const dh = diffieHellman({ privateKey: ephemeralPrivateKey, publicKey: recipientPublicKey })
	const enc = serializePublicKey(ephemeralPrivateKey)
	const kemContext = Buffer.concat([enc, serializePublicKey(recipientPublicKey)])
	return { sharedSecret: extractAndExpand(dh, kemContext), enc }
}

/** `Decap` ✓ RFC 9180 4.1. */
export function decapsulate(enc: Buffer, recipientPrivateKey: KeyObject): Buffer {
	const dh = diffieHellman({ privateKey: recipientPrivateKey, publicKey: deserializePublicKey(enc) })
	const kemContext = Buffer.concat([enc, serializePublicKey(recipientPrivateKey)])
	return extractAndExpand(dh, kemContext)
}

/** `KeySchedule` for the base mode ✓ RFC 9180 5.1. */
export function keySchedule(sharedSecret: Buffer, info: Buffer): { key: Buffer; baseNonce: Buffer } {
	const pskIdHash = labeledExtract(HPKE_SUITE_ID, EMPTY, "psk_id_hash", EMPTY)
	const infoHash = labeledExtract(HPKE_SUITE_ID, EMPTY, "info_hash", info)
	const context = Buffer.concat([Buffer.from([MODE_BASE]), pskIdHash, infoHash])
	const secret = labeledExtract(HPKE_SUITE_ID, sharedSecret, "secret", EMPTY)
	return {
		key: labeledExpand(HPKE_SUITE_ID, secret, "key", context, AEAD_KEY_BYTES),
		baseNonce: labeledExpand(HPKE_SUITE_ID, secret, "base_nonce", context, NONCE_BYTES),
	}
}

/** Single-shot `Seal` ✓ RFC 9180 6.1; the first message uses the base nonce as is. */
export function seal(
	recipientPublicKey: KeyObject,
	plaintext: Buffer,
	info: Buffer = EMPTY,
	aad: Buffer = EMPTY,
	ephemeralPrivateKey?: KeyObject,
): SealedMessage {
	const { sharedSecret, enc } = encapsulate(recipientPublicKey, ephemeralPrivateKey)
	const { key, baseNonce } = keySchedule(sharedSecret, info)
	const cipher = createCipheriv(CIPHER, key, baseNonce, { authTagLength: TAG_BYTES })
	cipher.setAAD(aad)
	const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()])
	return { enc, ciphertext }
}

/** Single-shot `Open` ✓ RFC 9180 6.1; the derived key lives only in this call ✓ CAP-021-R21. */
export function open(
	recipientPrivateKey: KeyObject,
	enc: Buffer,
	ciphertext: Buffer,
	info: Buffer = EMPTY,
	aad: Buffer = EMPTY,
): Buffer {
	if (ciphertext.length < TAG_BYTES) {
		throw new HpkeError("The ciphertext is shorter than its authentication tag")
	}
	const { key, baseNonce } = keySchedule(decapsulate(enc, recipientPrivateKey), info)
	const decipher = createDecipheriv(CIPHER, key, baseNonce, { authTagLength: TAG_BYTES })
	decipher.setAAD(aad)
	decipher.setAuthTag(ciphertext.subarray(ciphertext.length - TAG_BYTES))
	try {
		return Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - TAG_BYTES)), decipher.final()])
	} catch {
		throw new HpkeError("The envelope does not open with this key")
	}
}

function extractAndExpand(dh: Buffer, kemContext: Buffer): Buffer {
	const eaePrk = labeledExtract(KEM_SUITE_ID, EMPTY, "eae_prk", dh)
	return labeledExpand(KEM_SUITE_ID, eaePrk, "shared_secret", kemContext, SHARED_SECRET_BYTES)
}

/** `LabeledExtract` ✓ RFC 9180 4; HKDF-Extract is HMAC with the salt as key. */
function labeledExtract(suiteId: Buffer, salt: Buffer, label: string, ikm: Buffer): Buffer {
	return createHmac(HASH, salt)
		.update(Buffer.concat([VERSION_LABEL, suiteId, Buffer.from(label), ikm]))
		.digest()
}

/** `LabeledExpand` ✓ RFC 9180 4 over HKDF-Expand of RFC 5869. */
function labeledExpand(suiteId: Buffer, prk: Buffer, label: string, info: Buffer, length: number): Buffer {
	const lengthPrefix = Buffer.alloc(UINT16_BYTES)
	lengthPrefix.writeUInt16BE(length)
	const labeledInfo = Buffer.concat([lengthPrefix, VERSION_LABEL, suiteId, Buffer.from(label), info])
	const blocks: Buffer[] = []
	let previous = EMPTY
	for (let counter = 1; blocks.length * HASH_BYTES < length; counter++) {
		const block = Buffer.alloc(HKDF_COUNTER_BYTES, counter)
		previous = createHmac(HASH, prk)
			.update(Buffer.concat([previous, labeledInfo, block]))
			.digest()
		blocks.push(previous)
	}
	return Buffer.concat(blocks).subarray(0, length)
}

function identifier(value: number): Buffer {
	const bytes = Buffer.alloc(UINT16_BYTES)
	bytes.writeUInt16BE(value)
	return bytes
}
