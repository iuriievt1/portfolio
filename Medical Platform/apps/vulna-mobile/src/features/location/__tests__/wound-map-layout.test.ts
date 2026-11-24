import {
	BODY_VIEW,
	type BodyDiagramDrawing,
	type BodyView,
	canvasPoint,
	regionCodeAt,
	SILHOUETTE_PART,
} from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { BodySite, Finding } from "../../../api/findings"
import {
	DESCRIPTION_GAP,
	drawingOfView,
	fitBox,
	locatedFindings,
	MAP_MIN_HEIGHT_SHARE,
	MARKER_HIT_SLOP,
	MARKER_SIZE,
	MAX_MAP_SCALE,
	mapRegionOf,
	oneViewReserveOf,
	PHOTO_ROW_RESERVE,
	placedWounds,
	placeMarkers,
	placementOfBox,
	spotOf,
	woundAt,
} from "../wound-map-layout"

const SONIS = { width: 778, height: 1402 }
const SONIS_FIGURE = { width: 334, height: 699 }
const SONIS_SOLES = { width: 222, height: 222 }
const SONIS_RIGHT_LATERAL = { width: 148, height: 699 }
const SAMSUNG_GALAXY_A57_ALL_VIEWS_SLOT = { width: 412, height: 658 }
const SAMSUNG_GALAXY_A57_ONE_VIEW_SLOT = { width: 412, height: 528 }
const ONE_VIEW_ENLARGEMENT = 1.5
const TOLERANCE = 1e-6
const SCREENS = [
	{ name: "iPhone SE (1st generation)", width: 320, height: 568 },
	{ name: "iPhone SE", width: 375, height: 667 },
	{ name: "iPhone 16", width: 393, height: 852 },
	{ name: "iPhone 16 Pro Max", width: 440, height: 956 },
	{ name: "small Android phone", width: 360, height: 640 },
	{ name: "Samsung Galaxy A", width: 412, height: 915 },
	{ name: "Galaxy Z Flip", width: 412, height: 1004 },
	{ name: "Galaxy Z Fold open", width: 690, height: 829 },
	{ name: "iPad mini", width: 744, height: 1133 },
	{ name: "iPad Pro 13", width: 1032, height: 1376 },
	{ name: "iPad Pro 13 landscape", width: 1376, height: 1032 },
	{ name: "Android tablet landscape", width: 1280, height: 800 },
	{ name: "iPad Split View third", width: 320, height: 1032 },
] as const

const PATIENT = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
const VERSION = "2"

const OLDER_VERSION = "1"
const CREATED_AT = "2026-09-01T08:00:00Z"
const REGION = "362916000"

const FIGURE = { silhouette: [{ part: SILHOUETTE_PART.FILL, path: "M10 10H90V190H10Z" }], areas: [] }
const REGION_AREA = {
	regionCode: REGION,
	points: [
		{ x: 0, y: 0 },
		{ x: 200, y: 0 },
		{ x: 200, y: 200 },
		{ x: 0, y: 200 },
	],
}

const DRAWING: BodyDiagramDrawing = {
	version: VERSION,
	views: {
		[BODY_VIEW.RIGHT_LATERAL]: { frame: { x: 0, y: 0, width: 100, height: 200 }, ...FIGURE },
		[BODY_VIEW.ANTERIOR]: { frame: { x: 100, y: 0, width: 200, height: 200 }, ...FIGURE, areas: [REGION_AREA] },
		[BODY_VIEW.PLANTAR]: { frame: { x: 300, y: 50, width: 100, height: 50 }, ...FIGURE },
	},
}

function bodySite(view: BodyView, x: number, y: number, version = VERSION): BodySite {
	return { region_code: REGION, laterality: "R", view, x, y, body_diagram_version: version }
}

function finding(id: string, number: number, site: BodySite | undefined): Finding {
	return { finding_id: id, patient_id: PATIENT, number, created_at: CREATED_AT, last_body_site: site }
}

