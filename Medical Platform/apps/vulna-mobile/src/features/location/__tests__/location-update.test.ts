import { BODY_VIEW, type BodyDiagramDrawing, SILHOUETTE_PART } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { AcquisitionDraft } from "../../../api/acquisitions"
import type { BodySite, Finding } from "../../../api/findings"
import { WOUND_CHOICE } from "../../capture/capture-session"
import { keyedChoice, locationUpdateOf, restoredChoiceOf } from "../location-update"
import { locatedFindings } from "../wound-map-layout"

const PATIENT = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
const OWN = "f0000000-0000-4000-8000-000000000001"
const TRACKED = "f0000000-0000-4000-8000-000000000002"
const KEY = "b0000000-0000-4000-8000-000000000001"

const SITE: BodySite = {
	region_code: "51027004",
	laterality: null,
	view: "posterior",
	x: 0.5,
	y: 0.4625,
	body_diagram_version: "1",
}
const OTHER_SITE: BodySite = { ...SITE, y: 0.45 }

const TRACKED_FINDING: Finding = {
	finding_id: TRACKED,
	patient_id: PATIENT,
	number: 1,
	created_at: "2026-09-01T08:00:00Z",
	last_body_site: OTHER_SITE,
}
const BACK_VIEW = { frame: { x: 0, y: 0, width: 100, height: 200 }, silhouette: [], areas: [] }
const DRAWING: BodyDiagramDrawing = { version: "1", views: { [BODY_VIEW.POSTERIOR]: BACK_VIEW } }
const NEXT_DRAWING: BodyDiagramDrawing = { version: "2", views: { [BODY_VIEW.POSTERIOR]: BACK_VIEW } }
const NEXT_FIGURE: BodyDiagramDrawing = {
	version: "2",
	views: {
		[BODY_VIEW.POSTERIOR]: {
			...BACK_VIEW,
			silhouette: [{ part: SILHOUETTE_PART.FILL, path: "M10 10H90V190H10Z" }],
			areas: [
				{
					regionCode: SITE.region_code,
					points: [
						{ x: 0, y: 100 },
						{ x: 100, y: 100 },
						{ x: 100, y: 200 },
						{ x: 0, y: 200 },
					],
				},
			],
		},
	},
}

const WOUNDS = locatedFindings([TRACKED_FINDING], DRAWING)
const WOUNDS_ON_NEXT_FIGURE = locatedFindings([TRACKED_FINDING], NEXT_FIGURE)

function draftWith(change: Partial<AcquisitionDraft>): AcquisitionDraft {
	return { acquisition_id: "a", version: 2, finding_id: null, ...change } as AcquisitionDraft
}

describe("update of the wound location", () => {
	it("CAP-016-S10 sends the chosen existing finding", () => {
		const choice = { kind: WOUND_CHOICE.EXISTING, finding: TRACKED_FINDING, bodySite: OTHER_SITE }
		expect(locationUpdateOf(choice, draftWith({}), WOUNDS)).toEqual({ finding_id: TRACKED })
	})

	it("CAP-016-R08 sends only the chosen finding of an older diagram, not its place on the current one", () => {
		const [wound] = WOUNDS_ON_NEXT_FIGURE
		const choice = wound && { kind: WOUND_CHOICE.EXISTING, finding: wound.finding, bodySite: wound.bodySite }

		expect(choice && locationUpdateOf(choice, draftWith({}), WOUNDS_ON_NEXT_FIGURE)).toEqual({ finding_id: TRACKED })
	})

	it("sends nothing when the draft already has the chosen finding", () => {
		const choice = { kind: WOUND_CHOICE.EXISTING, finding: TRACKED_FINDING, bodySite: OTHER_SITE }
		expect(locationUpdateOf(choice, draftWith({ finding_id: TRACKED }), WOUNDS)).toBeUndefined()
	})

	it("CAP-016-S01 sends a new finding with its key and place", () => {
		const choice = { kind: WOUND_CHOICE.NEW, bodySite: SITE, findingKey: KEY }
		expect(locationUpdateOf(choice, draftWith({}), WOUNDS)).toEqual({ finding_key: KEY, body_site: SITE })
	})

	it("sends nothing when the own new finding already sits on the place", () => {
		const choice = { kind: WOUND_CHOICE.NEW, bodySite: SITE, findingKey: undefined }
		expect(locationUpdateOf(choice, draftWith({ finding_id: OWN, body_site: SITE }), WOUNDS)).toBeUndefined()
	})

	it("CAP-016-S06 sends the corrected place of the own new wound", () => {
		const choice = { kind: WOUND_CHOICE.NEW, bodySite: OTHER_SITE, findingKey: KEY }
		expect(locationUpdateOf(choice, draftWith({ finding_id: OWN, body_site: SITE }), WOUNDS)).toEqual({
			finding_key: KEY,
			body_site: OTHER_SITE,
		})
	})

	it("CAP-016-S11 sends a new finding even on the place of a tracked finding the draft had", () => {
		const choice = { kind: WOUND_CHOICE.NEW, bodySite: OTHER_SITE, findingKey: KEY }
		expect(locationUpdateOf(choice, draftWith({ finding_id: TRACKED, body_site: OTHER_SITE }), WOUNDS)).toEqual({
			finding_key: KEY,
			body_site: OTHER_SITE,
		})
	})

	it("refuses to send a new finding without its key", () => {
		const choice = { kind: WOUND_CHOICE.NEW, bodySite: SITE, findingKey: undefined }
		expect(() => locationUpdateOf(choice, draftWith({}), WOUNDS)).toThrow("finding key")
	})
})

