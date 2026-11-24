import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import {
	type BuiltImage,
	builtImageReference,
	imageReference,
	type Profile,
	type VendoredPackage,
} from "../../profile/model"
import { imageWorkspacePackages } from "../../profile/workspace"
import { installedPackages } from "../image/apk"
import { carriedOwners, fileHashes, inspectBuiltImage, provenanceOf } from "../image/built-image"
import type { Finding } from "../image/finding"
import { exportImage } from "../image/image-fs"
import { parsePnpmDirectory } from "../image/inventory"
import { readJson, readJsonIfPresent } from "../image/json"
import { runDocker, toolVersion } from "../image/tools"
import { type BuiltImageFacts, builtImageSbom, parseServerVersion } from "./built-image"
import { type BundledFile, bundledFileComponents } from "./bundled-files"
import { checksumsOf } from "./checksums"
import {
	checkBuildTools,
	checkDirectDependencies,
	checkImageCompleteness,
	type SupplementEntry,
	supplementComponents,
} from "./completeness"
import { type Bom, licenseText, MANUFACTURER, newBom, type Tool } from "./cyclonedx"
import { checkEmbeddedComponents, type EmbeddedComponent } from "./embedded"
import { baseImageComponent, finishImageSbom, generateImageSbom, SYFT_IMAGE, thirdPartyImageSbom } from "./image-part"
import { parseLockfile } from "./lockfile"
import {
	buildToolComponents,
	buildTools,
	directDependencies,
	LIBRARY_KINDS,
	packageComponent,
	workspaceClosure,
} from "./lockfile-part"
import { buildMobileBom, MOBILE_EMBEDDED, MOBILE_IMPORTER } from "./mobile"
import { checkOwnExecutables, ownExecutableComponents } from "./own-executables"
import { checkOwnership, dpkgOwnedFiles, dpkgPackages, isElf, sbomLocations } from "./ownership"
import { type VendoredFork, withForkPedigrees } from "./pedigree"
import { readStore } from "./store"
import { checkLanguageModels, checkTesseractVersions, TESSERACT, VERSION_OPTION } from "./tesseract"
import { checkVex, type VexDocument, vexStatements } from "./vex"

const ROOT = resolve(__dirname, "../../..")
const IMAGE = process.env.IMAGE ?? "ansora-vulna-server:dev"
const OUTPUT = join(ROOT, "dist/sbom")
const PRODUCT = "Ansora Vulna"
const RUNTIME = { name: "node", entrypoint: "/nodejs/bin/node", license: "MIT" }
// ADR-011
const BASE_LICENSE = "Apache-2.0"
const VEX = join(ROOT, "quality/postmarket/vex.cdx.json")
const SUPPLEMENT = join(ROOT, "quality/vydani/sbom-supplement.json")
// NAB-662, vydani-sbom-a-brany.md 4.2
const BUNDLED_FILES = join(ROOT, "quality/vydani/sbom-files.json")
// ADR-011 ř. 46, ADR-011 ř. 49
const SOURCES = join(ROOT, "deploy/images/ocr/sources.sha256")
const MODELS = join(ROOT, "deploy/images/ocr/models.sha256")
const PROFILE = process.env.PROFILE_FILE ?? "profiles/mou/profile.json"
const BUNDLED_IMPORTER = "apps/vulna-admin"
const BASE_COMPONENT_ONLY = 1

interface NxConfig {
	plugins?: (string | { plugin: string })[]
}

function git(...args: string[]): string {
	return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim()
}

function runtimeVersion(image: string): string {
	const result = runDocker(["--entrypoint", RUNTIME.entrypoint, image, "--version"])
	if (result.status !== 0) {
		throw new Error(`runtime version failed: ${result.output.trim()}`)
	}
	return result.output.trim().replace(/^v/, "")
}

// ADR-017
function vendoredForksOf(vendored: readonly VendoredPackage[]): VendoredFork[] {
	return vendored.map(({ name, pedigree }) => {
		const path = join(ROOT, pedigree)
		return { name, pedigree, markdown: existsSync(path) ? readFileSync(path, "utf8") : undefined }
	})
}

function write(name: string, bom: Bom): void {
	writeFileSync(join(OUTPUT, name), `${JSON.stringify(bom, null, "\t")}\n`)
}

