import { describe, expect, it } from "vitest"
import { base64Of } from "../base64"

describe("base64", () => {
	it("encodes the RFC 4648 test vectors", () => {
		const vectors = ["", "f", "fo", "foo", "foob", "fooba", "foobar"]
		expect(vectors.map((text) => base64Of(new TextEncoder().encode(text)))).toEqual([
			"",
			"Zg==",
			"Zm8=",
			"Zm9v",
			"Zm9vYg==",
			"Zm9vYmE=",
			"Zm9vYmFy",
		])
	})

	it("encodes a multi-chunk image the same as the platform", () => {
		const bytes = Uint8Array.from({ length: 200_000 }, (_, index) => (index * 31) % 256)
		expect(base64Of(bytes)).toBe(Buffer.from(bytes).toString("base64"))
	})

	it("encodes every byte value as the platform does", () => {
		const bytes = Uint8Array.from({ length: 256 }, (_, index) => index)
		expect(base64Of(bytes)).toBe(Buffer.from(bytes).toString("base64"))
	})
})
