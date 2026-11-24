import { describe, expect, it } from "vitest"
import { allowlistFromManifests, checkAllowlist } from "../egress"

const manifests = [
	{ name: "dimse", processes: ["worker"], outboundCommunication: [{ target: "pacs" }] },
	{ name: "oidc", processes: ["api"], outboundCommunication: [{ target: "identity-provider" }] },
	{ name: "syslog", processes: ["worker"], outboundCommunication: [{ target: "log-management" }] },
	{ name: "binary", processes: ["api", "worker"], outboundCommunication: [] },
]

describe("B3 egress allowlist", () => {
	it("derives the allowlist per process from the manifests", () => {
		expect(allowlistFromManifests(manifests)).toEqual({
			api: ["database", "identity-provider"],
			worker: ["database", "log-management", "pacs"],
		})
	})

	it("passes the derived allowlist", () => {
		expect(checkAllowlist(allowlistFromManifests(manifests))).toEqual([])
	})

	it("fails when the API process could reach the PACS", () => {
		expect(checkAllowlist({ api: ["database", "pacs"], worker: ["database"] })).toHaveLength(1)
	})

	it("fails on a target outside the customer's systems", () => {
		expect(checkAllowlist({ api: ["database"], worker: ["database", "vendor-cloud"] })).toHaveLength(1)
	})

	it("ADR-054 bod 3 lets the API process reach the clinical record store", () => {
		expect(checkAllowlist({ api: ["database", "clinical-record-store"], worker: ["database"] })).toEqual([])
	})
})
