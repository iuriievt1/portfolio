import { describe, expect, it } from "vitest"
import { canaries, checkCanary } from "../canary"

const packages = [
	{ name: "@ansora/vulna-domain", tags: ["layer:domain"] },
	{ name: "@ansora/vulna-adapter-syslog", tags: ["layer:adapter"] },
	{ name: "@ansora/synthetic-domain", tags: ["layer:domain"] },
	{ name: "@ansora/synthetic-adapter-null", tags: ["layer:adapter"] },
]
const profile = ["@ansora/vulna-domain", "@ansora/vulna-adapter-syslog"]
const found = canaries(packages, profile)

describe("B1 synthetic module and adapter", () => {
	it("finds the packages outside the profile", () => {
		expect(found).toEqual({ modules: ["@ansora/synthetic-domain"], adapters: ["@ansora/synthetic-adapter-null"] })
	})

	it("passes when neither is in the image", () => {
		expect(checkCanary(profile, ["rxjs@7.8.2"], found)).toEqual([])
	})

	it("fails when a synthetic package is in the image", () => {
		expect(checkCanary([...profile, "@ansora/synthetic-domain"], [], found)).toEqual([
			{ gate: "B1", what: "@ansora/synthetic-domain", reason: "synthetic package found in the image" },
		])
		expect(checkCanary(profile, ["@ansora/synthetic-adapter-null@0.0.0"], found)).toHaveLength(1)
	})

	it("fails when the workspace has nothing to prove isolation with", () => {
		expect(checkCanary(profile, [], { modules: [], adapters: [] })).toHaveLength(2)
	})
})