describe("key of a new wound", () => {
	it("CAP-021-R29 keeps the same finding key when the save is repeated", async () => {
		let counter = 0
		const newKey = async () => {
			counter += 1
			return `key-${counter}`
		}
		const choice = { kind: WOUND_CHOICE.NEW, bodySite: SITE, findingKey: undefined }

		const keyed = await keyedChoice(choice, newKey)
		const repeated = await keyedChoice(keyed, newKey)

		expect(keyed).toEqual({ ...choice, findingKey: "key-1" })
		expect(repeated).toBe(keyed)
	})

	it("leaves a chosen existing finding without a key", async () => {
		const choice = { kind: WOUND_CHOICE.EXISTING, finding: TRACKED_FINDING, bodySite: OTHER_SITE }
		expect(await keyedChoice(choice, async () => KEY)).toBe(choice)
	})
})

const NOTHING_REMEMBERED = { wound: undefined, isWoundCleared: false }

describe("wound place restored when the step opens again", () => {
	it("CAP-015-R15 restores the wound chosen earlier in this capture", () => {
		const remembered = { kind: WOUND_CHOICE.NEW, bodySite: OTHER_SITE, findingKey: KEY }
		expect(
			restoredChoiceOf(
				{ wound: remembered, isWoundCleared: false },
				draftWith({ finding_id: OWN, body_site: SITE }),
				WOUNDS,
				DRAWING,
			),
		).toBe(remembered)
	})

	it("CAP-016-R14 restores no place after it was cleared in this capture, though the draft still has one", () => {
		expect(
			restoredChoiceOf(
				{ wound: undefined, isWoundCleared: true },
				draftWith({ finding_id: OWN, body_site: SITE }),
				WOUNDS,
				DRAWING,
			),
		).toBeUndefined()
	})

	it("CAP-015-R15 restores the new wound saved in the draft", () => {
		expect(
			restoredChoiceOf(NOTHING_REMEMBERED, draftWith({ finding_id: OWN, body_site: SITE }), WOUNDS, DRAWING),
		).toEqual({
			kind: WOUND_CHOICE.NEW,
			bodySite: SITE,
			findingKey: undefined,
		})
	})

	it("CAP-016-R17 restores the existing wound saved in the draft", () => {
		expect(
			restoredChoiceOf(NOTHING_REMEMBERED, draftWith({ finding_id: TRACKED, body_site: OTHER_SITE }), WOUNDS, DRAWING),
		).toEqual({ kind: WOUND_CHOICE.EXISTING, finding: TRACKED_FINDING, bodySite: OTHER_SITE })
	})

	it("restores nothing when the draft has no place", () => {
		expect(restoredChoiceOf(NOTHING_REMEMBERED, draftWith({}), WOUNDS, DRAWING)).toBeUndefined()
	})

	it("CAP-016-R17 restores the existing wound of an older diagram on its place in the current one", () => {
		const restored = restoredChoiceOf(
			NOTHING_REMEMBERED,
			draftWith({ finding_id: TRACKED, body_site: OTHER_SITE }),
			WOUNDS_ON_NEXT_FIGURE,
			NEXT_FIGURE,
		)

		expect(restored).toEqual({
			kind: WOUND_CHOICE.EXISTING,
			finding: TRACKED_FINDING,
			bodySite: WOUNDS_ON_NEXT_FIGURE[0]?.bodySite,
		})
		expect(restored?.bodySite).toMatchObject({ region_code: SITE.region_code, body_diagram_version: "2" })
	})

	it("CAP-016-R08 restores no place of another version of the diagram", () => {
		expect(
			restoredChoiceOf(NOTHING_REMEMBERED, draftWith({ finding_id: OWN, body_site: SITE }), WOUNDS, NEXT_DRAWING),
		).toBeUndefined()
	})
})
