import { generateKeyPairSync } from "node:crypto"
import { describe, expect, it } from "vitest"
import { deserializePublicKey, HpkeError, seal } from "../hpke"
import { HpkeKeyRing, UnknownKeyVersionError, UnsupportedSuiteError } from "../key-ring"
import { HPKE_SUITE } from "../suite"

function pem(type: "ec" | "ed25519" = "ec"): string {
	const pair = type === "ec" ? generateKeyPairSync("ec", { namedCurve: "prime256v1" }) : generateKeyPairSync("ed25519")
	return pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString()
}

const stored = [
	{ version: "2026-09", pem: pem() },
	{ version: "2026-10", pem: pem() },
]

function sealFor(version: string, plaintext: Buffer) {
	const publicKey = Buffer.from(HpkeKeyRing.fromPem(stored, version).serverHpkeKey().public_key, "base64url")
	const sealed = seal(deserializePublicKey(publicKey), plaintext)
	return { envelope: { enc: sealed.enc.toString("base64url"), suite: HPKE_SUITE, server_key_version: version }, sealed }
}

describe("server key ring for the HPKE envelope", () => {
	it("CAP-021-R21 serves the current public key and opens envelopes sealed for the previous version", () => {
		const ring = HpkeKeyRing.fromPem(stored, "2026-10")
		expect(ring.serverHpkeKey().server_key_version).toBe("2026-10")
		expect(ring.versions).toEqual(["2026-09", "2026-10"])
		const file = Buffer.from("image sealed before the rotation")
		const { envelope, sealed } = sealFor("2026-09", file)
		expect(ring.openEnvelope(envelope, sealed.ciphertext)).toEqual(file)
	})

	it("refuses an envelope for a version the server does not hold", () => {
		const ring = HpkeKeyRing.fromPem(stored, "2026-10")
		const { envelope, sealed } = sealFor("2026-10", Buffer.from("x"))
		expect(() => ring.openEnvelope({ ...envelope, server_key_version: "2027-01" }, sealed.ciphertext)).toThrow(
			UnknownKeyVersionError,
		)
	})

	it("refuses another cipher suite", () => {
		const ring = HpkeKeyRing.fromPem(stored, "2026-10")
		const { envelope, sealed } = sealFor("2026-10", Buffer.from("x"))
		const other = {
			...envelope,
			suite: "DHKEM(X25519, HKDF-SHA256), HKDF-SHA256, ChaCha20Poly1305" as typeof HPKE_SUITE,
		}
		expect(() => ring.openEnvelope(other, sealed.ciphertext)).toThrow(UnsupportedSuiteError)
	})

	it("does not start without the current version, with a version stored twice or with a bad name", () => {
		expect(() => HpkeKeyRing.fromPem(stored, "2026-11")).toThrow(UnknownKeyVersionError)
		expect(() => HpkeKeyRing.fromPem([...stored, { version: "2026-10", pem: pem() }], "2026-10")).toThrow(HpkeError)
		expect(() => HpkeKeyRing.fromPem([{ version: "2026/10", pem: pem() }], "2026/10")).toThrow(HpkeError)
	})

	it("accepts only P-256 private keys", () => {
		expect(() => HpkeKeyRing.fromPem([{ version: "v1", pem: pem("ed25519") }], "v1")).toThrow(HpkeError)
	})
})
