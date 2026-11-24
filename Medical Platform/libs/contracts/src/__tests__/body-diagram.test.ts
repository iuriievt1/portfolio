import { describe, expect, it } from "vitest"
import {
	type BodyDiagramDrawing,
	BodyDiagramFormatError,
	bodyDiagramSvg,
	drawingSize,
	readBodyDiagramSvg,
	SILHOUETTE_PART,
} from "../body-diagram"
import {
	canvasPoint,
	isOnSilhouette,
	lateralityAt,
	normalizedPoint,
	normalizedPointInRegion,
	regionCodeAt,
	siteOnDrawing,
	subpathsOf,
	viewPointAt,
} from "../body-diagram-geometry"
import { BODY_VIEW, BODY_VIEWS, LATERALITY } from "../clinical"

const TORSO = "M50 50H150V350H50Z"
const KNEE = "70"
const SACRUM = "51027004"
const FRAME = { width: 200, height: 400 }

const DRAWING: BodyDiagramDrawing = {
	version: "7",
	views: {
		[BODY_VIEW.ANTERIOR]: {
			frame: { x: 0, y: 0, ...FRAME },
			silhouette: [
				{ part: SILHOUETTE_PART.FILL, path: TORSO },
				{ part: SILHOUETTE_PART.OUTLINE, path: TORSO },
				{ part: SILHOUETTE_PART.DETAIL, path: "M160 160L180 160L170 180Z" },
			],
			areas: [
				{
					regionCode: KNEE,
					points: [
						{ x: 0, y: 0 },
						{ x: 200, y: 0 },
						{ x: 200, y: 200 },
						{ x: 0, y: 200 },
					],
				},
			],
		},
		[BODY_VIEW.POSTERIOR]: {
			frame: { x: 200, y: 0, ...FRAME },
			silhouette: [{ part: SILHOUETTE_PART.FILL, path: "M50 50C50 50 150 50 150 50V350H50Z" }],
			areas: [
				{
					regionCode: SACRUM,
					points: [
						{ x: 0, y: 200 },
						{ x: 200, y: 200 },
						{ x: 200, y: 400 },
						{ x: 0, y: 400 },
					],
				},
			],
		},
		[BODY_VIEW.PLANTAR]: {
			frame: { x: 400, y: 100, width: 100, height: 50 },
			silhouette: [{ part: SILHOUETTE_PART.FILL, path: "M10 10H90V40H10Z" }],
			areas: [],
		},
	},
}

describe("body diagram background format", () => {
	it("reads back exactly what it wrote", () => {
		expect(readBodyDiagramSvg(bodyDiagramSvg(DRAWING))).toEqual(DRAWING)
	})

	it("names the version and every drawn view in its frame", () => {
		const svg = bodyDiagramSvg(DRAWING)
		expect(svg).toContain('data-body-diagram-version="7"')
		expect(svg).toContain('<svg data-view="anterior" x="0" y="0" width="200" height="400" viewBox="0 0 200 400">')
		expect(svg).toContain('<svg data-view="posterior" x="200" y="0" width="200" height="400" viewBox="0 0 200 400">')
		expect(svg).toContain('<svg data-view="plantar" x="400" y="100" width="100" height="50" viewBox="0 0 100 50">')
		expect(svg).toContain('viewBox="0 0 500 400" data-body-diagram-version="7"')
	})

	it("measures the drawing as the union of its frames", () => {
		expect(drawingSize(DRAWING.views)).toEqual({ width: 500, height: 400 })
	})

	it("refuses to measure or write a diagram without any view", () => {
		expect(() => drawingSize({})).toThrow(BodyDiagramFormatError)
		expect(() => bodyDiagramSvg({ version: "7", views: {} })).toThrow(BodyDiagramFormatError)
	})

	it("refuses a diagram without a version", () => {
		const svg = bodyDiagramSvg(DRAWING).replace(' data-body-diagram-version="7"', "")
		expect(() => readBodyDiagramSvg(svg)).toThrow(BodyDiagramFormatError)
	})

	it("refuses a diagram that repeats a view", () => {
		const svg = bodyDiagramSvg(DRAWING).replace('data-view="posterior"', 'data-view="anterior"')
		expect(() => readBodyDiagramSvg(svg)).toThrow(BodyDiagramFormatError)
	})

	it("refuses a view whose canvas is not its frame", () => {
		const svg = bodyDiagramSvg(DRAWING).replace('viewBox="0 0 100 50"', 'viewBox="0 0 100 60"')
		expect(() => readBodyDiagramSvg(svg)).toThrow(BodyDiagramFormatError)
	})

	it("refuses a view without a size", () => {
		const svg = bodyDiagramSvg(DRAWING).replace(' width="100"', "")
		expect(() => readBodyDiagramSvg(svg)).toThrow(BodyDiagramFormatError)
	})

	it("refuses a diagram without any view", () => {
		expect(() => readBodyDiagramSvg('<svg viewBox="0 0 1 1" data-body-diagram-version="7">\n</svg>\n')).toThrow(
			BodyDiagramFormatError,
		)
	})

	it("refuses text outside the elements", () => {
		const svg = bodyDiagramSvg(DRAWING).replace("</svg>\n", "</svg>\nnote\n")
		expect(() => readBodyDiagramSvg(svg)).toThrow(BodyDiagramFormatError)
	})

	it("refuses an unknown element inside a view", () => {
		const svg = bodyDiagramSvg(DRAWING).replace("<polygon", '<text x="1"/>\n<polygon')
		expect(() => readBodyDiagramSvg(svg)).toThrow(BodyDiagramFormatError)
	})

	it("refuses a malformed area point", () => {
		const svg = bodyDiagramSvg(DRAWING).replace('points="0,0', 'points="0,0,1')
		expect(() => readBodyDiagramSvg(svg)).toThrow(BodyDiagramFormatError)
	})
})

