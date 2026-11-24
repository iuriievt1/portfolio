import { generateKeyPairSync } from "node:crypto"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { deserializePublicKey, HPKE_SUITE, seal, UnknownKeyVersionError } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import { EnvVariable } from "../../common/constants/env-variable.constants"
import type { EnvVariableService } from "../../common/services/env-variable.service"
import { HpkeKeyService } from "../hpke-key.service"
import { readStoredKeys } from "../utils/stored-keys"

function keyDirectory(versions: readonly string[]): string {
	const directory = mkdtempSync(join(tmpdir(), "hpke-keys-"))
	for (const version of versions) {
		const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
		writeFileSync(join(directory, `${version}.pem`), privateKey.export({ type: "pkcs8", format: "pem" }))
	}
	writeFileSync(join(directory, "README.txt"), "not a key")
	return directory
}

function envOf(directory: string, current: string): EnvVariableService {
	const values: Partial<Record<EnvVariable, string>> = {
		[EnvVariable.HPKE_KEYS_PATH]: directory,
		[EnvVariable.HPKE_CURRENT_KEY_VERSION]: current,
	}
	return {
		get: (variable: EnvVariable) => {
			const value = values[variable]
			if (value === undefined || value === "") {
				throw new Error(`Missing required environment variable ${variable}`)
			}
			return value
		},
		getOptional: (variable: EnvVariable) => values[variable],
	} as EnvVariableService
}

describe("server HPKE keys of the API process", () => {
	it("CAP-021-R21 loads every key file, serves the current version and opens an envelope for it", () => {
		const service = new HpkeKeyService(envOf(keyDirectory(["2026-09", "2026-10"]), "2026-10"))
		const served = service.serverHpkeKey()
		expect(served.server_key_version).toBe("2026-10")
		const file = Buffer.from("wound image")
		const sealed = seal(deserializePublicKey(Buffer.from(served.public_key, "base64url")), file)
		const envelope = { enc: sealed.enc.toString("base64url"), suite: HPKE_SUITE, server_key_version: "2026-10" }
		expect(service.openEnvelope(envelope, sealed.ciphertext)).toEqual(file)
	})

	it("reads only .pem files and names the version after the file", () => {
		expect(readStoredKeys(keyDirectory(["b", "a"])).map((key) => key.version)).toEqual(["a", "b"])
	})

	it("does not start when the current version has no key file", () => {
		expect(() => new HpkeKeyService(envOf(keyDirectory(["2026-09"]), "2026-10"))).toThrow(UnknownKeyVersionError)
	})

	it("does not start without the environment variables", () => {
		expect(() => new HpkeKeyService(envOf(keyDirectory([]), ""))).toThrow(/HPKE_CURRENT_KEY_VERSION/)
	})
})
