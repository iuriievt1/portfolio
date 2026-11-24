import { createPublicKey, generateKeyPairSync } from "node:crypto"
import { describe, expect, it } from "vitest"
import { approvalFingerprint, type PublicKeyJwk } from "../public-key"

const UNCOMPRESSED_POINT_PREFIX = 0x04
const COORDINATE_BYTES = 32
const SPKI_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex")

function deviceKey(): PublicKeyJwk {
	const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
	const exported = publicKey.export({ format: "jwk" })
	return { kty: "EC", crv: "P-256", x: exported.x as string, y: exported.y as string }
}

function pointOf(jwk: PublicKeyJwk): Buffer {
	return Buffer.concat([
		Buffer.of(UNCOMPRESSED_POINT_PREFIX),
		Buffer.from(jwk.x, "base64url"),
		Buffer.from(jwk.y, "base64url"),
	])
}

describe("approvalFingerprint", () => {
	it("CAP-006-S08 reads the same key bytes the device builds from its public point", () => {
		const jwk = deviceKey()

		const fromNode = createPublicKey({ key: { ...jwk }, format: "jwk" }).export({ type: "spki", format: "der" })
		const fromDevice = Buffer.concat([SPKI_PREFIX, pointOf(jwk)])

		expect(Buffer.from(fromNode).equals(fromDevice)).toBe(true)
		expect(pointOf(jwk)).toHaveLength(1 + 2 * COORDINATE_BYTES)
	})

	it("CAP-006-S09 gives a different fingerprint to a different device", () => {
		expect(approvalFingerprint(deviceKey())).not.toBe(approvalFingerprint(deviceKey()))
	})
})
