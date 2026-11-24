import { mkdtempSync, readFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { HpkeKeyRing } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import { writeServerKey } from "../keygen"

const OWNER_ONLY = 0o600

describe("server HPKE key generation", () => {
	it("CAP-021-R21 writes a P-256 key the API process loads and prints the public key devices pin", () => {
		const directory = mkdtempSync(join(tmpdir(), "hpke-keygen-"))
		const written = writeServerKey(directory, "2026-10")
		expect(statSync(written.path).mode & 0o777).toBe(OWNER_ONLY)
		const ring = HpkeKeyRing.fromPem([{ version: "2026-10", pem: readFileSync(written.path, "utf8") }], "2026-10")
		expect(ring.serverHpkeKey()).toEqual({ server_key_version: "2026-10", public_key: written.publicKey })
		expect(() => writeServerKey(directory, "2026-10")).toThrow(/EEXIST/)
		expect(() => writeServerKey(directory, "2026/10")).toThrow(/version/)
	})
})
