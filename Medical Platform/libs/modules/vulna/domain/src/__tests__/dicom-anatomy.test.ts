import { BODY_VIEW, LATERALITY } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { BODY_DIAGRAM_RELEASES } from "../body-diagram/body-diagram"
import { drawnBodySurfaceOf } from "../body-diagram/body-site"
import { BODY_SURFACE, type BodySurface } from "../body-diagram/body-surface"
import { dicomAnatomyOf } from "../dicom/anatomy"
import { DICOM_MAPPING_FAILURE } from "../dicom/mapping-error"
import { bodySiteAt, everyBodySiteOf } from "./body-site-at"

const LOWER_CHEST_WALL = "699915001"
const SOLE_OF_FOOT = "60496002"
const FOREHEAD = "68698007"
const EYE_REGION = "362916000"
const GREATER_TROCHANTER = "450693000"
const SNOMED_CT = "SCT"
// DICOM PS3.16 Annex L, Table L-5
const PAIRED_BODY_PARTS = new Set([
	"ANKLE",
	"BREAST",
	"ELBOW",
	"FINGER",
	"FOOT",
	"FOREARM",
	"HAND",
	"HIP",
	"KNEE",
	"LOWERLEG",
	"SCAPULA",
	"THIGH",
	"TOE",
	"UPPERARM",
])
// DICOM PS3.16 CID 2, Q-146
const SURFACE_CODES: Readonly<Record<BodySurface, string>> = {
	[BODY_SURFACE.ANTERIOR]: "255549009",
	[BODY_SURFACE.POSTERIOR]: "255551008",
	[BODY_SURFACE.PLANTAR]: "261089000",
	[BODY_SURFACE.MEDIAL]: "255561001",
	[BODY_SURFACE.LATERAL]: "49370004",
}
// DICOM PS3.3 10.5, PS3.16 CID 244
const SIDE_CODES = { [LATERALITY.RIGHT]: "24028007", [LATERALITY.LEFT]: "7771000" }

function code(codeValue: string, codeMeaning: string) {
	return { codeValue, codingSchemeDesignator: SNOMED_CT, codeMeaning }
}

// integrace-dicom.md 5.3, 5.4, CAP-021-R14, CAP-016-R20, DICOM PS3.3 10.5, C.7.3.1, PS3.16 Annex L, CID 2
describe("DICOM anatomy of a wound", () => {
	it("CAP-021-S36 writes the sole of the foot with the side of the patient and a plantar modifier, not posterior", () => {
		const site = bodySiteAt(SOLE_OF_FOOT, BODY_VIEW.PLANTAR, LATERALITY.RIGHT)

		expect(dicomAnatomyOf(site)).toEqual({
			bodyPartExamined: "FOOT",
			laterality: LATERALITY.RIGHT,
			anatomicRegion: code("56459004", "Foot"),
			anatomicRegionModifiers: [code("261089000", "Inferior")],
		})
	})

	it("DICOM PS3.3 10.5, C.7.3.1 leaves Laterality out at a body part DICOM does not pair and codes the side", () => {
		const left = bodySiteAt(LOWER_CHEST_WALL, BODY_VIEW.ANTERIOR, LATERALITY.LEFT)
		const right = bodySiteAt(LOWER_CHEST_WALL, BODY_VIEW.ANTERIOR, LATERALITY.RIGHT)

		expect(dicomAnatomyOf(left)).toEqual({
			bodyPartExamined: "CHEST",
			laterality: undefined,
			anatomicRegion: code("816094009", "Chest"),
			anatomicRegionModifiers: [code("255549009", "Anterior"), code("7771000", "Left")],
		})
		expect(dicomAnatomyOf(right).anatomicRegionModifiers).toEqual([
			code("255549009", "Anterior"),
			code("24028007", "Right"),
		])
	})

	it("CAP-016-R11 adds no side to an unpaired region", () => {
		const anatomy = dicomAnatomyOf(bodySiteAt(FOREHEAD, BODY_VIEW.ANTERIOR, null))

		expect(anatomy).toMatchObject({ bodyPartExamined: "HEAD", laterality: undefined })
		expect(anatomy.anatomicRegionModifiers).toEqual([code("255549009", "Anterior")])
	})

	it("Q-087 names the eye region HEAD and the greater trochanter HIP, which PS3.16 Annex L does not name", () => {
		const eye = bodySiteAt(EYE_REGION, BODY_VIEW.ANTERIOR, LATERALITY.LEFT)
		const hip = bodySiteAt(GREATER_TROCHANTER, BODY_VIEW.RIGHT_LATERAL, LATERALITY.RIGHT)

		expect(dicomAnatomyOf(eye)).toMatchObject({ bodyPartExamined: "HEAD", laterality: undefined })
		expect(dicomAnatomyOf(hip)).toMatchObject({ bodyPartExamined: "HIP", laterality: LATERALITY.RIGHT })
	})

	it("PS3.16 Annex L gives every region, side and view of every diagram a body part, a side and a surface", () => {
		const surfaces = new Set<BodySurface>()
		for (const release of BODY_DIAGRAM_RELEASES) {
			for (const site of everyBodySiteOf(release)) {
				const anatomy = dicomAnatomyOf(site)
				const surface = drawnBodySurfaceOf(site) as BodySurface
				const isPaired = PAIRED_BODY_PARTS.has(anatomy.bodyPartExamined)
				const sides = isPaired || site.laterality === null ? [] : [SIDE_CODES[site.laterality]]
				surfaces.add(surface)

				expect(anatomy.bodyPartExamined).toMatch(/^[A-Z]{3,16}$/)
				expect(anatomy.laterality).toBe(isPaired ? site.laterality : undefined)
				expect(anatomy.anatomicRegionModifiers.map((modifier) => modifier.codeValue)).toEqual([
					SURFACE_CODES[surface],
					...sides,
				])
			}
		}
		expect([...surfaces].sort()).toEqual(Object.values(BODY_SURFACE).sort())
	})

	it.each([
		["a region the diagram does not have", { regionCode: "1" }],
		["a diagram that does not exist", { bodyDiagramVersion: "99" }],
		["a point outside every area", { x: 0, y: 0 }],
	])("integrace-dicom.md 5.3 refuses %s (negative)", (_, change) => {
		const site = bodySiteAt(FOREHEAD, BODY_VIEW.ANTERIOR, null)

		expect(() => dicomAnatomyOf({ ...site, ...change })).toThrow(
			expect.objectContaining({ failure: DICOM_MAPPING_FAILURE.UNKNOWN_BODY_SITE }),
		)
	})

	it("DICOM PS3.3 C.7.3.1 refuses a body part DICOM pairs without the side of the patient (negative)", () => {
		const site = bodySiteAt(SOLE_OF_FOOT, BODY_VIEW.PLANTAR, LATERALITY.RIGHT)

		expect(() => dicomAnatomyOf({ ...site, laterality: null })).toThrow(
			expect.objectContaining({ failure: DICOM_MAPPING_FAILURE.UNKNOWN_BODY_SITE }),
		)
	})
})
