export interface Importer {
	dependencies: Map<string, string>
	devDependencies: Map<string, string>
	optionalDependencies: Map<string, string>
}

export interface Snapshot {
	dependencies: Map<string, string>
	optionalDependencies: Map<string, string>
}

export interface Lockfile {
	importers: Map<string, Importer>
	snapshots: Map<string, Snapshot>
}

export interface Closure {
	packages: Set<string>
	links: Set<string>
}

function unquote(value: string): string {
	return value.replace(/^'(.*)'$/, "$1")
}

function indentOf(line: string): number {
	return line.length - line.trimStart().length
}

export function stripPeers(version: string): string {
	return version.split("(")[0] as string
}

function dependencyMap(entry: Importer | Snapshot, kind: string): Map<string, string> | undefined {
	if (kind === "dependencies") {
		return entry.dependencies
	}
	if (kind === "optionalDependencies") {
		return entry.optionalDependencies
	}
	if (kind === "devDependencies" && "devDependencies" in entry) {
		return entry.devDependencies
	}
	return undefined
}

export function parseLockfile(text: string): Lockfile {
	const importers = new Map<string, Importer>()
	const snapshots = new Map<string, Snapshot>()
	let section = ""
	let entry: Importer | Snapshot | undefined
	let target: Map<string, string> | undefined
	let dependency: string | undefined

	for (const line of text.split("\n")) {
		if (line.trim() === "") {
			continue
		}
		const indent = indentOf(line)
		const content = line.trim()
		if (indent === 0) {
			section = content.replace(/:$/, "")
			entry = undefined
			continue
		}
		if (section !== "importers" && section !== "snapshots") {
			continue
		}
		if (indent === 2) {
			const key = unquote(content.replace(/:( \{\})?$/, ""))
			if (section === "importers") {
				entry = { dependencies: new Map(), devDependencies: new Map(), optionalDependencies: new Map() }
				importers.set(key, entry)
			} else {
				entry = { dependencies: new Map(), optionalDependencies: new Map() }
				snapshots.set(key, entry)
			}
			target = undefined
			continue
		}
		if (entry === undefined) {
			continue
		}
		if (indent === 4) {
			target = dependencyMap(entry, content.replace(/:$/, ""))
			dependency = undefined
			continue
		}
		if (target === undefined) {
			continue
		}
		if (indent === 6) {
			const separator = content.indexOf(": ")
			if (separator === -1) {
				dependency = unquote(content.replace(/:$/, ""))
			} else {
				target.set(unquote(content.slice(0, separator)), unquote(content.slice(separator + 2)))
			}
			continue
		}
		if (indent === 8 && dependency !== undefined && content.startsWith("version: ")) {
			target.set(dependency, unquote(content.slice("version: ".length)))
		}
	}
	return { importers, snapshots }
}

export function snapshotOf(lockfile: Lockfile, name: string, version: string): Snapshot | undefined {
	return lockfile.snapshots.get(`${name}@${version}`) ?? lockfile.snapshots.get(`${name}@${stripPeers(version)}`)
}

export type Installed = (spec: string) => boolean

export function closure(
	lockfile: Lockfile,
	importerPath: string,
	kinds: readonly (keyof Importer)[],
	installed: Installed = () => true,
): Closure {
	const packages = new Set<string>()
	const links = new Set<string>()
	const queue: [string, string][] = []

	// optional packages of other platforms are not part of the build
	const enqueue = (name: string, version: string, optional: boolean): void => {
		if (!optional || version.startsWith("link:") || installed(`${name}@${stripPeers(version)}`)) {
			queue.push([name, version])
		}
	}

	for (const kind of kinds) {
		for (const [name, version] of lockfile.importers.get(importerPath)?.[kind] ?? []) {
			enqueue(name, version, kind === "optionalDependencies")
		}
	}

	while (queue.length > 0) {
		const [name, version] = queue.shift() as [string, string]
		if (version.startsWith("link:")) {
			links.add(version.slice("link:".length))
			continue
		}
		const key = `${name}@${stripPeers(version)}`
		if (packages.has(key)) {
			continue
		}
		packages.add(key)
		const snapshot = snapshotOf(lockfile, name, version)
		for (const [child, childVersion] of snapshot?.dependencies ?? []) {
			enqueue(child, childVersion, false)
		}
		for (const [child, childVersion] of snapshot?.optionalDependencies ?? []) {
			enqueue(child, childVersion, true)
		}
	}
	return { packages, links }
}
