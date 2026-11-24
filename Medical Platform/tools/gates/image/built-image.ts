import { createHash } from "node:crypto"
import { lstatSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { type BuiltImage, imageReference } from "../../profile/model"
import { ownersOf } from "./apk"
import type { Finding } from "./finding"
import { exportImage, type ImageTree, pullImage } from "./image-fs"
import type { ScanReport } from "./vulnerabilities"

const GATE = "B7"

export type FileHashes = ReadonlyMap<string, string>

export function fileHashes(tree: ImageTree, files: readonly string[] = tree.files): Map<string, string> {
	const hashes = new Map<string, string>()
	for (const file of files) {
		const path = join(tree.root, file)
		if (lstatSync(path).isFile()) {
			hashes.set(file, createHash("sha256").update(readFileSync(path)).digest("hex"))
		}
	}
	return hashes
}

// usrmerge
export interface CarriedFile {
	file: string
	sourceFile: string
}

export interface Provenance {
	carried: CarriedFile[]
	findings: Finding[]
}

// CAP-029-R30
export function checkProvenance(built: FileHashes, base: FileHashes, source: FileHashes): Provenance {
	const sourceByHash = new Map<string, string>()
	for (const [file, hash] of [...source].sort()) {
		if (!sourceByHash.has(hash)) {
			sourceByHash.set(hash, file)
		}
	}
	const carried: CarriedFile[] = []
	const findings: Finding[] = []
	for (const [file, hash] of [...built].sort()) {
		if (base.get(file) === hash) {
			continue
		}
		const sourceFile = source.get(file) === hash ? file : sourceByHash.get(hash)
		if (sourceFile === undefined) {
			findings.push({ gate: GATE, what: file, reason: "file is neither from the base nor from the source image" })
			continue
		}
		carried.push({ file, sourceFile })
	}
	return { carried, findings }
}

export interface BuiltImageTrees {
	built: ImageTree
	base: ImageTree
	source: ImageTree
}

// CAP-029-R30, CAP-029-S20
export function inspectBuiltImage<T>(entry: BuiltImage, image: string, inspect: (trees: BuiltImageTrees) => T): T {
	const base = imageReference(entry.baseImage)
	const source = imageReference(entry.sourceImage)
	pullImage(base)
	pullImage(source)
	const trees: BuiltImageTrees = { built: exportImage(image), base: exportImage(base), source: exportImage(source) }
	try {
		return inspect(trees)
	} finally {
		for (const tree of Object.values(trees)) {
			tree.dispose()
		}
	}
}

export function provenanceOf(trees: BuiltImageTrees): Provenance {
	return checkProvenance(fileHashes(trees.built), fileHashes(trees.base), fileHashes(trees.source))
}

export function carriedOwners(entry: BuiltImage, carried: readonly CarriedFile[]): Map<string, string> {
	return ownersOf(
		imageReference(entry.sourceImage),
		carried.map((carriedFile) => carriedFile.sourceFile),
	)
}

export function restrictReport(report: ScanReport, packages: ReadonlySet<string>): ScanReport {
	return {
		Results: (report.Results ?? []).map((result) => ({
			Vulnerabilities: (result.Vulnerabilities ?? []).filter((vulnerability) => packages.has(vulnerability.PkgName)),
		})),
	}
}
