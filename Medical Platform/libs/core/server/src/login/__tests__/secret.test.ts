import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { randomSecret, secondsAfter, sha256Base64url, sha256Hex } from "../secret"

const NOW = new Date("2026-09-30T10:00:00.000Z")

describe("secret", () => {
	it("draws a fresh secret each time", () => {
		expect(randomSecret()).not.toBe(randomSecret())
	})

	it("hashes with SHA-256", () => {
		expect(sha256Hex("value")).toBe(createHash("sha256").update("value").digest("hex"))
		expect(sha256Base64url("value")).toBe(createHash("sha256").update("value").digest("base64url"))
	})

	it("adds seconds to a moment", () => {
		expect(secondsAfter(NOW, 90).toISOString()).toBe("2026-09-30T10:01:30.000Z")
	})
})