describe("wound map over the whole drawing", () => {
	it("DESIGN.md 12.2, CAP-020-R23 shows the number the server gave each wound, gaps included, and skips a finding without a location", () => {
		const third = finding("b", 3, bodySite(BODY_VIEW.ANTERIOR, 0.4, 0.3))
		const first = finding("a", 1, bodySite(BODY_VIEW.ANTERIOR, 0.6, 0.5))
		const unplaced = finding("c", 4, undefined)

		const located = locatedFindings([third, unplaced, first], DRAWING)

		expect(located.map((wound) => [wound.finding.number, wound.finding.finding_id])).toEqual([
			[1, "a"],
			[3, "b"],
		])
	})

	it("NAB-179, CAP-016-R04 places the spot by the normalised coordinates within the frame of its view", () => {
		expect(spotOf(DRAWING, bodySite(BODY_VIEW.ANTERIOR, 0.5, 0.25))).toEqual({ x: 200, y: 50 })
		expect(spotOf(DRAWING, bodySite(BODY_VIEW.PLANTAR, 0.2, 0.4))).toEqual({ x: 320, y: 70 })
	})

	it("CAP-016-R17, CAP-016-R08 draws a wound of an older version of the diagram inside its region on this one", () => {
		const recorded = bodySite(BODY_VIEW.ANTERIOR, 0.95, 0.95, OLDER_VERSION)
		const tracked = finding("a", 1, recorded)
		const anterior = DRAWING.views[BODY_VIEW.ANTERIOR]

		const [wound] = locatedFindings([tracked], DRAWING)

		expect(wound?.bodySite).toMatchObject({
			region_code: REGION,
			laterality: "R",
			view: BODY_VIEW.ANTERIOR,
			body_diagram_version: VERSION,
		})
		expect(anterior && wound && regionCodeAt(anterior, canvasPoint(anterior.frame, wound.bodySite))).toBe(REGION)
		expect(wound && placedWounds(DRAWING, [wound]).map((placed) => placed.finding.finding_id)).toEqual(["a"])
		expect(tracked.last_body_site).toBe(recorded)
	})

	it("CAP-016-R08 puts no wound whose region or view this drawing lacks on it", () => {
		const wounds = locatedFindings(
			[
				finding("a", 1, bodySite(BODY_VIEW.PLANTAR, 0.5, 0.5, OLDER_VERSION)),
				finding("b", 2, bodySite(BODY_VIEW.POSTERIOR, 0.5, 0.5, OLDER_VERSION)),
				finding("c", 3, bodySite(BODY_VIEW.POSTERIOR, 0.5, 0.5)),
				finding("d", 4, bodySite(BODY_VIEW.RIGHT_LATERAL, 0.5, 0.5)),
			],
			DRAWING,
		)

		expect(placedWounds(DRAWING, wounds).map((wound) => [wound.finding.number, wound.spot])).toEqual([
			[4, { x: 50, y: 100 }],
		])
	})

	it.each(SCREENS)("fits the whole drawing into a map as large as $name without distorting it", ({ width, height }) => {
		const box = fitBox({ width, height }, SONIS)

		expect(box.width).toBeLessThanOrEqual(width + TOLERANCE)
		expect(box.height).toBeLessThanOrEqual(height + TOLERANCE)
		expect(box.width / box.height).toBeCloseTo(SONIS.width / SONIS.height)
		const isWidthBound = Math.abs(box.width - width) < TOLERANCE
		const isHeightBound = Math.abs(box.height - height) < TOLERANCE
		expect(isWidthBound || isHeightBound || box.scale === MAX_MAP_SCALE).toBe(true)
	})

	it("CAP-016-R17 fills the whole height of the map on the Samsung Galaxy A57 with all views", () => {
		const box = fitBox(SAMSUNG_GALAXY_A57_ALL_VIEWS_SLOT, SONIS)

		expect(box.height).toBeCloseTo(SAMSUNG_GALAXY_A57_ALL_VIEWS_SLOT.height)
		expect(box.width).toBeLessThanOrEqual(SAMSUNG_GALAXY_A57_ALL_VIEWS_SLOT.width)
	})

	it("CAP-016-R17 keeps every marker whole on the map and apart from the others", () => {
		const box = fitBox({ width: 320, height: 568 }, SONIS)
		const spots = [
			{ x: 1, y: 1 },
			{ x: 500, y: 400 },
			{ x: 502, y: 401 },
			{ x: 505, y: 403 },
			{ x: SONIS.width - 1, y: SONIS.height - 1 },
		]

		const placements = placeMarkers(spots, box)

		for (const { centre } of placements) {
			expect(centre.x).toBeGreaterThanOrEqual(MARKER_SIZE / 2)
			expect(centre.x).toBeLessThanOrEqual(box.width - MARKER_SIZE / 2)
			expect(centre.y).toBeGreaterThanOrEqual(MARKER_SIZE / 2)
			expect(centre.y).toBeLessThanOrEqual(box.height - MARKER_SIZE / 2)
		}
		for (const [index, first] of placements.entries()) {
			for (const second of placements.slice(index + 1)) {
				expect(Math.hypot(first.centre.x - second.centre.x, first.centre.y - second.centre.y)).toBeGreaterThanOrEqual(
					MARKER_SIZE,
				)
			}
		}
	})

	it("CAP-016-R17 leaves a lone marker on its wound and marks only the moved one as displaced", () => {
		const box = fitBox({ width: 393, height: 852 }, SONIS)
		const [first, second] = placeMarkers(
			[
				{ x: 500, y: 400 },
				{ x: 502, y: 401 },
			],
			box,
		)

		expect(first?.centre).toEqual({ x: 500 * box.scale, y: 400 * box.scale })
		expect(first?.isDisplaced).toBe(false)
		expect(second?.isDisplaced).toBe(true)
		expect(second?.spot).toEqual({ x: 502 * box.scale, y: 401 * box.scale })
	})

	it("CAP-016-R17 shows a chosen view alone from the origin, with only its own wounds", () => {
		const soles = drawingOfView(DRAWING, BODY_VIEW.PLANTAR)
		const wounds = locatedFindings(
			[finding("a", 1, bodySite(BODY_VIEW.ANTERIOR, 0.5, 0.5)), finding("b", 2, bodySite(BODY_VIEW.PLANTAR, 0.2, 0.4))],
			DRAWING,
		)

		expect(soles?.views).toEqual({
			[BODY_VIEW.PLANTAR]: { ...DRAWING.views[BODY_VIEW.PLANTAR], frame: { x: 0, y: 0, width: 100, height: 50 } },
		})
		expect(soles && placedWounds(soles, wounds).map((wound) => [wound.finding.number, wound.spot])).toEqual([
			[2, { x: 20, y: 20 }],
		])
	})

	it("CAP-016-R17 has no drawing of a view the drawing lacks", () => {
		expect(drawingOfView(DRAWING, BODY_VIEW.DORSAL)).toBeUndefined()
	})

	it("CAP-016-R17 enlarges a chosen figure on the Samsung Galaxy A57 to the height left above its description", () => {
		const allViews = fitBox(SAMSUNG_GALAXY_A57_ALL_VIEWS_SLOT, SONIS)
		const oneView = fitBox(SAMSUNG_GALAXY_A57_ONE_VIEW_SLOT, SONIS_FIGURE)

		expect(oneView.height).toBeCloseTo(SAMSUNG_GALAXY_A57_ONE_VIEW_SLOT.height)
		expect(oneView.scale / allViews.scale).toBeGreaterThan(ONE_VIEW_ENLARGEMENT)
	})

	it("CAP-016-R17 leaves the map the whole area, or the area above a description", () => {
		const area = { width: 412, height: 658 }

		expect(mapRegionOf(area, 0)).toEqual(area)
		expect(mapRegionOf(area, 126)).toEqual({ width: 412, height: 658 - 126 - DESCRIPTION_GAP })
		expect(mapRegionOf(area, 600)).toEqual({ width: 412, height: 658 * MAP_MIN_HEIGHT_SHARE })
	})

	it("CAP-016-R17, CAP-015-R32 keeps room for the earlier photos under a chosen figure before they load", () => {
		expect(oneViewReserveOf(58, false)).toBe(58 + PHOTO_ROW_RESERVE)
		expect(oneViewReserveOf(58 + PHOTO_ROW_RESERVE, true)).toBe(oneViewReserveOf(58, false))
	})

	it("CAP-016-R17 puts all views and a chosen view in the middle of their regions", () => {
		const area = SAMSUNG_GALAXY_A57_ALL_VIEWS_SLOT
		const region = SAMSUNG_GALAXY_A57_ONE_VIEW_SLOT
		const allViews = fitBox(area, SONIS)
		const oneView = fitBox(region, SONIS_RIGHT_LATERAL)
		const soles = fitBox(region, SONIS_SOLES)

		expect(placementOfBox(area, allViews)).toEqual({
			x: (area.width - allViews.width) / 2,
			y: (area.height - allViews.height) / 2,
			width: allViews.width,
			height: allViews.height,
		})
		expect(placementOfBox(region, oneView).y).toBe(0)
		expect(placementOfBox(region, soles).y).toBeCloseTo((region.height - soles.height) / 2)
		expect(placementOfBox(region, soles).y).toBeGreaterThan(0)
	})

	it.each(SCREENS)("never draws the lines of the drawing thicker than the cap on $name", ({ width, height }) => {
		expect(fitBox({ width, height }, SONIS_SOLES).scale).toBeLessThanOrEqual(MAX_MAP_SCALE)
		expect(fitBox({ width, height }, SONIS_FIGURE).scale).toBeLessThanOrEqual(MAX_MAP_SCALE)
	})

	it("CAP-016-R17 finds the wound whose marker was touched, as far as the marker reaches on the screen", () => {
		const wounds = placedWounds(
			DRAWING,
			locatedFindings([finding("a", 1, bodySite(BODY_VIEW.ANTERIOR, 0.5, 0.25))], DRAWING),
		)
		const scale = 0.5
		const reach = (MARKER_SIZE / 2 + MARKER_HIT_SLOP) / scale

		expect(woundAt({ x: 200 + reach - 1, y: 50 }, wounds, scale)?.finding.finding_id).toBe("a")
		expect(woundAt({ x: 200 + reach + 1, y: 50 }, wounds, scale)).toBeUndefined()
	})
})
