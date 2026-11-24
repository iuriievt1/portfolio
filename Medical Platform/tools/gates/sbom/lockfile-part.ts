import { posix } from "node:path"
import { type Component, license, MANUFACTURER, npmPurl } from "./cyclonedx"
import { closure, type Importer, type Lockfile, snapshotOf, stripPeers } from "./lockfile"
import type { Store } from "./store"

export const PRODUCT_MOBILE = "Ansora Vulna pro iOS a Android"
export const ROOT_IMPORTER = "."
export const NX = "nx"
const NX_SCOPE = "@nx/"
const NX_NATIVE = "@nx/nx-"
const BIOME = "@biomejs/biome"
// quality/soup.yaml
export const RELEASE_TOOLS = ["typescript", BIOME, "vitest", "tsx"] as const
const NATIVE_BINARY_PREFIX: Readonly<Record<string, string>> = { [NX]: NX_NATIVE, [BIOME]: "@biomejs/cli-" }
export const APP_KINDS: (keyof Importer)[] = ["dependencies", "devDependencies", "optionalDependencies"]
export const LIBRARY_KINDS: (keyof Importer)[] = ["dependencies", "optionalDependencies"]

export interface WorkspaceManifest {
	name: string
	version: string
	license?: string
}

export interface WorkspaceClosure {
	packages: Set<string>
	importers: Set<string>
}

export interface BuildTools {
	nx: string
	plugins: Map<string, string>
	releaseTools: Map<string, string>
	native: Map<string, string>
}

export function workspaceClosure(
	lockfile: Lockfile,
	importerPath: string,
	store: Store,
	kinds: readonly (keyof Importer)[] = APP_KINDS,
): WorkspaceClosure {
	const installed = (spec: string): boolean => store.has(spec)
	const packages = new Set<string>()
	const importers = new Set<string>()
	const queue = [importerPath]
	while (queue.length > 0) {
		const path = queue.shift() as string
		if (importers.has(path)) {
			continue
		}
		importers.add(path)
		const part = closure(lockfile, path, path === importerPath ? kinds : LIBRARY_KINDS, installed)
		for (const spec of part.packages) {
			packages.add(spec)
		}
		for (const link of part.links) {
			queue.push(posix.normalize(posix.join(path, link)))
		}
	}
	return { packages, importers }
}

export function directDependencies(
	importer: Importer,
	kinds: readonly (keyof Importer)[] = APP_KINDS,
): Map<string, string> {
	const direct = new Map<string, string>()
	for (const kind of kinds) {
		for (const [name, version] of importer[kind]) {
			if (!version.startsWith("link:")) {
				direct.set(name, stripPeers(version))
			}
		}
	}
	return direct
}

export function packageComponent(spec: string, store: Store): Component {
	const separator = spec.lastIndexOf("@")
	const name = spec.slice(0, separator)
	const version = spec.slice(separator + 1)
	const component: Component = {
		"bom-ref": npmPurl(name, version),
		type: "library",
		name,
		version,
		purl: npmPurl(name, version),
	}
	const licenses = license(store.get(spec)?.license)
	return licenses.length === 0 ? component : { ...component, licenses }
}

export function workspaceComponent(manifest: WorkspaceManifest): Component {
	return {
		"bom-ref": npmPurl(manifest.name, manifest.version),
		type: "library",
		name: manifest.name,
		version: manifest.version,
		purl: npmPurl(manifest.name, manifest.version),
		licenses: license(manifest.license),
		supplier: { name: MANUFACTURER },
	}
}

function installedNativeBinaries(
	lockfile: Lockfile,
	locked: ReadonlyMap<string, string>,
	store: Store,
): Map<string, string> {
	const native = new Map<string, string>()
	for (const [tool, prefix] of Object.entries(NATIVE_BINARY_PREFIX)) {
		const version = locked.get(tool)
		const optional = version === undefined ? undefined : snapshotOf(lockfile, tool, version)?.optionalDependencies
		for (const [name, nativeVersion] of optional ?? []) {
			if (name.startsWith(prefix) && store.has(`${name}@${nativeVersion}`)) {
				native.set(name, nativeVersion)
			}
		}
	}
	return native
}

export function buildTools(lockfile: Lockfile, configuredPlugins: readonly string[], store: Store): BuildTools {
	const root = lockfile.importers.get(ROOT_IMPORTER)
	const locked = new Map<string, string>()
	for (const kind of APP_KINDS) {
		for (const [name, version] of root?.[kind] ?? []) {
			locked.set(name, version)
		}
	}
	const declared = new Map([...locked].map(([name, version]) => [name, stripPeers(version)]))
	const nx = declared.get(NX) ?? ""
	const plugins = new Map<string, string>()
	for (const name of [...declared.keys(), ...configuredPlugins]) {
		if (name.startsWith(NX_SCOPE) && !name.startsWith(NX_NATIVE)) {
			plugins.set(name, declared.get(name) ?? "")
		}
	}
	const releaseTools = new Map(RELEASE_TOOLS.map((name) => [name, declared.get(name) ?? ""]))
	return { nx, plugins, releaseTools, native: installedNativeBinaries(lockfile, locked, store) }
}

export function buildToolComponents(tools: BuildTools, store: Store): Component[] {
	const specs = [`${NX}@${tools.nx}`, ...pairs(tools.plugins), ...pairs(tools.releaseTools), ...pairs(tools.native)]
	return specs.map((spec) => packageComponent(spec, store))
}

function pairs(entries: Map<string, string>): string[] {
	return [...entries].map(([name, version]) => `${name}@${version}`)
}
