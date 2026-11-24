import { createPrivateKey, randomBytes } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
	decapsulate,
	deserializePublicKey,
	encapsulate,
	generateKeyPair,
	HpkeError,
	keySchedule,
	open,
	seal,
	serializePublicKey,
} from "../hpke"

// Test vector of the CFRG for DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-256-GCM in base mode
// (https://github.com/cfrg/draft-irtf-cfrg-hpke, test-vectors.json; mode 0, kem 0x0010, kdf 0x0001, aead 0x0002).
const VECTOR = {
	info: "4f6465206f6e2061204772656369616e2055726e",
	pkRm: "04abc7e49a4c6b3566d77d0304addc6ed0e98512ffccf505e6a8e3eb25c685136f853148544876de76c0f2ef99cdc3a05ccf5ded7860c7c021238f9e2073d2356c",
	skRm: "317f915db7bc629c48fe765587897e01e282d3e8445f79f27f65d031a88082b2",
	pkEm: "04c06b4f6bebc7bb495cb797ab753f911aff80aefb86fd8b6fcc35525f3ab5f03e0b21bd31a86c6048af3cb2d98e0d3bf01da5cc4c39ff5370d331a4f1f7d5a4e0",
	skEm: "90345e3a1d116c1dd39ae76d95ab858c142223a63e44f8f85318cfa91a84858e",
	enc: "04c06b4f6bebc7bb495cb797ab753f911aff80aefb86fd8b6fcc35525f3ab5f03e0b21bd31a86c6048af3cb2d98e0d3bf01da5cc4c39ff5370d331a4f1f7d5a4e0",
	sharedSecret: "48893fecd82f7c3456af6a42d8f56325d21e08c10fa81299986aaff54cde7b49",
	key: "ee16802a936d5f544771131900ee6973d0551de9e852ece2ef34bf0d5f9e1d1d",
	baseNonce: "9bc50980832a7b4b58c40161",
	aad: "436f756e742d30",
	ciphertext: "58c61a45059d0c5704560e9d88b564a8b63f1364b8d1fcb3c4c6ddc1d291742465e902cd216f8908da49f8f96f",
	plaintext: "4265617574792069732074727574682c20747275746820626561757479",
}

const COORDINATE_BYTES = 32
const ONE_MEGABYTE = 1_048_576

function hex(value: string): Buffer {
	return Buffer.from(value, "hex")
}

function privateKeyOf(scalarHex: string, pointHex: string) {
	const point = hex(pointHex)
	return createPrivateKey({
		key: {
			kty: "EC",
			crv: "P-256",
			d: hex(scalarHex).toString("base64url"),
			x: point.subarray(1, 1 + COORDINATE_BYTES).toString("base64url"),
			y: point.subarray(1 + COORDINATE_BYTES).toString("base64url"),
		},
		format: "jwk",
	})
}

const recipient = privateKeyOf(VECTOR.skRm, VECTOR.pkRm)
const ephemeral = privateKeyOf(VECTOR.skEm, VECTOR.pkEm)

describe("HPKE of RFC 9180 for the file envelope", () => {
	it("CAP-021-R21 decapsulates the shared secret of the CFRG vector", () => {
		expect(decapsulate(hex(VECTOR.enc), recipient)).toEqual(hex(VECTOR.sharedSecret))
	})

	it("encapsulates the enc and shared secret of the CFRG vector with its ephemeral key", () => {
		const { enc, sharedSecret } = encapsulate(deserializePublicKey(hex(VECTOR.pkRm)), ephemeral)
		expect(enc).toEqual(hex(VECTOR.enc))
		expect(sharedSecret).toEqual(hex(VECTOR.sharedSecret))
	})

	it("derives the key and base nonce of the CFRG vector", () => {
		const { key, baseNonce } = keySchedule(hex(VECTOR.sharedSecret), hex(VECTOR.info))
		expect(key).toEqual(hex(VECTOR.key))
		expect(baseNonce).toEqual(hex(VECTOR.baseNonce))
	})

	it("CAP-021-R21 opens the first ciphertext of the CFRG vector", () => {
		const plaintext = open(recipient, hex(VECTOR.enc), hex(VECTOR.ciphertext), hex(VECTOR.info), hex(VECTOR.aad))
		expect(plaintext).toEqual(hex(VECTOR.plaintext))
	})

	it("seals with the vector's ephemeral key to the vector's ciphertext", () => {
		const sealed = seal(
			deserializePublicKey(hex(VECTOR.pkRm)),
			hex(VECTOR.plaintext),
			hex(VECTOR.info),
			hex(VECTOR.aad),
			ephemeral,
		)
		expect(sealed.enc).toEqual(hex(VECTOR.enc))
		expect(sealed.ciphertext).toEqual(hex(VECTOR.ciphertext))
	})

	it("round-trips a file with a fresh ephemeral key, empty info and empty aad", () => {
		const serverKey = generateKeyPair()
		const file = randomBytes(ONE_MEGABYTE)
		const sealed = seal(deserializePublicKey(serializePublicKey(serverKey)), file)
		expect(open(serverKey, sealed.enc, sealed.ciphertext).equals(file)).toBe(true)
	})

	it("refuses a ciphertext that was tampered with or opened with another key", () => {
		const serverKey = generateKeyPair()
		const sealed = seal(deserializePublicKey(serializePublicKey(serverKey)), Buffer.from("wound image"))
		const tampered = Buffer.from(sealed.ciphertext)
		tampered[0] = (tampered[0] as number) ^ 0x01
		expect(() => open(serverKey, sealed.enc, tampered)).toThrow(HpkeError)
		expect(() => open(generateKeyPair(), sealed.enc, sealed.ciphertext)).toThrow(HpkeError)
		expect(() => open(serverKey, sealed.enc, sealed.ciphertext.subarray(0, 8))).toThrow(HpkeError)
	})

	it("refuses an encapsulated key that is not a point on P-256", () => {
		const offCurve = Buffer.from(hex(VECTOR.enc))
		offCurve[offCurve.length - 1] = (offCurve.at(-1) as number) ^ 0x01
		expect(() => deserializePublicKey(offCurve)).toThrow(HpkeError)
		expect(() => deserializePublicKey(hex(VECTOR.enc).subarray(1))).toThrow(HpkeError)
	})

	it("serializes the public key as the uncompressed point of the vector", () => {
		expect(serializePublicKey(recipient)).toEqual(hex(VECTOR.pkRm))
	})
})
