import { posix } from "node:path"
import { CODE_LIST, isSameLanguage } from "@ansora/contracts"
import {
	CONFIGURATION_KEY,
	configurationProperty,
	type ProfileCodeList,
	type ProfileCodeLists,
	type Schema,
	validate,
} from "@ansora/core-server"
import type { Finding } from "../gates/image/finding"
import { CLINICAL_RECORD_ADAPTER, CLINICAL_RECORD_PORT, LAYER } from "../gates/rules"
import {
	type AdapterManifest,
	imageReference,
	type Profile,
	profilePackages,
	vendoredPackageNames,
	type WorkspacePackage,
} from "./model"

const GATE = "profile"
const PROCESS_APPLICATIONS: Record<string, string> = {
	api: "@ansora/server-api",
	worker: "@ansora/server-worker",
}
const PORTS_WITHOUT_ADAPTER = ["CardIdentityResolver"]

export function checkFormat(what: string, value: unknown, schema: Schema): Finding[] {
	return validate(value, schema).map((problem) => ({ gate: GATE, what, reason: problem }))
}

export function checkClosure(profile: Profile, packages: ReadonlyMap<string, WorkspacePackage>): Finding[] {
	const findings: Finding[] = []
	const listed = new Set(profilePackages(profile))
	const vendored = new Set(vendoredPackageNames(profile))
	for (const name of listed) {
		const found = packages.get(name)
		if (found === undefined) {
			findings.push({ gate: GATE, what: name, reason: "profile package missing from the workspace" })
			continue
		}
		for (const dependency of found.dependencies) {
			if (!(listed.has(dependency) || vendored.has(dependency))) {
				findings.push({ gate: GATE, what: `${name} → ${dependency}`, reason: "dependency outside the profile" })
			}
		}
	}
	// ADR-017, ADR-003 ř. 26
	for (const name of vendored) {
		const found = packages.get(name)
		if (found === undefined) {
			findings.push({ gate: GATE, what: name, reason: "vendored package missing from the workspace" })
			continue
		}
		for (const dependency of found.dependencies) {
			if (!vendored.has(dependency)) {
				findings.push({
					gate: GATE,
					what: `${name} → ${dependency}`,
					reason: "vendored package depends on the product",
				})
			}
		}
	}
	for (const name of profile.adapters) {
		if (packages.has(name) && !(packages.get(name)?.tags.includes(LAYER.ADAPTER) ?? false)) {
			findings.push({ gate: GATE, what: name, reason: "listed as adapter without the layer:adapter tag" })
		}
	}
	for (const name of profile.domainPackages) {
		if (packages.has(name) && !(packages.get(name)?.tags.includes(LAYER.DOMAIN) ?? false)) {
			findings.push({ gate: GATE, what: name, reason: "listed as domain without the layer:domain tag" })
		}
	}
	return findings
}

// CAP-017-R06, CAP-017-R18, CAP-012-R28
export function checkCodeLists(what: string, profileCodeLists: ProfileCodeLists, defaultLanguage: string): Finding[] {
	const findings: Finding[] = []
	const codes = profileCodeLists.codeLists.map((list) => list.code)
	for (const required of Object.values(CODE_LIST)) {
		if (!codes.includes(required)) {
			findings.push({ gate: GATE, what, reason: `code list ${required} is missing` })
		}
	}
	for (const [index, code] of codes.entries()) {
		if (!(Object.values(CODE_LIST) as string[]).includes(code)) {
			findings.push({ gate: GATE, what: `${what} ${code}`, reason: "unknown code list" })
		}
		if (codes.indexOf(code) !== index) {
			findings.push({ gate: GATE, what: `${what} ${code}`, reason: "code list listed twice" })
		}
	}
	for (const list of profileCodeLists.codeLists) {
		findings.push(...checkCodeListItems(what, list, defaultLanguage))
	}
	return findings
}

