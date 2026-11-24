import { type BuiltImage, imageReference } from "../../profile/model"
import type { ApkPackage } from "../image/apk"
import type { CarriedFile } from "../image/built-image"
import type { Finding } from "../image/finding"
import { type Bom, type Component, license, MANUFACTURER, newBom, type Property, type Tool } from "./cyclonedx"
import { baseImageComponent } from "./image-part"

const GATE = "B5"
const PRODUCT = "Ansora Vulna"
const SERVER_VERSION = /\bv=(\S+)/
const ALLOCATOR = /\bmalloc=([a-z]+)-(\S+)/
const BUNDLED_LICENSES: Record<string, string> = { jemalloc: "BSD-2-Clause" }
const SOURCE_ROLE: Property = { name: "ansora:role", value: "source-image" }

export interface ServerVersion {
	version: string
	allocator?: { name: string; version: string }
}

export function parseServerVersion(output: string): ServerVersion | undefined {
	const version = SERVER_VERSION.exec(output)?.[1]
	if (version === undefined) {
		return undefined
	}
	const [, allocatorName, allocatorVersion] = ALLOCATOR.exec(output) ?? []
	return allocatorName === undefined || allocatorVersion === undefined
		? { version }
		: { version, allocator: { name: allocatorName, version: allocatorVersion } }
}

export interface BuiltImageFacts {
	carried: readonly CarriedFile[]
	owners: ReadonlyMap<string, string>
	packages: readonly ApkPackage[]
	server: ServerVersion | undefined
	executables: readonly string[]
}

function locations(files: readonly string[]): Property[] {
	return files.map((file, index) => ({ name: `syft:location:${index}:path`, value: file }))
}

function applicationName(entry: BuiltImage): string {
	return entry.sourceImage.image.split("/").pop() ?? entry.sourceImage.image
}

function genericPurl(name: string, version: string): string {
	return `pkg:generic/${name}@${version}`
}

function applicationComponents(entry: BuiltImage, server: ServerVersion, files: readonly string[]): Component[] {
	const name = applicationName(entry)
	const purl = genericPurl(name, server.version)
	const application: Component = {
		"bom-ref": purl,
		type: "application",
		name,
		version: server.version,
		purl,
		licenses: license(entry.sourceImage.license),
		properties: locations(files),
	}
	if (server.allocator === undefined) {
		return [application]
	}
	const bundledPurl = genericPurl(server.allocator.name, server.allocator.version)
	const bundled: Component = {
		"bom-ref": bundledPurl,
		type: "library",
		name: server.allocator.name,
		version: server.allocator.version,
		purl: bundledPurl,
		description: `statically linked into ${name}`,
		licenses: license(BUNDLED_LICENSES[server.allocator.name]),
	}
	return [application, bundled]
}

function packageComponent(found: ApkPackage, files: readonly string[]): Component {
	const purl = `pkg:apk/alpine/${found.name}@${found.version}?arch=${found.architecture}`
	return {
		"bom-ref": purl,
		type: "library",
		name: found.name,
		version: found.version,
		purl,
		licenses: license(found.license),
		properties: locations(files),
	}
}

// vydani-sbom-a-brany.md 4.4, CAP-029-R30
export function builtImageSbom(
	entry: BuiltImage,
	version: string,
	generator: Tool,
	baseLicense: string,
	facts: BuiltImageFacts,
	now: Date,
): { bom: Bom; findings: Finding[] } {
	const findings: Finding[] = []
	const base = imageReference(entry.baseImage)
	const source = imageReference(entry.sourceImage)
	const product: Component = {
		"bom-ref": entry.name,
		type: "container",
		name: `${PRODUCT} ${entry.name}`,
		version,
		description: `built by veevoy from files of ${source} on ${base}; not the vendor's image`,
		manufacturer: { name: MANUFACTURER },
	}
	const components: Component[] = [
		baseImageComponent(entry.baseImage.image, entry.baseImage.digest, baseLicense),
		{
			...baseImageComponent(entry.sourceImage.image, entry.sourceImage.digest, entry.sourceImage.license),
			description: `source of the carried files; the image itself is not shipped`,
			properties: [SOURCE_ROLE],
		},
	]
	const filesByPackage = new Map<string, string[]>()
	const applicationFiles: string[] = []
	for (const { file, sourceFile } of facts.carried) {
		const owner = facts.owners.get(sourceFile)
		if (owner === undefined) {
			applicationFiles.push(file)
			continue
		}
		filesByPackage.set(owner, [...(filesByPackage.get(owner) ?? []), file])
	}
	for (const [name, files] of [...filesByPackage].sort()) {
		const found = facts.packages.find((candidate) => candidate.name === name)
		if (found === undefined) {
			findings.push({
				gate: GATE,
				what: `${entry.name}: ${name}`,
				reason: "package of a carried file is not installed in the source image",
			})
			continue
		}
		components.push(packageComponent(found, files))
	}
	if (facts.server === undefined) {
		findings.push({
			gate: GATE,
			what: `${entry.name}: ${applicationName(entry)}`,
			reason: "the version of the application could not be read",
		})
	} else {
		components.push(...applicationComponents(entry, facts.server, applicationFiles))
	}
	const carried = new Set(facts.carried.map((carriedFile) => carriedFile.file))
	for (const file of facts.executables) {
		if (!carried.has(file)) {
			findings.push({ gate: "B8", what: `${entry.name}: ${file}`, reason: "executable without an SBOM component" })
		}
	}
	return { bom: newBom(product, [generator], components, now), findings }
}
