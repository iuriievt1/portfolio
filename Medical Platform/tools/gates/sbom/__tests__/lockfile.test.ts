import { describe, expect, it } from "vitest"
import { closure, parseLockfile, stripPeers } from "../lockfile"
import { buildTools, directDependencies, workspaceClosure } from "../lockfile-part"

const lockfile = `lockfileVersion: '9.0'

importers:

  .:
    devDependencies:
      nx:
        specifier: 23.2.1
        version: 23.2.1
      '@nx/vite':
        specifier: 23.2.1
        version: 23.2.1(nx@23.2.1)
      '@biomejs/biome':
        specifier: 2.5.13
        version: 2.5.13
      typescript:
        specifier: 5.9.3
        version: 5.9.3

  apps/vulna-mobile:
    dependencies:
      '@ansora/contracts':
        specifier: workspace:*
        version: link:../../libs/contracts
      expo:
        specifier: ~57.0.23
        version: 57.0.23(react@19.2.3)
    devDependencies:
      typescript:
        specifier: ^5.9.3
        version: 5.9.3

  libs/contracts:
    dependencies:
      zod:
        specifier: ^4.6.5
        version: 4.6.5
    devDependencies:
      vitest:
        specifier: ^3.2.4
        version: 3.2.7

packages:

  expo@57.0.23:
    resolution: {integrity: sha512-x}

snapshots:

  '@biomejs/biome@2.5.13':
    optionalDependencies:
      '@biomejs/cli-darwin-arm64': 2.5.13
      '@biomejs/cli-linux-x64': 2.5.13

  '@nx/vite@23.2.1(nx@23.2.1)':
    dependencies:
      nx: 23.2.1

  expo@57.0.23(react@19.2.3):
    dependencies:
      react: 19.2.3
    optionalDependencies:
      fsevents: 2.3.3

  fsevents@2.3.3:
    optional: true

  nx@23.2.1:
    dependencies:
      yargs: 17.7.2
    optionalDependencies:
      '@nx/nx-darwin-arm64': 23.2.1
      '@nx/nx-linux-x64-gnu': 23.2.1

  react@19.2.3: {}

  typescript@5.9.3: {}

  vitest@3.2.7: {}

  yargs@17.7.2: {}

  zod@4.6.5: {}
`

const parsed = parseLockfile(lockfile)
const store = new Map([
	["nx@23.2.1", { license: "MIT" }],
	["@nx/nx-darwin-arm64@23.2.1", { license: "MIT" }],
	["@nx/vite@23.2.1", { license: "MIT" }],
	["@biomejs/cli-darwin-arm64@2.5.13", { license: "MIT OR Apache-2.0" }],
])

describe("pnpm lockfile", () => {
	it("reads importers with quoted names and peer suffixes", () => {
		expect(parsed.importers.get("apps/vulna-mobile")?.dependencies.get("expo")).toBe("57.0.23(react@19.2.3)")
		expect(parsed.importers.get(".")?.devDependencies.get("@nx/vite")).toBe("23.2.1(nx@23.2.1)")
		expect(stripPeers("57.0.23(react@19.2.3)")).toBe("57.0.23")
	})

	it("reads snapshots including optional dependencies and empty entries", () => {
		expect(parsed.snapshots.get("nx@23.2.1")?.optionalDependencies.get("@nx/nx-linux-x64-gnu")).toBe("23.2.1")
		expect(parsed.snapshots.has("react@19.2.3")).toBe(true)
	})

	it("closes over transitive and optional dependencies and reports links", () => {
		const result = closure(parsed, "apps/vulna-mobile", ["dependencies", "devDependencies"])
		expect([...result.packages].sort()).toEqual(["expo@57.0.23", "fsevents@2.3.3", "react@19.2.3", "typescript@5.9.3"])
		expect([...result.links]).toEqual(["../../libs/contracts"])
	})

	it("skips optional packages that are not installed", () => {
		const result = closure(parsed, "apps/vulna-mobile", ["dependencies"], (spec) => spec !== "fsevents@2.3.3")
		expect(result.packages.has("fsevents@2.3.3")).toBe(false)
		expect(result.packages.has("react@19.2.3")).toBe(true)
	})

	it("follows workspace links with their production dependencies only", () => {
		const result = workspaceClosure(parsed, "apps/vulna-mobile", new Map())
		expect([...result.importers]).toEqual(["apps/vulna-mobile", "libs/contracts"])
		expect(result.packages.has("zod@4.6.5")).toBe(true)
		expect(result.packages.has("vitest@3.2.7")).toBe(false)
	})

	it("lists direct dependencies without workspace links", () => {
		const direct = directDependencies(parsed.importers.get("apps/vulna-mobile") as never)
		expect([...direct]).toEqual([
			["expo", "57.0.23"],
			["typescript", "5.9.3"],
		])
	})

	it("collects Nx, its plugins and the installed native binary", () => {
		const tools = buildTools(parsed, [], store)
		expect(tools.nx).toBe("23.2.1")
		expect([...tools.plugins]).toEqual([["@nx/vite", "23.2.1"]])
		expect([...tools.native]).toEqual([
			["@nx/nx-darwin-arm64", "23.2.1"],
			["@biomejs/cli-darwin-arm64", "2.5.13"],
		])
	})

	it("collects the build tools of quality/soup.yaml from the root and keeps an absent one without a version", () => {
		expect([...buildTools(parsed, [], store).releaseTools]).toEqual([
			["typescript", "5.9.3"],
			["@biomejs/biome", "2.5.13"],
			["vitest", ""],
			["tsx", ""],
		])
	})

	it("CAP-029-R25 finds the native binary of Nx locked together with its peers", () => {
		const peers = "(@swc/core@1.16.2)"
		const withPeers = parseLockfile(
			lockfile
				.replace("        version: 23.2.1\n      '@nx/vite'", `        version: 23.2.1${peers}\n      '@nx/vite'`)
				.replace("\n  nx@23.2.1:\n", `\n  nx@23.2.1${peers}:\n`),
		)

		const tools = buildTools(withPeers, [], store)

		expect(withPeers.snapshots.has(`nx@23.2.1${peers}`)).toBe(true)
		expect(tools.nx).toBe("23.2.1")
		expect(tools.native.get("@nx/nx-darwin-arm64")).toBe("23.2.1")
	})

	it("keeps a plugin configured in nx.json but absent from the lockfile with an empty version", () => {
		expect(buildTools(parsed, ["@nx/js"], store).plugins.get("@nx/js")).toBe("")
	})
})
