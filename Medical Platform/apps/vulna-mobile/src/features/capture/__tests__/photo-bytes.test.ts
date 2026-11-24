import { describe, expect, it } from "vitest"
import { copiedBytesOf } from "../photo-bytes"

describe("copiedBytesOf CAP-015-R14", () => {
	it("keeps the photo after the camera reuses its buffer", () => {
		const cameraBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe1])

		const kept = copiedBytesOf(cameraBuffer.buffer)
		cameraBuffer.fill(0)

		expect([...kept]).toEqual([0xff, 0xd8, 0xff, 0xe1])
		expect(kept.buffer).not.toBe(cameraBuffer.buffer)
	})
})
