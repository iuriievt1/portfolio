import { describe, expect, it } from "vitest"
import { bytesOfBase64Url, uuidOfRandomBytes } from "../uuid"

describe("UUID from the random identifier of the platform", () => {
	it("decodes the 16 random bytes the native module returns", () => {
		expect(bytesOfBase64Url("AAECAwQFBgcICQoLDA0ODw")).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
		expect(bytesOfBase64Url("_-8")).toEqual([255, 239])
	})

	it("refuses a text outside base64url", () => {
		expect(() => bytesOfBase64Url("a+b=")).toThrow()
	})

	it("marks the bytes as a random UUID of version 4", () => {
		expect(uuidOfRandomBytes(Array.from({ length: 16 }, () => 255))).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff")
		expect(uuidOfRandomBytes(Array.from({ length: 16 }, () => 0))).toBe("00000000-0000-4000-8000-000000000000")
	})

	it("needs sixteen bytes", () => {
		expect(() => uuidOfRandomBytes([1, 2, 3])).toThrow()
	})
})
