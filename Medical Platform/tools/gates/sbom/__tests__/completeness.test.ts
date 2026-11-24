import { describe, expect, it } from "vitest"
import {
	checkBuildTools,
	checkDirectDependencies,
	checkImageCompleteness,
	type ImageFacts,
	type SupplementEntry,
	supplementComponents,
} from "../completeness"
import { type Component, newBom, npmPurl } from "../cyclonedx"

const digest = `sha256:${"c".repeat(64)}`
const product: Component = { "bom-ref": "product", type: "container", name: "Ansora Vulna Server", version: "1.0.0" }

const node: Component = {
	"bom-ref": "pkg:generic/node@24.21.0",
	type: "application",
	name: "node",
	version: "24.21.0",
	purl: "pkg:generic/node@24.21.0",
	cpe: "cpe:2.3:a:nodejs:node.js:24.21.0:*:*:*:*:*:*:*",
}
const libc: Component = {
	"bom-ref": "pkg:deb/debian/libc6@2.41-12",
	type: "library",
	name: "libc6",
	version: "2.41-12+deb13u4",
	purl: "pkg:deb/debian/libc6@2.41-12%2Bdeb13u4?arch=arm64",
}
const rxjs: Component = {
	"bom-ref": npmPurl("rxjs", "7.8.2"),
	type: "library",
	name: "rxjs",
	version: "7.8.2",
	purl: npmPurl("rxjs", "7.8.2"),
}
const base: Component = {
	"bom-ref": "base",
	type: "container",
	name: "gcr.io/distroless/nodejs24-debian13",
	version: digest,
}

const facts: ImageFacts = {
	osPackages: [{ name: "libc6", version: "2.41-12+deb13u4" }],
	npmPackages: ["rxjs@7.8.2"],
	runtime: { name: "node", version: "24.21.0" },
	baseDigest: digest,
}

function bom(components: Component[]) {
	return newBom(product, [], components, new Date(0))
}

describe("B5 sbom completeness", () => {
	it("passes when os packages, lockfile packages, runtime and base digest are all in the SBOM", () => {
		expect(checkImageCompleteness(bom([node, libc, rxjs, base]), facts)).toEqual([])
	})

	it("CAP-029-S02 names the runtime missing from the SBOM", () => {
		const findings = checkImageCompleteness(bom([libc, rxjs, base]), facts)
		expect(findings).toEqual([{ gate: "B5", what: "node@24.21.0", reason: "runtime missing from the SBOM" }])
	})

	it("fails a runtime entry without purl or cpe", () => {
		const findings = checkImageCompleteness(bom([{ ...node, cpe: undefined }, libc, rxjs, base]), facts)
		expect(findings.map((finding) => finding.reason)).toEqual(["runtime without purl or cpe"])
	})

	it("names a missing os package and a missing lockfile package", () => {
		const findings = checkImageCompleteness(bom([node, base]), facts)
		expect(findings.map((finding) => finding.what)).toEqual(["libc6@2.41-12+deb13u4", "rxjs@7.8.2"])
	})

	it("fails when the base image digest is not in the SBOM", () => {
		expect(checkImageCompleteness(bom([node, libc, rxjs]), facts)).toEqual([
			{ gate: "B7", what: digest, reason: "base image digest missing from the SBOM" },
		])
		expect(checkImageCompleteness(bom([node, libc, rxjs, base]), { ...facts, baseDigest: undefined })).toHaveLength(1)
	})
})