describe("silhouette path", () => {
	it("splits a path into closed outlines at every move", () => {
		expect(subpathsOf("M0 0H10V10Z M20 20L30 20L30 30")).toEqual([
			[
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 10, y: 10 },
			],
			[
				{ x: 20, y: 20 },
				{ x: 30, y: 20 },
				{ x: 30, y: 30 },
			],
		])
	})

	it("follows a curve to its end point", () => {
		expect(subpathsOf("M0 0C0 10 10 10 10 0").at(0)?.at(-1)).toEqual({ x: 10, y: 0 })
	})

	it("refuses relative commands", () => {
		expect(() => subpathsOf("M0 0l10 0")).toThrow(BodyDiagramFormatError)
	})
})

describe("region under a touch", () => {
	const anterior = DRAWING.views[BODY_VIEW.ANTERIOR]
	const posterior = DRAWING.views[BODY_VIEW.POSTERIOR]

	it("CAP-016-S01 names the region under the point", () => {
		expect(posterior && regionCodeAt(posterior, { x: 100, y: 300 })).toBe(SACRUM)
	})

	it("CAP-016-S02 names no region outside the silhouette even where an area reaches", () => {
		expect(anterior && regionCodeAt(anterior, { x: 20, y: 20 })).toBeUndefined()
		expect(anterior && isOnSilhouette(anterior, { x: 20, y: 20 })).toBe(false)
	})

	it("CAP-016-S02 names no region on the silhouette outside every area", () => {
		expect(anterior && regionCodeAt(anterior, { x: 100, y: 300 })).toBeUndefined()
	})

	it("takes only the filled outline as the body, not a drawn detail", () => {
		expect(anterior && isOnSilhouette(anterior, { x: 170, y: 165 })).toBe(false)
		expect(anterior && isOnSilhouette(anterior, { x: 100, y: 95 })).toBe(true)
	})
})

describe("point inside a region of a view CAP-016-R08", () => {
	const anterior = DRAWING.views[BODY_VIEW.ANTERIOR]
	const plantar = DRAWING.views[BODY_VIEW.PLANTAR]

	it("CAP-016-R17 finds a point of the region on the figure, as a point normalised to the view", () => {
		const point = anterior && normalizedPointInRegion(BODY_VIEW.ANTERIOR, anterior, KNEE, null)

		expect(point).toEqual({ x: 0.5, y: 0.25 })
		expect(anterior && point && regionCodeAt(anterior, canvasPoint(anterior.frame, point))).toBe(KNEE)
	})

	it("CAP-016-R16 keeps the side of the patient", () => {
		for (const laterality of [LATERALITY.RIGHT, LATERALITY.LEFT]) {
			const point = anterior && normalizedPointInRegion(BODY_VIEW.ANTERIOR, anterior, KNEE, laterality)

			expect(point && lateralityAt(BODY_VIEW.ANTERIOR, point)).toBe(laterality)
			expect(anterior && point && regionCodeAt(anterior, canvasPoint(anterior.frame, point))).toBe(KNEE)
		}
	})

	it("finds no point of a region the view does not draw", () => {
		expect(anterior && normalizedPointInRegion(BODY_VIEW.ANTERIOR, anterior, SACRUM, null)).toBeUndefined()
		expect(plantar && normalizedPointInRegion(BODY_VIEW.PLANTAR, plantar, KNEE, null)).toBeUndefined()
	})

	it("finds no point on the side of the patient a side view does not show", () => {
		const posterior = DRAWING.views[BODY_VIEW.POSTERIOR]
		expect(
			posterior && normalizedPointInRegion(BODY_VIEW.RIGHT_LATERAL, posterior, SACRUM, LATERALITY.LEFT),
		).toBeUndefined()
	})
})