const now = new Date()
const emptyImporter = { dependencies: new Map(), devDependencies: new Map(), optionalDependencies: new Map() }
const version = git("describe", "--tags", "--always", "--dirty")
const generator: Tool = {
	type: "application",
	name: "@ansora/tools",
	version: readJson<{ version: string }>(join(ROOT, "tools/package.json")).version,
}
const lockfile = parseLockfile(readFileSync(join(ROOT, "pnpm-lock.yaml"), "utf8"))
const store = readStore(join(ROOT, "node_modules"))
const findings: Finding[] = []
mkdirSync(OUTPUT, { recursive: true })

const profile = readJson<Profile>(join(ROOT, PROFILE))
const base = profile.baseImage
const baseComponent = base.digest === null ? undefined : baseImageComponent(base.image, base.digest, BASE_LICENSE)
const supplementEntries = readJsonIfPresent<SupplementEntry[]>(SUPPLEMENT) ?? []
const supplement = supplementComponents(supplementEntries, checksumsOf(readFileSync(SOURCES, "utf8")))
const imageBom = finishImageSbom(generateImageSbom(IMAGE, version), baseComponent, RUNTIME)
imageBom.components.push(...supplement.components)
imageBom.components.push(
	...ownExecutableComponents(version, readJson<{ license: string }>(join(ROOT, "package.json")).license),
)
findings.push(...supplement.findings)
const bundled = workspaceClosure(lockfile, BUNDLED_IMPORTER, store, LIBRARY_KINDS)
const known = new Set(imageBom.components.map((component) => `${component.name}@${component.version}`))
for (const spec of [...bundled.packages].sort()) {
	if (!known.has(spec)) {
		imageBom.components.push(packageComponent(spec, store))
	}
}
const vendoredForks = vendoredForksOf(profile.vendoredPackages ?? [])
const forks = withForkPedigrees(imageBom.components, vendoredForks)
imageBom.components = forks.components
findings.push(...forks.findings)

const thirdPartyImages = profile.thirdPartyImages ?? []
for (const entry of thirdPartyImages) {
	const bom = thirdPartyImageSbom(entry)
	if (bom.components.length <= BASE_COMPONENT_ONLY) {
		findings.push({
			gate: "B5",
			what: `${entry.name} ${imageReference(entry)}`,
			reason: "the image section of the SBOM is empty",
		})
	}
	write(`image-${entry.name}.cdx.json`, bom)
}

// CAP-029-R30, CAP-029-S23
function builtImageFacts(entry: BuiltImage, image: string): BuiltImageFacts {
	return inspectBuiltImage(entry, image, (trees) => {
		const { carried } = provenanceOf(trees)
		return {
			carried,
			owners: carriedOwners(entry, carried),
			packages: installedPackages(imageReference(entry.sourceImage)),
			server: parseServerVersion(runDocker([image, "--version"]).output),
			executables: trees.built.files.filter((file) => isElf(trees.built.root, file)),
		}
	})
}

const builtImages = profile.builtImages ?? []
for (const entry of builtImages) {
	const facts = builtImageFacts(entry, builtImageReference(entry, IMAGE))
	const section = builtImageSbom(entry, version, generator, BASE_LICENSE, facts, now)
	findings.push(...section.findings)
	write(`image-${entry.name}.cdx.json`, section.bom)
}

const mobileBom = buildMobileBom(ROOT, lockfile, store, version, generator, now)
write("mobile.cdx.json", mobileBom)

const configuredPlugins = (readJson<NxConfig>(join(ROOT, "nx.json")).plugins ?? []).map((plugin) =>
	typeof plugin === "string" ? plugin : plugin.plugin,
)
const tools = buildTools(lockfile, configuredPlugins, store)
const toolsBom = newBom(
	{
		"bom-ref": "build-tools",
		type: "application",
		name: PRODUCT,
		version,
		description: "build tools",
		manufacturer: { name: MANUFACTURER },
	},
	[generator],
	buildToolComponents(tools, store),
	now,
)
write("build-tools.cdx.json", toolsBom)

