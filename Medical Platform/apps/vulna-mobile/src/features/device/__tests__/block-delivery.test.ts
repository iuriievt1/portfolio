import type { IntegrityBlock } from "@ansora/core-mobile"
import { describe, expect, it } from "vitest"
import { BLOCK_DELIVERY, deliveryOf } from "../block-delivery"

const BLOCK: IntegrityBlock = {
	detectedAt: "2026-10-29T08:00:00.000Z",
	signals: ["root"],
	registered: true,
}

describe("what the block screen says about the report to the server", () => {
	it("CAP-008-S03 promises the report while it can still leave", () => {
		expect(deliveryOf(BLOCK)).toBe(BLOCK_DELIVERY.AWAITING)
	})

	it("CAP-008-R04 says the server was told once the report arrived", () => {
		expect(deliveryOf({ ...BLOCK, reportedAt: "2026-10-29T08:01:00.000Z" })).toBe(BLOCK_DELIVERY.REPORTED)
	})

	it("CAP-025-S16 stops promising the report once it can no longer leave", () => {
		expect(deliveryOf({ ...BLOCK, reportAbandonedAt: "2026-11-05T08:00:00.000Z" })).toBe(BLOCK_DELIVERY.UNREPORTED)
	})
})
