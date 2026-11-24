import { describe, expect, it } from "vitest"
import { HPKE_SUITE, hpkeEnvelopeOf, serverHpkeKeyOf } from "../hpke-envelope"

const ENC = "BMMtTeYQlRuZNt5lEvK-7hLpeh5x92uK38XslN84JJs8x95rrBkeP6VkNndDYvZycljH_JqhxA2Gt8hT6oaKHsM"

describe("HPKE envelope of the background upload", () => {
	it("CAP-021-R21 builds the encryption part from a sealed copy", () => {
		expect(
			hpkeEnvelopeOf({ path: "/vault/queue/x", enc: ENC, suite: HPKE_SUITE, serverKeyVersion: "2026-10", sha256: "" }),
		).toEqual({ enc: ENC, suite: HPKE_SUITE, server_key_version: "2026-10" })
	})

	it("refuses a sealed copy of another suite", () => {
		expect(() =>
			hpkeEnvelopeOf({
				path: "",
				enc: ENC,
				suite: "DHKEM(X25519, HKDF-SHA256), HKDF-SHA256, AES-256-GCM",
				serverKeyVersion: "v",
				sha256: "",
			}),
		).toThrow(/suite/)
	})

	it("takes the server key from the effective configuration as the native module needs it", () => {
		expect(serverHpkeKeyOf({ server_key_version: "2026-10", public_key: ENC })).toEqual({
			serverKeyVersion: "2026-10",
			publicKey: ENC,
		})
	})
})
