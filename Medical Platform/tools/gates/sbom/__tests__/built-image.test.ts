import { describe, expect, it } from "vitest"
import { type BuiltImageFacts, builtImageSbom, parseServerVersion } from "../built-image"

const now = new Date("2026-10-07T12:00:00Z")
const generator = { type: "application" as const, name: "@ansora/tools", version: "0.1.0" }
const entry = {
	name: "clinical-record-cache",
	dockerfile: "deploy/images/valkey/Dockerfile",
	image: "ansora-vulna-valkey",
	baseImage: { image: "gcr.io/distroless/static-debian13", digest: `sha256:${"b".repeat(64)}` },
	sourceImage: {
		image: "valkey/valkey",
		version: "9.1.2-alpine",
		digest: `sha256:${"c".repeat(64)}`,
		license: "BSD-3-Clause",
	},
}
const facts: BuiltImageFacts = {
	carried: [
		{ file: "/usr/lib/ld-musl-aarch64.so.1", sourceFile: "/lib/ld-musl-aarch64.so.1" },
		{ file: "/usr/lib/libssl.so.3", sourceFile: "/usr/lib/libssl.so.3" },
		{ file: "/usr/local/bin/valkey-server", sourceFile: "/usr/local/bin/valkey-server" },
	],
	owners: new Map([
		["/lib/ld-musl-aarch64.so.1", "musl"],
		["/usr/lib/libssl.so.3", "libssl3"],
	]),
	packages: [
		{ name: "musl", version: "1.2.6-r2", architecture: "aarch64", license: "MIT" },
		{ name: "libssl3", version: "3.5.8-r0", architecture: "aarch64", license: "Apache-2.0" },
	],
	server: { version: "9.1.2", allocator: { name: "jemalloc", version: "5.3.0" } },
	executables: ["/usr/local/bin/valkey-server", "/usr/lib/libssl.so.3", "/usr/lib/ld-musl-aarch64.so.1"],
}

describe("version banner of the server", () => {
	it("reads the version and the bundled allocator", () => {
		expect(parseServerVersion("Valkey server v=9.1.2 sha=00000000:1 malloc=jemalloc-5.3.0 bits=64")).toEqual({
			version: "9.1.2",
			allocator: { name: "jemalloc", version: "5.3.0" },
		})
		expect(parseServerVersion("nothing")).toBeUndefined()
	})
})

// vydani-sbom-a-brany.md 4.4, CAP-029-R30, CAP-029-S23
describe("SBOM section of a built image", () => {
	it("names the base, the source image, the carried packages and the application as our build", () => {
		const { bom, findings } = builtImageSbom(entry, "1.0.0", generator, "Apache-2.0", facts, now)
		expect(findings).toEqual([])
		expect(bom.metadata.component.name).toBe("Ansora Vulna clinical-record-cache")
		expect(bom.metadata.component.manufacturer).toEqual({ name: "veevoy" })
		expect(bom.components.map((component) => `${component.name}@${component.version}`)).toEqual([
			`gcr.io/distroless/static-debian13@sha256:${"b".repeat(64)}`,
			`valkey/valkey@sha256:${"c".repeat(64)}`,
			"libssl3@3.5.8-r0",
			"musl@1.2.6-r2",
			"valkey@9.1.2",
			"jemalloc@5.3.0",
		])
		expect(bom.components[1]?.properties).toEqual([{ name: "ansora:role", value: "source-image" }])
		expect(bom.components[4]?.properties).toEqual([
			{ name: "syft:location:0:path", value: "/usr/local/bin/valkey-server" },
		])
		expect(bom.components[4]?.licenses).toEqual([{ license: { id: "BSD-3-Clause" } }])
	})

	it("fails on an executable outside the carried files, an unknown package and an unreadable version", () => {
		const { findings } = builtImageSbom(
			entry,
			"1.0.0",
			generator,
			"Apache-2.0",
			{
				...facts,
				packages: facts.packages.filter((found) => found.name !== "musl"),
				server: undefined,
				executables: [...facts.executables, "/usr/local/bin/helper"],
			},
			now,
		)
		expect(findings.map((finding) => `${finding.gate} ${finding.what}`)).toEqual([
			"B5 clinical-record-cache: musl",
			"B5 clinical-record-cache: valkey",
			"B8 clinical-record-cache: /usr/local/bin/helper",
		])
	})
})
