import { describe, expect, it } from "vitest"
import { baseReference, checkBaseLayers } from "../base-image"

const digest = `sha256:${"a".repeat(64)}`
const base = { image: "gcr.io/distroless/nodejs24-debian13", digest }
const baseLayers = ["sha256:1", "sha256:2"]

describe("B7 base image", () => {
	it("references the base image by digest from the profile", () => {
		expect(baseReference(base)).toBe(`gcr.io/distroless/nodejs24-debian13@${digest}`)
		expect(baseReference({ ...base, digest: null })).toBeUndefined()
	})

	it("passes an image whose first layers are the base image layers", () => {
		expect(checkBaseLayers(base, [...baseLayers, "sha256:app"], baseLayers)).toEqual([])
	})

	it("fails an image built on other layers", () => {
		expect(checkBaseLayers(base, ["sha256:1", "sha256:x", "sha256:app"], baseLayers)).toHaveLength(1)
		expect(checkBaseLayers(base, ["sha256:1"], baseLayers)).toHaveLength(1)
	})

	it("fails without a digest or without base layers", () => {
		expect(checkBaseLayers({ ...base, digest: null }, baseLayers, baseLayers)).toHaveLength(1)
		expect(checkBaseLayers(base, baseLayers, undefined)).toHaveLength(1)
	})
})
