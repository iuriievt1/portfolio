import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import {
	type BuiltImage,
	builtImageReference,
	imageReference,
	type Profile,
	profilePackages,
	type ThirdPartyImage,
	vendoredPackageNames,
} from "../../profile/model"
import {
	imageEntryPoint,
	imageWorkspacePackages,
	serverClosure,
	type WorkspaceManifest,
	workspaceManifests,
} from "../../profile/workspace"
import { baseLayers, baseReference, checkBaseLayers, imageLayers, imagePlatform } from "./base-image"
import { carriedOwners, inspectBuiltImage, provenanceOf, restrictReport } from "./built-image"
import { canaries, checkCanary } from "./canary"
import { type AdapterManifest, allowlistFromManifests, checkAllowlist } from "./egress"
import type { Finding } from "./finding"
import { findForbidden } from "./forbidden-content"
import { exportImage, pullImage } from "./image-fs"
import { bannedPackagesOf, checkEntryPoints, checkInventory, lockfilePackages, parsePnpmDirectory } from "./inventory"
import { readJson, readJsonIfPresent } from "./json"
import { verifySignature } from "./signature"
import { COSIGN_IMAGE, TRIVY_IMAGE, toolVersion } from "./tools"
import {
	checkLimits,
	checkThirdPartyVulnerabilities,
	checkVulnerabilities,
	databaseUpdatedAt,
	type ImageCounts,
	imageCounts,
	type NotificationRecord,
	type ScanReport,
	scanImage,
} from "./vulnerabilities"

const ROOT = resolve(__dirname, "../../..")
const IMAGE = process.env.IMAGE ?? "ansora-vulna-server:dev"
const SERVER_PROCESSES = ["process:api", "process:worker", "process:shared"]
const NOTIFICATIONS = join(ROOT, "quality/postmarket/cve-notifications.json")
const LIMITS = join(ROOT, "quality/vydani/image-limits.json")

function adapterManifests(workspace: Map<string, WorkspaceManifest>, adapters: readonly string[]): AdapterManifest[] {
	return adapters
		.map((name) => workspace.get(name)?.directory)
		.filter((directory): directory is string => directory !== undefined)
		.map((directory) => readJson<AdapterManifest>(join(directory, "manifest.json")))
}

function writeReport(name: string, report: ScanReport): void {
	writeFileSync(join(ROOT, `dist/image/trivy-${name}.json`), `${JSON.stringify(report, null, "\t")}\n`)
}

function namedFindings(name: string, imageFindings: readonly Finding[]): Finding[] {
	return imageFindings.map((finding) => ({ ...finding, what: `${name}: ${finding.what}` }))
}

// vydani-sbom-a-brany.md 2.2, Q-135
function checkThirdPartyImage(entry: ThirdPartyImage, records: readonly NotificationRecord[], now: Date): Finding[] {
	const reference = imageReference(entry)
	pullImage(reference)
	const tree = exportImage(reference)
	try {
		const report = scanImage(reference)
		writeReport(entry.name, report)
		const counts = imageCounts(report)
		const scan = checkThirdPartyVulnerabilities(report, entry.digest, records, now)
		const forbidden = findForbidden(tree.files)
		process.stdout.write(
			`B9 ${entry.name}: ${counts.open_cves} open, ${scan.length} blocking; B11 ${entry.name}: ${tree.files.length} files, ${forbidden.length} forbidden\n`,
		)
		return namedFindings(entry.name, [...scan, ...forbidden])
	} finally {
		tree.dispose()
	}
}

// CAP-029-R30, CAP-029-S20
function checkBuiltImage(entry: BuiltImage, records: readonly NotificationRecord[], now: Date): Finding[] {
	const image = builtImageReference(entry, IMAGE)
	const base = imageReference(entry.baseImage)
	const source = imageReference(entry.sourceImage)
	return inspectBuiltImage(entry, image, (trees) => {
		const platform = imagePlatform(image)
		const baseImage = checkBaseLayers(entry.baseImage, imageLayers(image), baseLayers(base, platform))
		if (baseImage.length === 0) {
			baseImage.push(...verifySignature(base))
		}
		const provenance = provenanceOf(trees)
		const carriedPackages = new Set(carriedOwners(entry, provenance.carried).values())
		const own = scanImage(image)
		const report = restrictReport(scanImage(source), carriedPackages)
		writeReport(entry.name, { Results: [...(own.Results ?? []), ...(report.Results ?? [])] })
		const scan = [...checkVulnerabilities(own, records, now), ...checkVulnerabilities(report, records, now)]
		const forbidden = findForbidden(trees.built.files)
		process.stdout.write(
			`B7 ${entry.name}: base ${base} on ${platform}, ${provenance.carried.length} files from ${source}; ` +
				`B9 ${entry.name}: ${imageCounts(report).open_cves} open in ${[...carriedPackages].sort().join(", ")}; ` +
				`B11 ${entry.name}: ${trees.built.files.length} files, ${forbidden.length} forbidden\n`,
		)
		return namedFindings(entry.name, [...baseImage, ...provenance.findings, ...scan, ...forbidden])
	})
}

