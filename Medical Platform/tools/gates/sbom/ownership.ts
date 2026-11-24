import { closeSync, lstatSync, openSync, readSync } from "node:fs"
import { join } from "node:path"
import type { Finding } from "../image/finding"
import type { ImageTree } from "../image/image-fs"
import { parsePnpmDirectory } from "../image/inventory"
import type { OsPackage } from "./completeness"
import type { Bom } from "./cyclonedx"

const GATE = "B8"
const DPKG_STATUS = "/var/lib/dpkg/status.d/"
const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46])
const LOCATION_PROPERTY = /^syft:location:\d+:path$/
const VIRTUAL_STORE = /^\/app\/node_modules\/\.pnpm\/([^/]+)\//

export function isElf(root: string, file: string): boolean {
	if (!lstatSync(join(root, file)).isFile()) {
		return false
	}
	const header = Buffer.alloc(ELF_MAGIC.length)
	const descriptor = openSync(join(root, file), "r")
	try {
		return readSync(descriptor, header, 0, header.length, 0) === header.length && header.equals(ELF_MAGIC)
	} finally {
		closeSync(descriptor)
	}
}

export function dpkgPackages(tree: ImageTree): OsPackage[] {
	return tree.files
		.filter((file) => file.startsWith(DPKG_STATUS) && !file.endsWith(".md5sums"))
		.map((file) => tree.read(file))
		.map((control) => ({
			name: /^Package: (.+)$/m.exec(control)?.[1] ?? "",
			version: /^Version: (.+)$/m.exec(control)?.[1] ?? "",
		}))
}

export function dpkgOwnedFiles(tree: ImageTree): Set<string> {
	const owned = new Set<string>()
	const lists = tree.files.filter((file) => file.startsWith(DPKG_STATUS) && file.endsWith(".md5sums"))
	for (const list of lists) {
		for (const line of tree.read(list).split("\n")) {
			const path = line.slice(line.indexOf("  ") + 2).trim()
			if (path !== "") {
				owned.add(`/${path}`)
			}
		}
	}
	return owned
}

export function sbomLocations(bom: Bom): Set<string> {
	const locations = new Set<string>()
	for (const component of bom.components) {
		for (const property of component.properties ?? []) {
			if (LOCATION_PROPERTY.test(property.name)) {
				locations.add(property.value)
			}
		}
	}
	return locations
}

export function checkOwnership(
	executables: readonly string[],
	owned: ReadonlySet<string>,
	locations: ReadonlySet<string>,
	npmPackages: ReadonlySet<string>,
): Finding[] {
	const findings: Finding[] = []
	for (const file of executables) {
		if (owned.has(file) || locations.has(file)) {
			continue
		}
		const store = VIRTUAL_STORE.exec(file)?.[1]
		if (store !== undefined && npmPackages.has(parsePnpmDirectory(store) ?? "")) {
			continue
		}
		findings.push({ gate: GATE, what: file, reason: "executable without an SBOM component" })
	}
	return findings
}
