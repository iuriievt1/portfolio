import { describe, expect, it } from "vitest"
import { bannedPackagesOf, checkEntryPoints, checkInventory, lockfilePackages, parsePnpmDirectory } from "../inventory"

const lockfile = lockfilePackages(
	`lockfileVersion: '9.0'\n\npackages:\n\n  '@nestjs/common@11.2.5':\n    resolution: {}\n\n  zod@4.6.5:\n    resolution: {}\n\nsnapshots:\n\n  other@1.0.0: {}\n`,
)

const base = {
	present: ["@ansora/contracts", "@ansora/server-api"],
	allowed: ["@ansora/contracts", "@ansora/server-api", "@ansora/mobile"],
	required: ["@ansora/contracts", "@ansora/server-api"],
	installed: ["@nestjs+common@11.2.5_rxjs@7.8.2", "zod@4.6.5", "node_modules", "lock.yaml"],
	lockfile,
	banned: ["@medplum/*"],
}

describe("B2 image inventory", () => {
	it("reads package keys from the lockfile only", () => {
		expect([...lockfile]).toEqual(["@nestjs/common@11.2.5", "zod@4.6.5"])
	})

	it("maps pnpm directories back to name and version", () => {
		expect(parsePnpmDirectory("@nestjs+common@11.2.5_rxjs@7.8.2")).toBe("@nestjs/common@11.2.5")
		expect(parsePnpmDirectory("zod@4.6.5")).toBe("zod@4.6.5")
		expect(parsePnpmDirectory("string_decoder@1.3.0")).toBe("string_decoder@1.3.0")
		expect(parsePnpmDirectory("@types+node@24.10.1")).toBe("@types/node@24.10.1")
		expect(parsePnpmDirectory("node_modules")).toBeUndefined()
	})

	it("passes a clean image", () => {
		expect(checkInventory(base)).toEqual([])
	})

	it("fails on a workspace package outside the profile", () => {
		expect(checkInventory({ ...base, present: [...base.present, "@ansora/canary"] })).toHaveLength(1)
	})

	it("fails when a package of the server closure is missing", () => {
		expect(checkInventory({ ...base, present: ["@ansora/contracts"] })).toHaveLength(1)
	})

	it("fails on a package that is not in the lockfile", () => {
		expect(checkInventory({ ...base, installed: [...base.installed, "left-pad@1.3.0"] })).toHaveLength(1)
	})

	it("fails on a banned package", () => {
		const lock = new Set([...lockfile, "@medplum/core@5.0.0"])
		expect(
			checkInventory({ ...base, lockfile: lock, installed: [...base.installed, "@medplum+core@5.0.0"] }),
		).toHaveLength(1)
	})

	it("ADR-054 bod 3 bans @medplum/* in an image whose profile carries no clinical record adapter", () => {
		expect(bannedPackagesOf([], ["@ansora/vulna-adapter-oidc"])).toEqual(["@medplum/*"])
	})

	it("ADR-054 bod 3 allows @medplum/* once the profile carries the clinical record adapter", () => {
		expect(bannedPackagesOf([], ["@ansora/vulna-adapter-clinical-record-medplum"])).toEqual([])
	})
})

describe("B2 entry points of vendored packages ADR-017", () => {
	it("finds the entry point of each vendored package in the image", () => {
		const files = ["/app/vendor/dimse/package.json", "/app/vendor/dimse/src/index.js", "/app/vendor/data/package.json"]

		expect(
			checkEntryPoints(files, [
				{ name: "@veevoy/dimse", path: "/app/vendor/dimse/src/index.js" },
				{ name: "@veevoy/data", path: "/app/vendor/data/src/index.js" },
			]),
		).toEqual([
			{
				gate: "B2",
				what: "@veevoy/data",
				reason: "entry point /app/vendor/data/src/index.js is missing from the image",
			},
		])
	})
})