describe("body site of a finding shown on the drawing CAP-016-R17", () => {
	const older = {
		region_code: KNEE,
		laterality: LATERALITY.RIGHT,
		view: BODY_VIEW.ANTERIOR,
		x: 0.9,
		y: 0.9,
		body_diagram_version: "6",
	} as const

	it("keeps a site of the version of the drawing as it is", () => {
		const current = { ...older, body_diagram_version: DRAWING.version }
		expect(siteOnDrawing(DRAWING, current)).toBe(current)
	})

	it("CAP-016-R08 puts a site of an older version inside the same region, view and side instead of on its old point", () => {
		const shown = siteOnDrawing(DRAWING, older)
		const anterior = DRAWING.views[BODY_VIEW.ANTERIOR]

		expect(shown).toMatchObject({
			region_code: KNEE,
			laterality: LATERALITY.RIGHT,
			view: BODY_VIEW.ANTERIOR,
			body_diagram_version: DRAWING.version,
		})
		expect(shown && lateralityAt(BODY_VIEW.ANTERIOR, shown)).toBe(LATERALITY.RIGHT)
		expect(anterior && shown && regionCodeAt(anterior, canvasPoint(anterior.frame, shown))).toBe(KNEE)
		expect(anterior && regionCodeAt(anterior, canvasPoint(anterior.frame, older))).toBeUndefined()
		expect([shown?.x, shown?.y]).not.toEqual([older.x, older.y])
	})

	it("CAP-016-R08 has no site of a region the view of the drawing lacks", () => {
		expect(siteOnDrawing(DRAWING, { ...older, region_code: SACRUM })).toBeUndefined()
	})

	it("CAP-016-R08 has no site of a view the drawing lacks", () => {
		expect(siteOnDrawing(DRAWING, { ...older, view: BODY_VIEW.DORSAL })).toBeUndefined()
	})
})

describe("view under a touch on the whole drawing CAP-016-R04", () => {
	it("finds the view whose figure is under the point and the point in that view", () => {
		expect(viewPointAt(DRAWING.views, { x: 300, y: 120 })).toEqual({
			view: BODY_VIEW.POSTERIOR,
			point: { x: 100, y: 120 },
		})
		expect(viewPointAt(DRAWING.views, { x: 450, y: 125 })).toEqual({
			view: BODY_VIEW.PLANTAR,
			point: { x: 50, y: 25 },
		})
	})

	it("CAP-016-S02 finds no view between the figures", () => {
		expect(viewPointAt(DRAWING.views, { x: 190, y: 120 })).toBeUndefined()
		expect(viewPointAt(DRAWING.views, { x: 450, y: 300 })).toBeUndefined()
	})
})

describe("patient side in every view CAP-016-R16", () => {
	const LEFT_HALF = { x: 0.3, y: 0.5 }
	const RIGHT_HALF = { x: 0.7, y: 0.5 }

	it("CAP-016-S07 puts the patient's right on the left half of the anterior view", () => {
		expect(lateralityAt(BODY_VIEW.ANTERIOR, LEFT_HALF)).toBe(LATERALITY.RIGHT)
	})

	it("CAP-016-S08 puts the patient's right on the right half of the posterior view", () => {
		expect(lateralityAt(BODY_VIEW.POSTERIOR, RIGHT_HALF)).toBe(LATERALITY.RIGHT)
	})

	it("CAP-016-S13 puts the patient's left on the right half of the anterior view", () => {
		expect(lateralityAt(BODY_VIEW.ANTERIOR, RIGHT_HALF)).toBe(LATERALITY.LEFT)
	})

	it("puts the right foot on the left half of the soles and on the right half of the backs of the feet", () => {
		expect(lateralityAt(BODY_VIEW.PLANTAR, LEFT_HALF)).toBe(LATERALITY.RIGHT)
		expect(lateralityAt(BODY_VIEW.PLANTAR, RIGHT_HALF)).toBe(LATERALITY.LEFT)
		expect(lateralityAt(BODY_VIEW.DORSAL, LEFT_HALF)).toBe(LATERALITY.LEFT)
		expect(lateralityAt(BODY_VIEW.DORSAL, RIGHT_HALF)).toBe(LATERALITY.RIGHT)
	})

	it("shows only one side of the patient in a side view", () => {
		for (const point of [LEFT_HALF, RIGHT_HALF]) {
			expect(lateralityAt(BODY_VIEW.RIGHT_LATERAL, point)).toBe(LATERALITY.RIGHT)
			expect(lateralityAt(BODY_VIEW.LEFT_LATERAL, point)).toBe(LATERALITY.LEFT)
		}
	})

	it("knows a side for every view of the contract", () => {
		for (const view of BODY_VIEWS) {
			expect([LATERALITY.RIGHT, LATERALITY.LEFT]).toContain(lateralityAt(view, LEFT_HALF))
		}
	})
})

describe("coordinates", () => {
	it("CAP-016-R04 normalises a point to the frame of its view, independent of the display", () => {
		const frame = { x: 400, y: 100, width: 100, height: 50 }
		expect(normalizedPoint(frame, { x: 25, y: 10 })).toEqual({ x: 0.25, y: 0.2 })
		expect(canvasPoint(frame, { x: 0.25, y: 0.2 })).toEqual({ x: 25, y: 10 })
	})
})
