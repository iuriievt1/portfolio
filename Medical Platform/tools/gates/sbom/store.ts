import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parsePnpmDirectory } from "../image/inventory"
import { licenseValue } from "./cyclonedx"

export interface StorePackage {
	license?: string
}

export type Store = Map<string, StorePackage>

interface Manifest {
	name?: unknown
	version?: unknown
	license?: unknown
}

const VIRTUAL_STORE = ".pnpm"
const NESTED = "node_modules"
const HIDDEN = "."
const SCOPE = "@"
const MANIFEST = "package.json"

function manifestOf(directory: string): Manifest | undefined {
	const path = join(directory, MANIFEST)
	return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Manifest) : undefined
}

function remember(store: Store, spec: string, manifest: Manifest): void {
	if (!store.has(spec)) {
		store.set(spec, { license: licenseValue(manifest.license) })
	}
}

function readIsolated(nodeModules: string, store: Store): void {
	const virtual = join(nodeModules, VIRTUAL_STORE)
	if (!existsSync(virtual)) {
		return
	}
	for (const directory of readdirSync(virtual)) {
		const spec = parsePnpmDirectory(directory)
		if (spec === undefined) {
			continue
		}
		const manifest = manifestOf(join(virtual, directory, NESTED, spec.slice(0, spec.lastIndexOf("@"))))
		if (manifest !== undefined) {
			remember(store, spec, manifest)
		}
	}
}

function packageDirectories(nodeModules: string): string[] {
	if (!existsSync(nodeModules)) {
		return []
	}
	return readdirSync(nodeModules, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith(HIDDEN))
		.flatMap((entry) =>
			entry.name.startsWith(SCOPE)
				? packageDirectories(join(nodeModules, entry.name))
				: [join(nodeModules, entry.name)],
		)
}

function readHoisted(nodeModules: string, store: Store): void {
	for (const directory of packageDirectories(nodeModules)) {
		const manifest = manifestOf(directory)
		if (typeof manifest?.name === "string" && typeof manifest.version === "string") {
			remember(store, `${manifest.name}@${manifest.version}`, manifest)
		}
		readHoisted(join(directory, NESTED), store)
	}
}

export function readStore(nodeModules: string): Store {
	const store: Store = new Map()
	readIsolated(nodeModules, store)
	readHoisted(nodeModules, store)
	return store
}
