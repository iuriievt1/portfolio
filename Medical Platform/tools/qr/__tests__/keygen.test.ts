import { mkdtempSync, readFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { newQrCodeIdentifier, parseQrCodeContent, QrCodeKeyRing } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import { writeSigningKey } from "../keygen"

const OWNER_ONLY = 0o600

describe("QR signing key generation", () => {
	it("CAP-005-R14 writes an Ed25519 key the API process loads under its version", () => {
		const directory = mkdtempSync(join(tmpdir(), "qr-keygen-"))
		const path = writeSigningKey(directory, "1")
		expect(statSync(path).mode & 0o777).toBe(OWNER_ONLY)
		const ring = QrCodeKeyRing.fromPem([{ version: 1, pem: readFileSync(path, "utf8") }], 1)
		const parsed = parseQrCodeContent(ring.issue(newQrCodeIdentifier()))
		expect(parsed && ring.verify(parsed)).toBe(true)
		expect(() => writeSigningKey(directory, "1")).toThrow(/EEXIST/)
		expect(() => writeSigningKey(directory, "v2")).toThrow(/whole number/)
	})
})