function checkCodeListItems(what: string, list: ProfileCodeList, defaultLanguage: string): Finding[] {
	const findings: Finding[] = []
	const itemCodes = list.items.map((item) => item.code)
	for (const [index, item] of list.items.entries()) {
		const where = `${what} ${list.code}/${item.code}`
		if (itemCodes.indexOf(item.code) !== index) {
			findings.push({ gate: GATE, what: where, reason: "item code listed twice" })
		}
		if (!item.names.some((name) => isSameLanguage(name.language, defaultLanguage))) {
			findings.push({ gate: GATE, what: where, reason: `no name in the default language ${defaultLanguage}` })
		}
		const languages = item.names.map((name) => name.language.toLowerCase())
		if (new Set(languages).size !== languages.length) {
			findings.push({ gate: GATE, what: where, reason: "a language named twice" })
		}
	}
	return findings
}

export function checkPorts(portsCalled: readonly string[], manifests: readonly AdapterManifest[]): Finding[] {
	const covered = new Set([...manifests.flatMap((manifest) => manifest.ports), ...PORTS_WITHOUT_ADAPTER])
	return portsCalled
		.filter((port) => !covered.has(port))
		.map((port) => ({ gate: GATE, what: port, reason: "port without an adapter in the profile" }))
}

// ADR-054 bod 1, ADR-042 ř. 290
export function checkClinicalRecordAdapter(manifests: readonly AdapterManifest[]): Finding[] {
	return manifests
		.filter((manifest) => manifest.ports.includes(CLINICAL_RECORD_PORT) && manifest.name !== CLINICAL_RECORD_ADAPTER)
		.map((manifest) => ({
			gate: GATE,
			what: manifest.name,
			reason: `a second production adapter of the ${CLINICAL_RECORD_PORT} port is not built`,
		}))
}

export function checkProcesses(
	profile: Profile,
	manifests: readonly AdapterManifest[],
	packages: ReadonlyMap<string, WorkspacePackage>,
): Finding[] {
	const findings: Finding[] = []
	const adapters = new Set(profile.adapters)
	for (const manifest of manifests) {
		for (const process of manifest.processes) {
			const application = PROCESS_APPLICATIONS[process]
			if (application === undefined) {
				findings.push({ gate: GATE, what: `${manifest.name} (${process})`, reason: "unknown process" })
			} else if (!(packages.get(application)?.dependencies.includes(manifest.name) ?? false)) {
				findings.push({
					gate: GATE,
					what: `${application} → ${manifest.name}`,
					reason: `the ${process} entry point does not depend on the adapter`,
				})
			}
		}
	}
	for (const [process, application] of Object.entries(PROCESS_APPLICATIONS)) {
		for (const dependency of packages.get(application)?.dependencies ?? []) {
			const tags = packages.get(dependency)?.tags ?? []
			if (!tags.includes(LAYER.ADAPTER)) {
				continue
			}
			const manifest = manifests.find((entry) => entry.name === dependency)
			if (!adapters.has(dependency) || manifest === undefined) {
				findings.push({ gate: GATE, what: `${application} → ${dependency}`, reason: "adapter outside the profile" })
			} else if (!manifest.processes.includes(process)) {
				findings.push({
					gate: GATE,
					what: `${application} → ${dependency}`,
					reason: `the manifest does not allow the ${process} process`,
				})
			}
		}
	}
	return findings
}

export function checkTargets(profile: Profile, manifests: readonly AdapterManifest[]): Finding[] {
	const allowed = new Set(profile.communicationTargets.map((entry) => entry.target))
	const findings: Finding[] = []
	for (const manifest of manifests) {
		for (const outbound of manifest.outboundCommunication) {
			if (!allowed.has(outbound.target)) {
				findings.push({
					gate: GATE,
					what: `${manifest.name} → ${outbound.target}`,
					reason: "target outside the profile",
				})
			}
		}
	}
	return findings
}

