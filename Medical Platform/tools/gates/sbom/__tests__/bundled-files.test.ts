import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { type BundledFile, bundledFileComponents } from "../bundled-files"

const ROOT = join(__dirname, "../../../..")
const ASSETS = "/app/apps/vulna-admin/dist/assets"
const FONT = `${ASSETS}/InterVariable-DiVDrmQJ.woff2`
const SHA256 = "a".repeat(64)
const SOURCE_SHA256 = "b".repeat(64)

const inter: BundledFile = {
	name: "inter",
	version: "4.1",
	purl: "pkg:github/rsms/inter@v4.1",
	cpe: "cpe:2.3:a:rsms:inter:4.1:*:*:*:*:*:*:*",
	license: "OFL-1.1",
	source: "https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip",
	source_sha256: SOURCE_SHA256,
	location: `${ASSETS}/InterVariable-*.woff2`,
	sha256: SHA256,
}

const hashes = (file: string): string | undefined => (file === FONT ? SHA256 : undefined)

describe("B5 files bundled into the image ✓ NAB-662, vydani-sbom-a-brany.md 4.2", () => {
	it("records the font of the administration with its license, release and hash", () => {
		const result = bundledFileComponents([inter], [`${ASSETS}/index-Cq1.js`, FONT], hashes)

		expect(result.findings).toEqual([])
		expect(result.components).toEqual([
			{
				"bom-ref": "pkg:github/rsms/inter@v4.1",
				type: "file",
				name: "inter",
				version: "4.1",
				purl: "pkg:github/rsms/inter@v4.1",
				cpe: "cpe:2.3:a:rsms:inter:4.1:*:*:*:*:*:*:*",
				licenses: [{ license: { id: "OFL-1.1" } }],
				hashes: [{ alg: "SHA-256", content: SHA256 }],
				externalReferences: [
					{ type: "source-distribution", url: inter.source, hashes: [{ alg: "SHA-256", content: SOURCE_SHA256 }] },
				],
				properties: [{ name: "syft:location:0:path", value: FONT }],
			},
		])
	})

	it("CAP-029-S02 fails a file missing from the image or matched more than once", () => {
		expect(
			bundledFileComponents([inter], [`${ASSETS}/index-Cq1.js`, `${ASSETS}/InterVariable-old/a.woff2`], hashes)
				.findings,
		).toEqual([{ gate: "B5", what: "inter@4.1", reason: `0 files in the image match ${inter.location}` }])
		expect(bundledFileComponents([inter], [FONT, `${ASSETS}/InterVariable-Xy.woff2`], hashes).findings).toEqual([
			{ gate: "B5", what: "inter@4.1", reason: `2 files in the image match ${inter.location}` },
		])
	})

	it("CAP-029-S02 fails a file that is not the recorded release file", () => {
		expect(bundledFileComponents([inter], [FONT], () => SOURCE_SHA256).findings).toEqual([
			{ gate: "B5", what: FONT, reason: "bundled file is not the recorded release file of inter@4.1" },
		])
	})

	it("CAP-029-S02 fails an entry without its license", () => {
		const { license: _license, ...unlicensed } = inter

		expect(bundledFileComponents([unlicensed], [FONT], hashes).findings).toEqual([
			{ gate: "B5", what: "inter@4.1", reason: "bundled file entry without purl, cpe, license, source or hash" },
		])
	})

	it("keeps the recorded font hash equal to the font the administration bundles", () => {
		const recorded = JSON.parse(readFileSync(join(ROOT, "quality/vydani/sbom-files.json"), "utf8")) as BundledFile[]
		const font = readFileSync(join(ROOT, "apps/vulna-admin/src/assets/fonts/InterVariable.woff2"))

		expect(recorded.find((entry) => entry.name === "inter")?.sha256).toBe(
			createHash("sha256").update(font).digest("hex"),
		)
	})
})
