import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, posix, relative, resolve, sep } from "node:path"
import { CONFIGURATION_KEY } from "@ansora/contracts"
import {
	configurationEntries,
	PROFILE_ARTIFACT,
	type ProfileCodeLists,
	requiredTextOf,
	type Schema,
} from "@ansora/core-server"
import type { Finding } from "../gates/image/finding"
import { readJson } from "../gates/image/json"
import {
	checkBaseImage,
	checkBuiltImages,
	checkClinicalRecordAdapter,
	checkClosure,
	checkCodeLists,
	checkConfigurationKeys,
	checkConfigurationSchemas,
	checkFormat,
	checkPorts,
	checkProcesses,
	checkTargets,
	checkVendoredPackages,
} from "./checks"
import {
	type ConfigurationSchema,
	composeConfigurationSchema,
	configurationDefaults,
	outboundTargetKeys,
} from "./configuration"
import type { AdapterManifest, Profile, WorkspacePackage } from "./model"
import { workspaceDependencies, workspaceManifests } from "./workspace"

const ROOT = resolve(__dirname, "../..")
const PROFILE_DIRECTORY = process.env.PROFILE ?? "profiles/mou"
const PROFILE_SCHEMA = "profiles/profile.schema.json"
const MANIFEST_SCHEMA = "profiles/adapter-manifest.schema.json"
const CODE_LISTS_SCHEMA = "profiles/code-lists.schema.json"
const PORT_DIRECTORIES = ["libs/core/server/src/ports", "libs/modules/vulna/domain/src/ports"]
const OUTPUT = "dist/profile"
const PORT_FILE = /^([a-z-]+)\.port\.ts$/

function pascalCase(slug: string): string {
	return slug
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("")
}

function portsCalled(): string[] {
	return PORT_DIRECTORIES.flatMap((directory) =>
		readdirSync(join(ROOT, directory))
			.map((file) => PORT_FILE.exec(file)?.[1])
			.filter((slug): slug is string => slug !== undefined)
			.map(pascalCase),
	)
}

const profileSchema = readJson<Schema>(join(ROOT, PROFILE_SCHEMA))
const manifestSchema = readJson<Schema>(join(ROOT, MANIFEST_SCHEMA))
const profileValue: unknown = readJson(join(ROOT, PROFILE_DIRECTORY, "profile.json"))
const findings: Finding[] = [...checkFormat(`${PROFILE_DIRECTORY}/profile.json`, profileValue, profileSchema)]

const packages = new Map<string, WorkspacePackage>(
	[...workspaceManifests(ROOT).values()].map((manifest) => [
		manifest.name,
		{
			name: manifest.name,
			directory: manifest.directory,
			version: manifest.version,
			tags: manifest.nx?.tags ?? [],
			dependencies: workspaceDependencies(manifest),
		},
	]),
)

if (findings.length === 0) {
	const profile = profileValue as Profile
	const manifests: AdapterManifest[] = []
	for (const name of profile.adapters) {
		const directory = packages.get(name)?.directory
		if (directory === undefined) {
			continue
		}
		const manifestValue: unknown = readJson(join(directory, "manifest.json"))
		findings.push(...checkFormat(`${name}/manifest.json`, manifestValue, manifestSchema))
		manifests.push(manifestValue as AdapterManifest)
	}
	findings.push(
		...checkClosure(profile, packages),
		...checkPorts(portsCalled(), manifests),
		...checkClinicalRecordAdapter(manifests),
		...checkProcesses(profile, manifests, packages),
		...checkTargets(profile, manifests),
		...checkConfigurationSchemas(manifests),
		...checkBaseImage(profile),
		...checkBuiltImages(profile, (path) => readFileSync(join(ROOT, path), "utf8")),
		...checkVendoredPackages(
			profile,
			packages,
			manifests,
			(directory) => relative(ROOT, directory).split(sep).join(posix.sep),
			(path) => existsSync(join(ROOT, path)),
		),
	)

	const core = readJson<ConfigurationSchema>(join(ROOT, PROFILE_DIRECTORY, PROFILE_ARTIFACT.CONFIGURATION_SCHEMA))
	const configuration = composeConfigurationSchema(core, manifests)
	const defaults = configurationDefaults(configuration)
	findings.push(
		...checkFormat(PROFILE_ARTIFACT.CONFIGURATION_DEFAULTS, defaults, configuration),
		...checkConfigurationKeys(configuration),
	)

	const codeListsPath = `${PROFILE_DIRECTORY}/${PROFILE_ARTIFACT.CODE_LISTS}`
	const codeListsValue: unknown = readJson(join(ROOT, codeListsPath))
	const codeListsFormat = checkFormat(codeListsPath, codeListsValue, readJson<Schema>(join(ROOT, CODE_LISTS_SCHEMA)))
	findings.push(...codeListsFormat)
	const codeLists = codeListsValue as ProfileCodeLists
	if (codeListsFormat.length === 0) {
		// CAP-012-R28
		const defaultLanguage = requiredTextOf(new Map(configurationEntries(defaults)), CONFIGURATION_KEY.DEFAULT_LANGUAGE)
		findings.push(...checkCodeLists(codeListsPath, codeLists, defaultLanguage))
	}

	if (findings.length === 0) {
		mkdirSync(join(ROOT, OUTPUT), { recursive: true })
		writeFileSync(
			join(ROOT, OUTPUT, PROFILE_ARTIFACT.CONFIGURATION_SCHEMA),
			`${JSON.stringify(configuration, null, "\t")}\n`,
		)
		writeFileSync(
			join(ROOT, OUTPUT, PROFILE_ARTIFACT.CONFIGURATION_DEFAULTS),
			`${JSON.stringify(defaults, null, "\t")}\n`,
		)
		writeFileSync(
			join(ROOT, OUTPUT, PROFILE_ARTIFACT.OUTBOUND_TARGETS),
			`${JSON.stringify(outboundTargetKeys(manifests), null, "\t")}\n`,
		)
		writeFileSync(
			join(ROOT, OUTPUT, PROFILE_ARTIFACT.CODE_LISTS),
			`${JSON.stringify({ codeLists: codeLists.codeLists }, null, "\t")}\n`,
		)
		writeFileSync(join(ROOT, OUTPUT, "base-image"), `${profile.baseImage.image}@${profile.baseImage.digest}\n`)
		process.stdout.write(
			`profile ${profile.id}: ${profile.adapters.length} adapters, ${portsCalled().length} ports, ${manifests.reduce((sum, manifest) => sum + Object.keys(manifest.configurationSchema ?? {}).length, 0)} adapter configuration keys; written to ${OUTPUT}\n`,
		)
	}
}

if (findings.length === 0) {
	process.stdout.write("profile build: clean\n")
} else {
	process.stderr.write(`\nprofile build: ${findings.length} problems\n\n`)
	for (const finding of findings) {
		process.stderr.write(`  ${finding.what}\n    ${finding.reason}\n\n`)
	}
	process.exitCode = 1
}
