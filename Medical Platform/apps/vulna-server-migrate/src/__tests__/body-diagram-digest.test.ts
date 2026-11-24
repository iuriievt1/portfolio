import { CURRENT_BODY_DIAGRAM } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import { bodyDiagramDigest } from "../body-diagram-digest"

const SHA256_HEX = /^[0-9a-f]{64}$/

describe("body diagram digest CAP-016-R18", () => {
	it("is a stable SHA-256 of the regions the release carries", () => {
		expect(bodyDiagramDigest(CURRENT_BODY_DIAGRAM)).toMatch(SHA256_HEX)
		expect(bodyDiagramDigest(CURRENT_BODY_DIAGRAM)).toBe(bodyDiagramDigest({ ...CURRENT_BODY_DIAGRAM }))
	})

	it("CAP-017-R09 changes with a region translation under the same diagram version", () => {
		const [first, ...rest] = CURRENT_BODY_DIAGRAM.regions
		if (first === undefined) {
			throw new Error("the current body diagram has no regions")
		}
		const translated = { ...first, names: { ...first.names, de: "Kopfhaut" } }

		expect(bodyDiagramDigest({ ...CURRENT_BODY_DIAGRAM, regions: [translated, ...rest] })).not.toBe(
			bodyDiagramDigest(CURRENT_BODY_DIAGRAM),
		)
	})

	it("ignores the order in which a region lists its languages", () => {
		const reordered = CURRENT_BODY_DIAGRAM.regions.map((region) => ({
			...region,
			names: Object.fromEntries(Object.entries(region.names).reverse()),
		}))

		expect(bodyDiagramDigest({ ...CURRENT_BODY_DIAGRAM, regions: reordered })).toBe(
			bodyDiagramDigest(CURRENT_BODY_DIAGRAM),
		)
	})
})
