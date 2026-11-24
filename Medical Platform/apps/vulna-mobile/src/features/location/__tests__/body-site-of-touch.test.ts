import { BODY_VIEW, type BodyDiagramDrawing, type DiagramView, SILHOUETTE_PART } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { BodyDiagramRegion } from "../../../api/code-lists"
import { bodySiteOfTouch } from "../body-site-of-touch"
import { drawingOfView } from "../wound-map-layout"

const KNEE = "181553006"
const SACRUM = "51027004"
const HEEL = "84607009"

const FIGURE = {
	silhouette: [{ part: SILHOUETTE_PART.FILL, path: "M50 50H150V350H50Z" }],
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
}

const SIDE: DiagramView = {
	frame: { x: 400, y: 0, width: 100, height: 400 },
	silhouette: [{ part: SILHOUETTE_PART.FILL, path: "M10 50H90V350H10Z" }],
	areas: [
		{
			regionCode: KNEE,
			points: [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 100, y: 400 },
				{ x: 0, y: 400 },
			],
		},
	],
}

const SOLES: DiagramView = {
	frame: { x: 500, y: 0, width: 100, height: 50 },
	silhouette: [{ part: SILHOUETTE_PART.FILL, path: "M5 5H95V45H5Z" }],
	areas: [
		{
			regionCode: HEEL,
			points: [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 100, y: 50 },
				{ x: 0, y: 50 },
			],
		},
	],
}

const DRAWING: BodyDiagramDrawing = {
	version: "3",
	views: {
		[BODY_VIEW.ANTERIOR]: { frame: { x: 0, y: 0, width: 200, height: 400 }, ...FIGURE },
		[BODY_VIEW.POSTERIOR]: { frame: { x: 200, y: 0, width: 200, height: 400 }, ...FIGURE },
		[BODY_VIEW.RIGHT_LATERAL]: SIDE,
		[BODY_VIEW.PLANTAR]: SOLES,
	},
}

const REGIONS: BodyDiagramRegion[] = [
	{
		code: KNEE,
		name: "Koleno",
		names: { cs: "Koleno" },
		views: ["anterior", "posterior", "right_lateral"],
		is_paired: true,
	},
	{
		code: SACRUM,
		name: "Křížová krajina",
		names: { cs: "Křížová krajina" },
		views: ["anterior", "posterior"],
		is_paired: false,
	},
	{ code: HEEL, name: "Pata", names: { cs: "Pata" }, views: ["plantar"], is_paired: true },
]

describe("body site of a touch on the whole drawing", () => {
	it("CAP-016-S07 gives the patient's right on the left half of the anterior view", () => {
		expect(bodySiteOfTouch(DRAWING, REGIONS, { x: 60, y: 100 })).toEqual({
			region_code: KNEE,
			laterality: "R",
			view: BODY_VIEW.ANTERIOR,
			x: 0.3,
			y: 0.25,
			body_diagram_version: "3",
		})
	})

	it("CAP-016-S08 gives the patient's right on the right half of the posterior view", () => {
		expect(bodySiteOfTouch(DRAWING, REGIONS, { x: 340, y: 100 })).toMatchObject({
			view: BODY_VIEW.POSTERIOR,
			laterality: "R",
			x: 0.7,
		})
	})

	it("CAP-016-S01 gives no laterality on an unpaired region", () => {
		expect(bodySiteOfTouch(DRAWING, REGIONS, { x: 300, y: 300 })).toMatchObject({
			region_code: SACRUM,
			laterality: null,
		})
	})

	it("CAP-016-R16 gives the side of a side view wherever it is touched", () => {
		expect(bodySiteOfTouch(DRAWING, REGIONS, { x: 480, y: 100 })).toMatchObject({
			view: BODY_VIEW.RIGHT_LATERAL,
			laterality: "R",
			x: 0.8,
			y: 0.25,
		})
	})

	it("CAP-016-R16 gives the right foot on the left half of the soles", () => {
		expect(bodySiteOfTouch(DRAWING, REGIONS, { x: 520, y: 25 })).toMatchObject({
			region_code: HEEL,
			view: BODY_VIEW.PLANTAR,
			laterality: "R",
			x: 0.2,
			y: 0.5,
		})
	})

	it("CAP-016-S02 gives no body site outside the figures", () => {
		expect(bodySiteOfTouch(DRAWING, REGIONS, { x: 20, y: 20 })).toBeUndefined()
		expect(bodySiteOfTouch(DRAWING, REGIONS, { x: 195, y: 100 })).toBeUndefined()
		expect(bodySiteOfTouch(DRAWING, REGIONS, { x: 550, y: 200 })).toBeUndefined()
	})

	it("CAP-016-R06 gives no body site on the silhouette where no area lies", () => {
		const anterior = DRAWING.views[BODY_VIEW.ANTERIOR]
		const kneeOnly = anterior && { ...anterior, areas: anterior.areas.filter((area) => area.regionCode === KNEE) }
		const drawing: BodyDiagramDrawing = { version: "3", views: { [BODY_VIEW.ANTERIOR]: kneeOnly } }

		expect(bodySiteOfTouch(drawing, REGIONS, { x: 100, y: 300 })).toBeUndefined()
	})

	it("CAP-016-R18 gives no body site for an area whose region the code list does not know", () => {
		const kneeRegions = REGIONS.filter((region) => region.code === KNEE)

		expect(bodySiteOfTouch(DRAWING, kneeRegions, { x: 300, y: 300 })).toBeUndefined()
	})
})

describe("body site of a touch on one view shown alone", () => {
	it("CAP-016-R17, CAP-016-R04 gives the same body site as the same place on the whole drawing", () => {
		const posterior = drawingOfView(DRAWING, BODY_VIEW.POSTERIOR)
		const soles = drawingOfView(DRAWING, BODY_VIEW.PLANTAR)

		expect(posterior && bodySiteOfTouch(posterior, REGIONS, { x: 140, y: 100 })).toEqual(
			bodySiteOfTouch(DRAWING, REGIONS, { x: 340, y: 100 }),
		)
		expect(soles && bodySiteOfTouch(soles, REGIONS, { x: 20, y: 25 })).toEqual(
			bodySiteOfTouch(DRAWING, REGIONS, { x: 520, y: 25 }),
		)
	})

	it("CAP-016-S02 gives no body site where only another view lies on the whole drawing", () => {
		const anterior = drawingOfView(DRAWING, BODY_VIEW.ANTERIOR)

		expect(anterior && bodySiteOfTouch(anterior, REGIONS, { x: 340, y: 100 })).toBeUndefined()
	})
})
