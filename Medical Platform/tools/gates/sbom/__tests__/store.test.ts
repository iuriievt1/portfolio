import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { readStore } from "../store"

let root: string

function manifest(directory: string, name: string, version: string, license?: unknown): void {
	mkdirSync(directory, { recursive: true })
	writeFileSync(join(directory, "package.json"), JSON.stringify({ name, version, license }))
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "vulna-store-"))
})

afterEach(() => {
	rmSync(root, { recursive: true, force: true })
})

describe("B4 installed packages behind the SBOM ✓ vydani-sbom-a-brany.md 4.1", () => {
	it("NAB-662 reads the license of a package installed by the hoisted node linker, scoped or nested", () => {
		const nodeModules = join(root, "node_modules")
		manifest(join(nodeModules, "clsx"), "clsx", "2.1.1", "MIT")
		manifest(join(nodeModules, "@base-ui", "react"), "@base-ui/react", "1.8.0", "MIT")
		manifest(join(nodeModules, "@base-ui", "react", "node_modules", "clsx"), "clsx", "1.2.1", { type: "ISC" })
		manifest(join(nodeModules, "@nx", "nx-linux-x64-gnu"), "@nx/nx-linux-x64-gnu", "23.2.1", "MIT")

		const store = readStore(nodeModules)

		expect(store.get("clsx@2.1.1")).toEqual({ license: "MIT" })
		expect(store.get("clsx@1.2.1")).toEqual({ license: "ISC" })
		expect(store.get("@base-ui/react@1.8.0")).toEqual({ license: "MIT" })
		expect(store.has("@nx/nx-linux-x64-gnu@23.2.1")).toBe(true)
	})

	it("reads a package of the isolated node linker from the virtual store", () => {
		const nodeModules = join(root, "node_modules")
		manifest(join(nodeModules, ".pnpm", "pako@2.1.0", "node_modules", "pako"), "pako", "2.1.0", "(MIT AND Zlib)")

		expect(readStore(nodeModules).get("pako@2.1.0")).toEqual({ license: "(MIT AND Zlib)" })
	})

	it("skips a linked workspace package and hidden directories", () => {
		const nodeModules = join(root, "node_modules")
		manifest(join(root, "libs", "contracts"), "@ansora/contracts", "0.0.0", "UNLICENSED")
		mkdirSync(join(nodeModules, "@ansora"), { recursive: true })
		symlinkSync(join(root, "libs", "contracts"), join(nodeModules, "@ansora", "contracts"))
		manifest(join(nodeModules, ".cache", "tool"), "tool", "1.0.0", "MIT")

		expect([...readStore(nodeModules).keys()]).toEqual([])
	})

	it("gives an empty store when nothing is installed", () => {
		expect(readStore(join(root, "node_modules")).size).toBe(0)
	})
})