const tree = exportImage(IMAGE)
try {
	const bundledFiles = bundledFileComponents(readJson<BundledFile[]>(BUNDLED_FILES), tree.files, (file) =>
		fileHashes(tree, [file]).get(file),
	)
	imageBom.components.push(...bundledFiles.components)
	findings.push(...bundledFiles.findings)
	write("image.cdx.json", imageBom)
	const withPedigree = imageBom.components.filter((component) => component.pedigree !== undefined)
	const embedded = mobileBom.components.filter((component) => component.evidence !== undefined)
	process.stdout.write(
		`B4 sbom: image ${imageBom.components.length} components (syft ${toolVersion(SYFT_IMAGE)}, ${bundled.packages.size} bundled, ${withPedigree.length} vendored forks with pedigree, ${bundledFiles.components.length} bundled files), ${thirdPartyImages.length} third-party images, ${builtImages.length} built images, mobile ${mobileBom.components.length} (${embedded.length} embedded), build tools ${toolsBom.components.length}; written to dist/sbom\n`,
	)
	const osPackages = dpkgPackages(tree)
	const workspacePackages = imageWorkspacePackages(tree.root, tree.files).map(
		(manifest) => `${manifest.name}@${manifest.version}`,
	)
	const installed = new Set(
		tree.files
			.filter((file) => file.startsWith("/app/node_modules/.pnpm/"))
			.map((file) => parsePnpmDirectory(file.split("/")[4] as string) ?? ""),
	)
	installed.delete("")
	const npmPackages = [...installed, ...workspacePackages]
	const runtime = { name: RUNTIME.name, version: runtimeVersion(IMAGE) }
	findings.push(
		...checkImageCompleteness(imageBom, { osPackages, npmPackages, runtime, baseDigest: base.digest ?? undefined }),
	)
	findings.push(...checkBuildTools(toolsBom, tools))
	findings.push(
		...checkDirectDependencies(
			imageBom,
			directDependencies(lockfile.importers.get(BUNDLED_IMPORTER) ?? emptyImporter, LIBRARY_KINDS),
		),
	)
	findings.push(
		...checkDirectDependencies(mobileBom, directDependencies(lockfile.importers.get(MOBILE_IMPORTER) ?? emptyImporter)),
	)
	findings.push(
		...checkEmbeddedComponents(readJson<EmbeddedComponent[]>(join(ROOT, MOBILE_EMBEDDED)), mobileBom, (name, path) =>
			existsSync(join(ROOT, "node_modules", name, path)),
		),
	)
	process.stdout.write(
		`B5 completeness: ${osPackages.length} os packages, ${npmPackages.length} npm packages, ${runtime.name} ${runtime.version}; nx ${tools.nx}, ${tools.plugins.size} plugins, ${tools.releaseTools.size} build tools, ${tools.native.size} native\n`,
	)

	const vex = readJsonIfPresent<VexDocument>(VEX)
	if (vex !== undefined) {
		findings.push(...checkVex(vex, imageBom))
	}
	process.stdout.write(`B6 vex: ${vex === undefined ? "no document" : `${vexStatements(vex).length} statements`}\n`)

	const executables = tree.files.filter((file) => isElf(tree.root, file))
	const owned = dpkgOwnedFiles(tree)
	findings.push(...checkOwnership(executables, owned, sbomLocations(imageBom), installed))
	findings.push(...checkOwnExecutables(new Set(tree.files)))
	const tesseract = supplementEntries.find((entry) => entry.name === TESSERACT)
	const tesseractRun =
		tesseract === undefined ? undefined : runDocker(["--entrypoint", tesseract.location, IMAGE, VERSION_OPTION])
	const tesseractVersion = tesseractRun?.status === 0 ? tesseractRun.output : ""
	findings.push(...checkTesseractVersions(tesseract?.location ?? TESSERACT, tesseractVersion, imageBom))
	const models = new Map([...checksumsOf(readFileSync(MODELS, "utf8"))].map(([path, sha256]) => [`/${path}`, sha256]))
	const modelDirectories = [...new Set([...models.keys()].map((path) => dirname(path)))]
	const modelFiles = tree.files.filter((file) => modelDirectories.some((directory) => file.startsWith(`${directory}/`)))
	findings.push(...checkLanguageModels(models, fileHashes(tree, modelFiles), owned))
	process.stdout.write(
		`B8 ownership: ${executables.length} executables, ${owned.size} files owned by dpkg, ${tesseractVersion.split("\n")[0]}, ${modelFiles.length} language models\n`,
	)
} finally {
	tree.dispose()
}

const gpl = imageBom.components
	.filter((component) => /GPL/.test(licenseText(component)))
	.map((component) => component.name)
const unlicensed = imageBom.components.filter(
	(component) => licenseText(component) === "" && component.type === "library",
)
process.stdout.write(
	`licenses: GPL family ${gpl.join(", ") || "none"}; without license ${unlicensed.map((component) => component.name).join(", ") || "none"}\n`,
)

if (findings.length === 0) {
	process.stdout.write("sbom gates: clean\n")
} else {
	process.stderr.write(`\nsbom gates: ${findings.length} violations\n\n`)
	for (const finding of findings) {
		process.stderr.write(`  ${finding.gate}  ${finding.what}\n    ${finding.reason}\n\n`)
	}
	process.exitCode = 1
}
