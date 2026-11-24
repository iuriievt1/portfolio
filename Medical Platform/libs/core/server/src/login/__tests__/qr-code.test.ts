import { describe, expect, it } from "vitest"
import {
	base32Decode,
	base32Encode,
	generateQrSigningKeyPem,
	newQrCodeIdentifier,
	parseQrCodeContent,
	QrCodeKeyRing,
	UnknownQrKeyVersionError,
} from "../qr-code"

const KEY_1 = generateQrSigningKeyPem()
const KEY_2 = generateQrSigningKeyPem()

describe("personal QR code", () => {
	it("CAP-005-R04 issues VULNA1.<key version>.<identifier>.<signature> in base32 and verifies it", () => {
		const ring = QrCodeKeyRing.fromPem([{ version: 1, pem: KEY_1 }], 1)
		const identifier = newQrCodeIdentifier()
		expect(identifier).toMatch(/^[A-Z2-7]{26}$/)
		const content = ring.issue(identifier)
		expect(content).toMatch(/^VULNA1\.1\.[A-Z2-7]{26}\.[A-Z2-7]{103}$/)
		const parsed = parseQrCodeContent(content)
		expect(parsed?.identifier).toBe(identifier)
		expect(parsed?.keyVersion).toBe(1)
		expect(parsed && ring.verify(parsed)).toBe(true)
	})

	it("CAP-005-S10 accepts every unrevoked key version and signs with the current one", () => {
		const old = QrCodeKeyRing.fromPem([{ version: 1, pem: KEY_1 }], 1).issue(newQrCodeIdentifier())
		const rotated = QrCodeKeyRing.fromPem(
			[
				{ version: 1, pem: KEY_1 },
				{ version: 2, pem: KEY_2 },
			],
			2,
		)
		expect(rotated.issue(newQrCodeIdentifier())).toMatch(/^VULNA1\.2\./)
		const parsedOld = parseQrCodeContent(old)
		expect(parsedOld && rotated.verify(parsedOld)).toBe(true)
	})

	it("CAP-005-S11 rejects a code signed by a revoked version and a tampered identifier", () => {
		const content = QrCodeKeyRing.fromPem([{ version: 1, pem: KEY_1 }], 1).issue(newQrCodeIdentifier())
		const withoutVersionOne = QrCodeKeyRing.fromPem([{ version: 2, pem: KEY_2 }], 2)
		const parsed = parseQrCodeContent(content)
		expect(parsed && withoutVersionOne.verify(parsed)).toBe(false)
		const tampered = parseQrCodeContent(
			content.replace(/\.([A-Z2-7])([A-Z2-7]{25})\./, (_all, first, rest) => `.${first === "A" ? "B" : "A"}${rest}.`),
		)
		expect(tampered && QrCodeKeyRing.fromPem([{ version: 1, pem: KEY_1 }], 1).verify(tampered)).toBe(false)
		expect(() => QrCodeKeyRing.fromPem([{ version: 1, pem: KEY_1 }], 3)).toThrow(UnknownQrKeyVersionError)
	})

	it("refuses content that is not a Vulna code", () => {
		expect(parseQrCodeContent("VULNA2.1.ABC.DEF")).toBeUndefined()
		expect(parseQrCodeContent("VULNA1.x.ABC.DEF")).toBeUndefined()
		expect(parseQrCodeContent("VULNA1.1.abc.DEF")).toBeUndefined()
		expect(parseQrCodeContent("VULNA1.1.ABC")).toBeUndefined()
	})

	it("round-trips base32 without padding", () => {
		const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255])
		expect(base32Decode(base32Encode(bytes))).toEqual(bytes)
		expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI")
		expect(base32Decode("mzxw6")).toBeUndefined()
	})
})
