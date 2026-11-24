import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import type { ImageTree } from "../../image/image-fs"
import { type Component, newBom } from "../cyclonedx"
import { checkOwnership, dpkgOwnedFiles, dpkgPackages, isElf, sbomLocations } from "../ownership"

const files = new Map<string, string>([
	["/var/lib/dpkg/status.d/libc6", "Package: libc6\nVersion: 2.41-12+deb13u4\nArchitecture: arm64\n"],
	[
		"/var/lib/dpkg/status.d/libc6.md5sums",
		"abc  usr/lib/aarch64-linux-gnu/libc.so.6\ndef  usr/share/doc/libc6/copyright\n",
	],
])
const tree: ImageTree = { root: "", files: [...files.keys()], read: (path) => files.get(path) ?? "", dispose: () => {} }

const node: Component = {
	"bom-ref": "pkg:generic/node@24.21.0",
	type: "application",
	name: "node",
	version: "24.21.0",
	properties: [{ name: "syft:location:0:path", value: "/nodejs/bin/node" }],
}
const image = newBom(
	{ "bom-ref": "p", type: "container", name: "Ansora Vulna Server", version: "1" },
	[],
	[node],
	new Date(0),
)
const owned = dpkgOwnedFiles(tree)
const locations = sbomLocations(image)
const npm = new Set(["sharp@0.34.0"])

describe("B8 file ownership", () => {
	const directory = mkdtempSync(join(tmpdir(), "vulna-elf-"))
	afterAll(() => rmSync(directory, { recursive: true, force: true }))

	it("recognises ELF files by their magic bytes", () => {
		writeFileSync(join(directory, "elf"), Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]))
		writeFileSync(join(directory, "text"), "#!/bin/sh\n")
		writeFileSync(join(directory, "short"), Buffer.from([0x7f]))
		symlinkSync(join(directory, "elf"), join(directory, "link"))
		expect(isElf(directory, "/elf")).toBe(true)
		expect(isElf(directory, "/link")).toBe(false)
		expect(isElf(directory, "/text")).toBe(false)
		expect(isElf(directory, "/short")).toBe(false)
	})

	it("reads dpkg packages and owned files from status.d", () => {
		expect(dpkgPackages(tree)).toEqual([{ name: "libc6", version: "2.41-12+deb13u4" }])
		expect([...owned]).toEqual(["/usr/lib/aarch64-linux-gnu/libc.so.6", "/usr/share/doc/libc6/copyright"])
	})

	it("accepts executables owned by dpkg, located by the SBOM or inside an SBOM npm package", () => {
		const executables = [
			"/usr/lib/aarch64-linux-gnu/libc.so.6",
			"/nodejs/bin/node",
			"/app/node_modules/.pnpm/sharp@0.34.0/node_modules/sharp/build/sharp.node",
		]
		expect(checkOwnership(executables, owned, locations, npm)).toEqual([])
	})

	it("names an executable that no SBOM component covers", () => {
		expect(checkOwnership(["/usr/bin/tesseract"], owned, locations, npm)).toEqual([
			{ gate: "B8", what: "/usr/bin/tesseract", reason: "executable without an SBOM component" },
		])
		expect(
			checkOwnership(["/app/node_modules/.pnpm/left-pad@1.0.0/node_modules/left-pad/a.node"], owned, locations, npm),
		).toHaveLength(1)
	})
})
