import type { PageCorners } from "@ansora/core-mobile"
import { describe, expect, it } from "vitest"
import { pageGeometryOf, plainCornersOf, quarterTurnsOf } from "../page-geometry"

const CORNERS: PageCorners = {
	topLeft: { x: 0.1, y: 0.1 },
	topRight: { x: 0.9, y: 0.12 },
	bottomRight: { x: 0.88, y: 0.9 },
	bottomLeft: { x: 0.12, y: 0.92 },
}

describe("page geometry", () => {
	it("CAP-018-R11 keeps the rotation of a page for its next crop", () => {
		const stored = pageGeometryOf(CORNERS, 1)
		expect(quarterTurnsOf({ corners: stored })).toBe(1)
		expect(JSON.parse(stored)).toMatchObject(CORNERS)
	})

	it("CAP-015-R34 counts quarter turns around one circle", () => {
		expect(quarterTurnsOf({ corners: pageGeometryOf(CORNERS, 5) })).toBe(1)
		expect(quarterTurnsOf({ corners: pageGeometryOf(CORNERS, -1) })).toBe(3)
		expect(quarterTurnsOf({ corners: pageGeometryOf(CORNERS, 4) })).toBe(0)
	})

	it("CAP-018-S02 treats a page without stored geometry as not turned", () => {
		expect(quarterTurnsOf({ corners: null })).toBe(0)
		expect(quarterTurnsOf({ corners: JSON.stringify(CORNERS) })).toBe(0)
		expect(quarterTurnsOf({ corners: "{" })).toBe(0)
		expect(quarterTurnsOf({ corners: JSON.stringify({ quarterTurns: 1.5 }) })).toBe(0)
	})

	it("CAP-018-R10 hands the scanner only the four corners", () => {
		const stored = { ...CORNERS, quarterTurns: 2 }
		expect(plainCornersOf(stored)).toEqual(CORNERS)
	})
})