const profile = readJson<Profile>(join(ROOT, "profiles/mou/profile.json"))
const manifests = workspaceManifests(ROOT)

const tree = exportImage(IMAGE)
const findings: Finding[] = []
try {
	const present = imageWorkspacePackages(tree.root, tree.files)
		.map((manifest) => manifest.name)
		.sort()
	const installed = [
		...new Set(
			tree.files
				.filter((file) => file.startsWith("/app/node_modules/.pnpm/"))
				.map((file) => file.split("/")[4] as string),
		),
	]
	const found = canaries(
		[...manifests.values()].map((manifest) => ({ name: manifest.name, tags: manifest.nx?.tags ?? [] })),
		profilePackages(profile),
	)
	const canary = checkCanary(
		present,
		installed.map((directory) => parsePnpmDirectory(directory) ?? directory),
		found,
	)
	process.stdout.write(`B1 synthetic packages: ${[...found.modules, ...found.adapters].join(", ")} absent\n`)

	const required = serverClosure(manifests, profile.applications, SERVER_PROCESSES)
	const vendoredInImage = vendoredPackageNames(profile).filter((name) => required.includes(name))
	const inventory = checkInventory({
		present,
		allowed: [...profilePackages(profile), ...vendoredInImage],
		required,
		installed,
		lockfile: lockfilePackages(readFileSync(join(ROOT, "pnpm-lock.yaml"), "utf8")),
		banned: bannedPackagesOf(
			profile.bannedPackages.map((banned) => banned.pattern),
			profile.adapters,
		),
	})
	const entryPoints = checkEntryPoints(
		tree.files,
		vendoredInImage.flatMap((name) => {
			const manifest = manifests.get(name)
			return manifest === undefined ? [] : [{ name, path: imageEntryPoint(manifest, ROOT) }]
		}),
	)
	process.stdout.write(
		`B2 image inventory: ${present.length} workspace packages, ${installed.length} installed packages\n`,
	)

	const allowlist = allowlistFromManifests(adapterManifests(manifests, profile.adapters))
	const egress = checkAllowlist(allowlist)
	process.stdout.write(
		`B3 egress allowlist: api -> ${allowlist.api.join(", ")}; worker -> ${allowlist.worker.join(", ")}\n`,
	)

	const reference = baseReference(profile.baseImage)
	const platform = imagePlatform(IMAGE)
	const baseImage = checkBaseLayers(
		profile.baseImage,
		imageLayers(IMAGE),
		reference === undefined ? undefined : baseLayers(reference, platform),
	)
	if (baseImage.length === 0 && reference !== undefined) {
		baseImage.push(...verifySignature(reference))
	}
	process.stdout.write(
		`B7 base image: ${reference ?? "without digest"} on ${platform}, cosign ${toolVersion(COSIGN_IMAGE)}\n`,
	)

	const report = scanImage(IMAGE)
	mkdirSync(join(ROOT, "dist/image"), { recursive: true })
	writeFileSync(join(ROOT, "dist/image/trivy.json"), `${JSON.stringify(report, null, "\t")}\n`)
	const counts = imageCounts(report)
	const records = readJsonIfPresent<NotificationRecord[]>(NOTIFICATIONS) ?? []
	const limits = readJsonIfPresent<ImageCounts>(LIMITS)
	const scan = [...checkVulnerabilities(report, records, new Date()), ...checkLimits(counts, limits)]
	process.stdout.write(
		`B9 vulnerabilities: ${counts.open_cves} open, trivy ${toolVersion(TRIVY_IMAGE)}, database ${databaseUpdatedAt()}\n`,
	)
	process.stdout.write(
		`B10 limits: ${counts.packages} packages, ${counts.open_cves} open CVEs, limit ${limits ? `${limits.packages}/${limits.open_cves}` : "not set"}\n`,
	)

	const forbidden = findForbidden(tree.files)
	process.stdout.write(`B11 forbidden content: ${tree.files.length} files scanned\n`)

	findings.push(...canary, ...inventory, ...entryPoints, ...egress, ...baseImage, ...scan, ...forbidden)
	for (const entry of profile.thirdPartyImages ?? []) {
		findings.push(...checkThirdPartyImage(entry, records, new Date()))
	}
	for (const entry of profile.builtImages ?? []) {
		findings.push(...checkBuiltImage(entry, records, new Date()))
	}
} finally {
	tree.dispose()
}

if (findings.length === 0) {
	process.stdout.write("image gates: clean\n")
} else {
	process.stderr.write(`\nimage gates: ${findings.length} violations\n\n`)
	for (const finding of findings) {
		process.stderr.write(`  ${finding.gate}  ${finding.what}\n    ${finding.reason}\n\n`)
	}
	process.exitCode = 1
}
