import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, posix, relative } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { imageEntryPoint, imageWorkspaceManifests, serverClosure, workspaceManifests } from "../workspace"

// ADR-033 bod 6, ADR-017, ADR-003 ř. 26

const SERVER_PROCESSES = ["process:api", "process:worker", "process:shared"]
const IMAGE_APP_DIRECTORY = "/app"
const MANIFEST = "package.json"

describe("workspace projects", () => {
	let root: string | undefined

	afterEach(() => {
		if (root !== undefined) {
			rmSync(root, { recursive: true, force: true })
			root = undefined
		}
	})

	function project(directory: string, manifest: Record<string, unknown>): void {
		mkdirSync(join(root ?? "", directory), { recursive: true })
		writeFileSync(join(root ?? "", directory, "package.json"), JSON.stringify(manifest))
	}

	it("finds the projects of apps, libs and vendor and takes the server closure through vendored packages", () => {
		root = mkdtempSync(join(tmpdir(), "workspace-"))
		project("apps/worker", {
			name: "@ansora/server-worker",
			nx: { tags: ["process:worker"] },
			dependencies: { "@ansora/adapter": "workspace:*" },
		})
		project("apps/mobile", { name: "@ansora/mobile", nx: { tags: ["process:mobile"] } })
		project("libs/modules/vulna/adapter", {
			name: "@ansora/adapter",
			dependencies: { "@veevoy/dimse": "workspace:*", lodash: "4.17.21" },
		})
		project("vendor/dimse", {
			name: "@veevoy/dimse",
			main: "src/index.js",
			dependencies: { "@veevoy/data": "workspace:*" },
		})
		project("vendor/data", { name: "@veevoy/data", exports: { ".": "./src/index.js" } })
		const manifests = workspaceManifests(root)

		expect([...manifests.keys()].sort()).toEqual([
			"@ansora/adapter",
			"@ansora/mobile",
			"@ansora/server-worker",
			"@veevoy/data",
			"@veevoy/dimse",
		])
		expect(serverClosure(manifests, ["@ansora/server-worker", "@ansora/mobile"], SERVER_PROCESSES)).toEqual([
			"@ansora/adapter",
			"@ansora/server-worker",
			"@veevoy/data",
			"@veevoy/dimse",
		])
		expect(imageEntryPoint(manifests.get("@veevoy/dimse") ?? { name: "", directory: "" }, root)).toBe(
			"/app/vendor/dimse/src/index.js",
		)
		expect(imageEntryPoint(manifests.get("@veevoy/data") ?? { name: "", directory: "" }, root)).toBe(
			"/app/vendor/data/src/index.js",
		)
	})

	it("ADR-017 takes the manifests of vendored packages in the image as workspace manifests", () => {
		expect(
			imageWorkspaceManifests([
				"/app/package.json",
				"/app/tools/package.json",
				"/app/vendor/dcmjs-dimse/package.json",
				"/app/libs/modules/vulna/adapter-dicom-dimse/package.json",
			]),
		).toEqual(["/app/libs/modules/vulna/adapter-dicom-dimse/package.json", "/app/vendor/dcmjs-dimse/package.json"])
	})

	it("ADR-033 bod 6 reads a manifest inside a workspace package as part of that package, as workspaceManifests does", () => {
		expect(
			imageWorkspaceManifests([
				"/app/vendor/postgres/package.json",
				"/app/vendor/postgres/cjs/package.json",
				"/app/apps/vulna-server-api/package.json",
				"/app/apps/vulna-server-api/node_modules/express/package.json",
				"/app/libs/core/server/package.json",
				"/app/libs/core/server/dist/package.json",
			]),
		).toEqual([
			"/app/apps/vulna-server-api/package.json",
			"/app/libs/core/server/package.json",
			"/app/vendor/postgres/package.json",
		])
	})

	it("ADR-033 bod 6 leaves out a manifest under node_modules within the depth of a root", () => {
		expect(imageWorkspaceManifests(["/app/libs/node_modules/lodash/package.json"])).toEqual([])
	})

	it("ADR-033 bod 6 finds in the image the same manifests as workspaceManifests in the tree", () => {
		root = mkdtempSync(join(tmpdir(), "workspace-"))
		project("apps/worker", { name: "@ansora/server-worker" })
		project("apps/worker/node_modules/express", { name: "express" })
		project("libs/core/server", { name: "@ansora/core-server" })
		project("libs/core/server/dist", { type: "commonjs" })
		project("libs/node_modules/lodash", { name: "lodash" })
		project("vendor/postgres", { name: "@veevoy/postgres" })
		project("vendor/postgres/cjs", { type: "commonjs" })
		const treeRoot = root
		const imageFiles = readdirSync(treeRoot, { recursive: true, encoding: "utf8" })
			.filter((file) => posix.basename(file) === MANIFEST)
			.map((file) => posix.join(IMAGE_APP_DIRECTORY, file))
		const hostManifests = [...workspaceManifests(treeRoot).values()]
			.map((manifest) => posix.join(IMAGE_APP_DIRECTORY, relative(treeRoot, manifest.directory), MANIFEST))
			.sort()

		expect(imageWorkspaceManifests(imageFiles)).toEqual(hostManifests)
		expect(hostManifests).toEqual([
			"/app/apps/worker/package.json",
			"/app/libs/core/server/package.json",
			"/app/vendor/postgres/package.json",
		])
	})

	it("ADR-017 takes the entry point a require of the package loads from conditional exports", () => {
		const directory = "/repo/vendor/postgres"
		const conditions = { types: "./types/index.d.ts", import: "./src/index.js", default: "./cjs/src/index.js" }

		expect(imageEntryPoint({ name: "p", directory, main: "main.js", exports: conditions }, "/repo")).toBe(
			"/app/vendor/postgres/cjs/src/index.js",
		)
		expect(
			imageEntryPoint(
				{ name: "p", directory, main: "main.js", exports: { ".": { import: "./esm.js", require: "./cjs.js" } } },
				"/repo",
			),
		).toBe("/app/vendor/postgres/cjs.js")
	})
})
