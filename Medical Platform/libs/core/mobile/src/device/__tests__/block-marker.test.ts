import { describe, expect, it } from "vitest"
import { type BlockMarker, blockMarkerOf } from "../block-marker"

const MARKER: BlockMarker = { predecessorHwId: "blocked-hw-id", detectedAt: "2026-10-29T08:00:00.000Z" }

describe("stored marker of the blocked predecessor", () => {
	it("CAP-006-R19 reads back the HW ID of the predecessor and the moment of detection", () => {
		expect(blockMarkerOf(JSON.stringify(MARKER))).toEqual(MARKER)
	})

	it("reads nothing from an empty, damaged or foreign record", () => {
		expect(blockMarkerOf(null)).toBeUndefined()
		expect(blockMarkerOf("{")).toBeUndefined()
		expect(blockMarkerOf(JSON.stringify("blocked-hw-id"))).toBeUndefined()
		expect(blockMarkerOf(JSON.stringify({ ...MARKER, predecessorHwId: "" }))).toBeUndefined()
		expect(blockMarkerOf(JSON.stringify({ ...MARKER, detectedAt: "yesterday" }))).toBeUndefined()
		expect(blockMarkerOf(JSON.stringify({ ...MARKER, detectedAt: "2026" }))).toBeUndefined()
		expect(blockMarkerOf(JSON.stringify({ detectedAt: MARKER.detectedAt }))).toBeUndefined()
	})
})
