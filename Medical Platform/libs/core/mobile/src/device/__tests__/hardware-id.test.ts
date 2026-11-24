import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { hardwareIdOf } from "../hardware-id"

const PUBLIC_KEY_JWK = {
	kty: "EC",
	crv: "P-256",
	x: "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
	y: "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0",
} as const

// libs/core/server/src/device/public-key.ts hardwareId of the same key
const SERVER_HW_ID = "oKIywvGUpTVTyxMQ3bwIIeQUudfr_CkLMjCE19ECD-U"

describe("HW ID of the device key", () => {
	it("CAP-006-R19 is the SHA-256 of the canonical public key the server derives it from", async () => {
		const keys = {
			deviceKey: async () => ({ publicKeyJwk: { ...PUBLIC_KEY_JWK }, secureHardware: "strongbox" as const }),
			sha256Text: async (text: string) => createHash("sha256").update(text).digest("base64url"),
		}

		expect(await hardwareIdOf(keys)).toBe(SERVER_HW_ID)
	})
})
