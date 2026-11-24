import { BODY_VIEW, LATERALITY } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { BODY_SITE_PROBLEM, type BodySite, bodySiteProblemOf, bodySurfaceOf } from "../body-diagram/body-site"
import { BODY_SURFACE } from "../body-diagram/body-surface"

const SACRUM: BodySite = {
	regionCode: "51027004",
	laterality: null,
	view: BODY_VIEW.POSTERIOR,
	x: 0.5,
	y: 185 / 400,
	bodyDiagramVersion: "1",
}

const RIGHT_KNEE: BodySite = {
	regionCode: "181553006",
	laterality: LATERALITY.RIGHT,
	view: BODY_VIEW.ANTERIOR,
	x: 75 / 200,
	y: 302 / 400,
	bodyDiagramVersion: "1",
}

describe("body site of a touch", () => {
	it("CAP-016-S01 accepts the unpaired sacral region without laterality", () => {
		expect(bodySiteProblemOf(SACRUM)).toBeUndefined()
	})

	it("CAP-016-S07 accepts the knee with the patient's right on the left half of the anterior view", () => {
		expect(bodySiteProblemOf(RIGHT_KNEE)).toBeUndefined()
	})

	it("CAP-016-R16 refuses the side of the screen instead of the side of the patient", () => {
		expect(bodySiteProblemOf({ ...RIGHT_KNEE, laterality: LATERALITY.LEFT })).toBe(BODY_SITE_PROBLEM.WRONG_LATERALITY)
	})

	it("CAP-016-R11 refuses a laterality on an unpaired region", () => {
		expect(bodySiteProblemOf({ ...SACRUM, laterality: LATERALITY.RIGHT })).toBe(BODY_SITE_PROBLEM.WRONG_LATERALITY)
	})

	it("CAP-016-R16 refuses a paired region without laterality", () => {
		expect(bodySiteProblemOf({ ...RIGHT_KNEE, laterality: null })).toBe(BODY_SITE_PROBLEM.WRONG_LATERALITY)
	})

	it("CAP-016-R06 refuses a region the point does not lie in", () => {
		expect(bodySiteProblemOf({ ...RIGHT_KNEE, regionCode: "61248009" })).toBe(BODY_SITE_PROBLEM.POINT_OUTSIDE_REGION)
	})

	it("CAP-016-S02 refuses a point outside the silhouette", () => {
		expect(bodySiteProblemOf({ ...RIGHT_KNEE, x: 0.02, y: 0.02 })).toBe(BODY_SITE_PROBLEM.POINT_OUTSIDE_REGION)
	})

	it("CAP-016-R04 refuses a region in a view it is not drawn in", () => {
		expect(bodySiteProblemOf({ ...RIGHT_KNEE, view: BODY_VIEW.POSTERIOR })).toBe(BODY_SITE_PROBLEM.REGION_NOT_IN_VIEW)
	})

	it("CAP-016-R08 refuses a version of the body diagram the server does not know", () => {
		expect(bodySiteProblemOf({ ...RIGHT_KNEE, bodyDiagramVersion: "0" })).toBe(BODY_SITE_PROBLEM.UNKNOWN_VERSION)
	})

	it("refuses an unknown region code", () => {
		expect(bodySiteProblemOf({ ...RIGHT_KNEE, regionCode: "0" })).toBe(BODY_SITE_PROBLEM.UNKNOWN_REGION)
	})
})

describe("anatomic surface of a body site", () => {
	it("CAP-016-R20 takes the surface of the release for the touched point", () => {
		expect(bodySurfaceOf(RIGHT_KNEE)).toBe(BODY_SURFACE.ANTERIOR)
		expect(bodySurfaceOf(SACRUM)).toBe(BODY_SURFACE.POSTERIOR)
	})
})