describe("B5 manual SBOM entries", () => {
	const source = "https://github.com/tesseract-ocr/tesseract/archive/refs/tags/5.5.4.tar.gz"
	const sourceSha256 = "a".repeat(64)
	const sourceChecksums = new Map([["tesseract-5.5.4.tar.gz", sourceSha256]])
	const complete = {
		name: "tesseract",
		version: "5.5.4",
		type: "application" as const,
		purl: "pkg:github/tesseract-ocr/tesseract@5.5.4",
		cpe: "cpe:2.3:a:tesseract_project:tesseract:5.5.4:*:*:*:*:*:*:*",
		license: "Apache-2.0",
		source,
		description: "built by veevoy",
		location: "/usr/local/bin/tesseract",
	}

	function reasonsOf(entry: SupplementEntry): string[] {
		return supplementComponents([entry], sourceChecksums).findings.map((finding) => finding.reason)
	}

	it("ADR-011 ř. 49 turns a complete entry into a component with its origin", () => {
		const { components, findings } = supplementComponents([complete], sourceChecksums)

		expect(findings).toEqual([])
		expect(components).toEqual([
			{
				"bom-ref": complete.purl,
				type: "application",
				name: "tesseract",
				version: "5.5.4",
				purl: complete.purl,
				cpe: complete.cpe,
				description: "built by veevoy",
				licenses: [{ license: { id: "Apache-2.0" } }],
				externalReferences: [
					{ type: "source-distribution", url: source, hashes: [{ alg: "SHA-256", content: sourceSha256 }] },
				],
				properties: [{ name: "syft:location:0:path", value: "/usr/local/bin/tesseract" }],
			},
		])
	})

	it.each(["purl", "cpe", "license", "source"] as const)("CAP-029-S02 refuses an entry without %s", (field) => {
		expect(reasonsOf({ ...complete, [field]: undefined })).toEqual([
			"manual SBOM entry without purl, cpe, license or source",
		])
	})

	it("CAP-029-S02 refuses an entry whose purl names another version", () => {
		expect(reasonsOf({ ...complete, purl: "pkg:github/tesseract-ocr/tesseract@5.5.3" })).toEqual([
			"manual SBOM entry whose purl or cpe names another version",
		])
	})

	it("CAP-029-S02 refuses an entry whose cpe names another version", () => {
		expect(reasonsOf({ ...complete, cpe: "cpe:2.3:a:tesseract_project:tesseract:5.5.3:*:*:*:*:*:*:*" })).toEqual([
			"manual SBOM entry whose purl or cpe names another version",
		])
	})

	it("ADR-011 ř. 49 refuses an entry whose source archive has no recorded SHA-256", () => {
		expect(supplementComponents([complete], new Map()).findings.map((finding) => finding.reason)).toEqual([
			"manual SBOM entry without a recorded source archive",
		])
	})
})

describe("B5 build tools", () => {
	const nx: Component = {
		"bom-ref": npmPurl("nx", "23.2.1"),
		type: "library",
		name: "nx",
		version: "23.2.1",
		purl: npmPurl("nx", "23.2.1"),
	}
	const native: Component = {
		...nx,
		"bom-ref": npmPurl("@nx/nx-linux-x64-gnu", "23.2.1"),
		name: "@nx/nx-linux-x64-gnu",
	}
	const typescript: Component = {
		...nx,
		"bom-ref": npmPurl("typescript", "5.9.3"),
		name: "typescript",
		version: "5.9.3",
	}
	const tools = {
		nx: "23.2.1",
		plugins: new Map([["@nx/vite", "23.2.1"]]),
		releaseTools: new Map([["typescript", "5.9.3"]]),
		native: new Map([["@nx/nx-linux-x64-gnu", "23.2.1"]]),
	}
	const plugin: Component = { ...nx, "bom-ref": npmPurl("@nx/vite", "23.2.1"), name: "@nx/vite" }

	it("passes when Nx, its plugins, the other build tools and the native binaries are in the SBOM", () => {
		expect(checkBuildTools(bom([nx, plugin, typescript, native]), tools)).toEqual([])
	})

	it("CAP-029-S10 names the Nx plugin missing from the SBOM", () => {
		expect(checkBuildTools(bom([nx, typescript, native]), tools)).toEqual([
			{ gate: "B5", what: "@nx/vite@23.2.1", reason: "Nx plugin missing from the SBOM" },
		])
	})

	it("fails on a missing native binary or on Nx without a locked version", () => {
		expect(checkBuildTools(bom([nx, plugin, typescript]), tools)).toEqual([
			{
				gate: "B5",
				what: "@nx/nx-linux-x64-gnu@23.2.1",
				reason: "native binary of a build tool missing from the SBOM",
			},
		])
		expect(checkBuildTools(bom([nx, plugin, typescript, native]), { ...tools, nx: "" })).toHaveLength(1)
	})

	it("fails on a build tool of quality/soup.yaml missing from the SBOM or absent from the lockfile", () => {
		expect(checkBuildTools(bom([nx, plugin, native]), tools)).toEqual([
			{ gate: "B5", what: "typescript@5.9.3", reason: "build tool missing from the SBOM" },
		])
		expect(
			checkBuildTools(bom([nx, plugin, typescript, native]), { ...tools, releaseTools: new Map([["vitest", ""]]) }),
		).toEqual([{ gate: "B5", what: "vitest@", reason: "build tool missing from the SBOM" }])
	})
})

describe("B5 mobile direct dependencies", () => {
	it("names a direct dependency missing from the SBOM", () => {
		const direct = new Map([["expo", "57.0.23"]])
		expect(checkDirectDependencies(bom([rxjs]), direct)).toEqual([
			{ gate: "B5", what: "expo@57.0.23", reason: "direct dependency missing from the SBOM" },
		])
		expect(checkDirectDependencies(bom([rxjs]), new Map([["rxjs", "7.8.2"]]))).toEqual([])
	})
})
