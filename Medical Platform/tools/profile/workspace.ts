import { readdirSync, statSync } from "node:fs"
import { join, posix } from "node:path"
import { readJson } from "../gates/image/json"

// ADR-033 bod 6, ADR-017, ADR-003 ř. 26

const WORKSPACE_ROOTS: readonly { directory: string; depth: number }[] = [
	{ directory: "apps", depth: 1 },
	{ directory: "libs", depth: 3 },
	{ directory: "vendor", depth: 1 },
]
const IMAGE_APP_DIRECTORY = "/app"
const DEFAULT_ENTRY_POINT = "index.js"
const MANIFEST = "package.json"
const DEPENDENCY_DIRECTORY = "node_modules"
// https://nodejs.org/api/packages.html#conditional-exports
const SUBPATH_PREFIX = "."
const REQUIRE_CONDITIONS: readonly string[] = ["require", "node", "default"]

export interface WorkspaceManifest {
	name: string
	version?: string
	directory: string
	main?: string
	exports?: string | Record<string, unknown>
	nx?: { tags?: string[] }
	dependencies?: Record<string, string>
}

function collect(directory: string, depth: number, found: Map<string, WorkspaceManifest>): void {
	const manifestPath = join(directory, MANIFEST)
	try {
		if (statSync(manifestPath).isFile()) {
			const manifest = readJson<WorkspaceManifest>(manifestPath)
			found.set(manifest.name, { ...manifest, directory })
			return
		}
	} catch {}
	if (depth === 0) {
		return
	}
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory() && entry.name !== DEPENDENCY_DIRECTORY) {
			collect(join(directory, entry.name), depth - 1, found)
		}
	}
}

function imageRootOf(file: string): { root: string; depth: number } | undefined {
	return WORKSPACE_ROOTS.map(({ directory, depth }) => ({
		root: posix.join(IMAGE_APP_DIRECTORY, directory),
		depth,
	})).find(({ root }) => file.startsWith(`${root}/`))
}

function enclosingManifests(root: string, directories: readonly string[]): string[] {
	return directories.map((_, level) => posix.join(root, ...directories.slice(0, level), MANIFEST))
}

function isImageWorkspaceManifest(file: string, manifestFiles: ReadonlySet<string>): boolean {
	const workspaceRoot = imageRootOf(file)
	if (workspaceRoot === undefined) {
		return false
	}
	const directories = posix
		.relative(workspaceRoot.root, posix.dirname(file))
		.split("/")
		.filter((part) => part !== "")
	if (directories.length > workspaceRoot.depth || directories.includes(DEPENDENCY_DIRECTORY)) {
		return false
	}
	return !enclosingManifests(workspaceRoot.root, directories).some((path) => manifestFiles.has(path))
}

// ADR-033 bod 6, ADR-017
export function imageWorkspaceManifests(files: readonly string[]): string[] {
	const manifestFiles = new Set(files.filter((file) => posix.basename(file) === MANIFEST))
	return [...manifestFiles].filter((file) => isImageWorkspaceManifest(file, manifestFiles)).sort()
}

// ADR-033 bod 6, ADR-017
export function imageWorkspacePackages(root: string, files: readonly string[]): WorkspaceManifest[] {
	return imageWorkspaceManifests(files).map((file) => readJson<WorkspaceManifest>(join(root, file)))
}

export function workspaceManifests(root: string): Map<string, WorkspaceManifest> {
	const found = new Map<string, WorkspaceManifest>()
	for (const { directory, depth } of WORKSPACE_ROOTS) {
		collect(join(root, directory), depth, found)
	}
	return found
}

export function workspaceDependencies(manifest: WorkspaceManifest): string[] {
	return Object.entries(manifest.dependencies ?? {})
		.filter(([, range]) => range.startsWith("workspace:"))
		.map(([name]) => name)
}

export function serverClosure(
	workspace: ReadonlyMap<string, WorkspaceManifest>,
	applications: readonly string[],
	serverProcesses: readonly string[],
): string[] {
	const closure = new Set<string>()
	const queue = applications.filter((name) =>
		(workspace.get(name)?.nx?.tags ?? []).some((tag) => serverProcesses.includes(tag)),
	)
	while (queue.length > 0) {
		const name = queue.shift() as string
		if (closure.has(name)) {
			continue
		}
		closure.add(name)
		const manifest = workspace.get(name)
		if (manifest !== undefined) {
			queue.push(...workspaceDependencies(manifest))
		}
	}
	return [...closure].sort()
}

function requiredEntryOf(exported: unknown): string | undefined {
	if (typeof exported === "string" || exported === null || typeof exported !== "object") {
		return typeof exported === "string" ? exported : undefined
	}
	const conditions = Object.entries(exported as Record<string, unknown>)
	const isSubpathMap = conditions.some(([key]) => key.startsWith(SUBPATH_PREFIX))
	if (isSubpathMap) {
		return requiredEntryOf((exported as Record<string, unknown>)[SUBPATH_PREFIX])
	}
	const [, entry] = conditions.find(([key]) => REQUIRE_CONDITIONS.includes(key)) ?? []
	return requiredEntryOf(entry)
}

// https://nodejs.org/api/packages.html#package-entry-points
export function imageEntryPoint(manifest: WorkspaceManifest, root: string): string {
	const entry = requiredEntryOf(manifest.exports) ?? manifest.main ?? DEFAULT_ENTRY_POINT
	const relativeDirectory = posix.relative(root.split("\\").join("/"), manifest.directory.split("\\").join("/"))
	return posix.join(IMAGE_APP_DIRECTORY, relativeDirectory, entry)
}