export function checkConfigurationSchemas(manifests: readonly AdapterManifest[]): Finding[] {
	return manifests
		.filter((manifest) => manifest.configurationSchema === undefined)
		.map((manifest) => ({ gate: GATE, what: manifest.name, reason: "configuration schema missing" }))
}

export function checkBaseImage(profile: Profile): Finding[] {
	return profile.baseImage.digest === null
		? [{ gate: GATE, what: profile.baseImage.image, reason: "base image without digest" }]
		: []
}

const FROM_LINE = /^[ \t]*FROM\s+(?:--\S+\s+)*(\S+)/gim

// CAP-029-R30
export function checkBuiltImages(profile: Profile, dockerfileOf: (path: string) => string): Finding[] {
	const findings: Finding[] = []
	for (const built of profile.builtImages ?? []) {
		const pinned = new Set([imageReference(built.sourceImage), imageReference(built.baseImage)])
		const found = new Set([...dockerfileOf(built.dockerfile).matchAll(FROM_LINE)].flatMap((match) => match[1] ?? []))
		for (const reference of found) {
			if (!pinned.has(reference)) {
				findings.push({ gate: GATE, what: `${built.dockerfile}: ${reference}`, reason: "FROM outside the profile" })
			}
		}
		for (const reference of pinned) {
			if (!found.has(reference)) {
				findings.push({ gate: GATE, what: `${built.dockerfile}: ${reference}`, reason: "pinned image not used" })
			}
		}
	}
	return findings
}

export function checkConfigurationKeys(schema: Schema): Finding[] {
	return Object.values(CONFIGURATION_KEY)
		.filter((key) => configurationProperty(schema, key) === undefined)
		.map((key) => ({ gate: GATE, what: key, reason: "key used by the server is missing in the configuration schema" }))
}

// ADR-017, ADR-003 ř. 26
const VENDOR_SUPPLIER = "veevoy"

// ADR-017, ADR-003 ř. 26
export function checkVendoredPackages(
	profile: Profile,
	packages: ReadonlyMap<string, WorkspacePackage>,
	manifests: readonly AdapterManifest[],
	directoryOf: (packageDirectory: string) => string,
	exists: (path: string) => boolean,
): Finding[] {
	const findings: Finding[] = []
	const vendored = profile.vendoredPackages ?? []
	const names = vendored.map((entry) => entry.name)
	const repeated = new Set(names.filter((candidate, index) => names.indexOf(candidate) !== index))
	for (const name of repeated) {
		findings.push({ gate: GATE, what: name, reason: "vendored package listed more than once" })
	}
	for (const entry of vendored) {
		const found = packages.get(entry.name)
		if (!exists(entry.pedigree)) {
			findings.push({ gate: GATE, what: `${entry.name}: ${entry.pedigree}`, reason: "pedigree file missing" })
		}
		if (found !== undefined && posix.dirname(entry.pedigree) !== directoryOf(found.directory)) {
			findings.push({
				gate: GATE,
				what: `${entry.name}: ${entry.pedigree}`,
				reason: "pedigree outside the directory of its package",
			})
		}
		const listings = manifests.flatMap((manifest) =>
			(manifest.thirdPartyComponents ?? [])
				.filter((component) => component.name === entry.name)
				.map((component) => ({ adapter: manifest.name, component })),
		)
		for (const { adapter, component } of listings) {
			if (component.version !== found?.version) {
				findings.push({
					gate: GATE,
					what: `${adapter}: ${entry.name}@${component.version}`,
					reason: `manifest version is not the vendored package version ${found?.version}`,
				})
			}
			if (component.supplier !== VENDOR_SUPPLIER || component.pedigree !== entry.pedigree) {
				findings.push({
					gate: GATE,
					what: `${adapter}: ${entry.name}`,
					reason: `manifest lacks supplier ${VENDOR_SUPPLIER} and pedigree ${entry.pedigree}`,
				})
			}
		}
	}
	return findings
}
