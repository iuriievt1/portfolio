import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { type Component, npmPurl } from "../cyclonedx"
import { forkOriginOf, type VendoredFork, withForkPedigrees } from "../pedigree"

const ROOT = join(__dirname, "../../../..")
const DIMSE = "@veevoy/dcmjs-dimse"
const DIMSE_PEDIGREE = "vendor/dcmjs-dimse/PEDIGREE.md"
const DIMSE_COMMIT = "5ab47939b4b88b6431de13ca20ed53816569b74e"
const DIMSE_REPOSITORY = "https://github.com/PantelisGeorgiadis/dcmjs-dimse"
const OTHER = "pako"

function pedigreeOf(path: string): string {
	return readFileSync(join(ROOT, path), "utf8")
}

const DIMSE_MARKDOWN = pedigreeOf(DIMSE_PEDIGREE)

function npm(name: string, version: string): Component {
	return { "bom-ref": npmPurl(name, version), type: "library", name, version, purl: npmPurl(name, version) }
}

function dimseFork(markdown: string | undefined): VendoredFork {
	return { name: DIMSE, pedigree: DIMSE_PEDIGREE, markdown }
}

describe("B5 pedigree of the vendored forks ✓ ADR-017", () => {
	it("reads the upstream of both forks from their pedigree files", () => {
		expect(forkOriginOf(DIMSE_MARKDOWN)).toEqual({
			repository: DIMSE_REPOSITORY,
			commit: DIMSE_COMMIT,
			name: "dcmjs-dimse",
			version: "0.3.4",
		})
		expect(forkOriginOf(pedigreeOf("vendor/dcmjs/PEDIGREE.md"))).toEqual({
			repository: "https://github.com/dcmjs-org/dcmjs",
			commit: "6da1c8153e007723e50365c710711d848d5b65a8",
			name: "dcmjs",
			version: "0.52.2",
		})
	})

	it("reads a scoped upstream package", () => {
		const markdown = [
			"| Upstream | https://github.com/example/tool |",
			`| Commit | \`${"a".repeat(40)}\` (1. 1. 2026) |`,
			"| Balíček npm | `@example/tool@1.2.3`, `gitHead` = commit tagu |",
		].join("\n")

		expect(forkOriginOf(markdown)).toMatchObject({ name: "@example/tool", version: "1.2.3" })
	})

	it("names veevoy the supplier of the fork and its upstream the ancestor, other components stay as they are", () => {
		const fork = npm(DIMSE, "0.3.4-veevoy.16")
		const other = npm(OTHER, "2.1.0")
		const guessedCpe = "cpe:2.3:a:\\@veevoy\\/dcmjs-dimse:\\@veevoy\\/dcmjs-dimse:0.3.4-veevoy.16:*:*:*:*:*:*:*"

		const result = withForkPedigrees([{ ...fork, cpe: guessedCpe }, other], [dimseFork(DIMSE_MARKDOWN)])

		expect(result.findings).toEqual([])
		expect(result.components).toEqual([
			{
				...fork,
				supplier: { name: "veevoy" },
				pedigree: {
					ancestors: [{ type: "library", name: "dcmjs-dimse", version: "0.3.4", purl: "pkg:npm/dcmjs-dimse@0.3.4" }],
					commits: [{ uid: DIMSE_COMMIT, url: `${DIMSE_REPOSITORY}/commit/${DIMSE_COMMIT}` }],
					notes: `Modifications of the fork are listed in ${DIMSE_PEDIGREE}`,
				},
			},
			other,
		])
	})

	it("CAP-029-S02 fails a fork the image SBOM does not carry", () => {
		const result = withForkPedigrees([npm(OTHER, "2.1.0")], [dimseFork(DIMSE_MARKDOWN)])

		expect(result.findings).toEqual([{ gate: "B5", what: DIMSE, reason: "vendored fork missing from the image SBOM" }])
	})

	it("CAP-029-S02 fails a fork copy whose version does not derive from the upstream of its pedigree", () => {
		const result = withForkPedigrees(
			[npm(DIMSE, "0.3.4-veevoy.16"), npm(DIMSE, "0.3.5-veevoy.1")],
			[dimseFork(DIMSE_MARKDOWN)],
		)

		expect(result.findings).toEqual([
			{
				gate: "B5",
				what: `${DIMSE}@0.3.5-veevoy.1`,
				reason: "fork version does not derive from dcmjs-dimse@0.3.4 of its pedigree",
			},
		])
		expect(result.components.map((component) => component.pedigree)).toEqual([undefined, undefined])
	})

	it("CAP-029-S02 fails a missing or incomplete pedigree file", () => {
		const fork = npm(DIMSE, "0.3.4-veevoy.16")
		const incomplete = {
			gate: "B5",
			what: DIMSE_PEDIGREE,
			reason: "pedigree lacks the upstream GitHub repository, commit or npm package",
		}
		const withoutCommit = DIMSE_MARKDOWN.replace(/^\| Commit \|.*$/m, "")
		const elsewhere = DIMSE_MARKDOWN.replace(DIMSE_REPOSITORY, "https://gitlab.com/PantelisGeorgiadis/dcmjs-dimse")

		expect(withForkPedigrees([fork], [dimseFork(undefined)]).findings).toEqual([
			{ gate: "B5", what: DIMSE_PEDIGREE, reason: "pedigree file missing" },
		])
		expect(withForkPedigrees([fork], [dimseFork(withoutCommit)]).findings).toEqual([incomplete])
		expect(withForkPedigrees([fork], [dimseFork(elsewhere)]).findings).toEqual([incomplete])
	})
})
