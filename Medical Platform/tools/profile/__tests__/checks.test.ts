import { CODE_LIST } from "@ansora/contracts"
import { CONFIGURATION_KEY, type ProfileCodeList, type ProfileCodeLists, type Schema } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import {
	checkBaseImage,
	checkBuiltImages,
	checkClinicalRecordAdapter,
	checkClosure,
	checkCodeLists,
	checkConfigurationKeys,
	checkConfigurationSchemas,
	checkPorts,
	checkProcesses,
	checkTargets,
	checkVendoredPackages,
} from "../checks"
import { type AdapterManifest, builtImageReference, type Profile, type WorkspacePackage } from "../model"

const profile: Profile = {
	id: "mou",
	nameTowardsCustomer: "Ansora Vulna",
	corePackages: ["@ansora/core-server"],
	domainPackages: ["@ansora/vulna-domain"],
	adapters: ["@ansora/vulna-adapter-syslog", "@ansora/vulna-adapter-oidc"],
	applications: ["@ansora/server-api", "@ansora/server-worker"],
	bannedPackages: [],
	communicationTargets: [{ target: "log-management" }, { target: "identity-provider" }],
	baseImage: { image: "gcr.io/distroless/nodejs24-debian13", digest: `sha256:${"a".repeat(64)}` },
	mobileRelease: { serverUrl: null, oidcDiscoveryUrl: null, pinningFingerprints: null },
}

function pkg(name: string, tags: string[], dependencies: string[] = []): [string, WorkspacePackage] {
	return [name, { name, directory: name, tags, dependencies }]
}

const packages = new Map<string, WorkspacePackage>([
	pkg("@ansora/core-server", ["layer:core"]),
	pkg("@ansora/vulna-domain", ["layer:domain"], ["@ansora/core-server"]),
	pkg("@ansora/vulna-adapter-syslog", ["layer:adapter"], ["@ansora/core-server"]),
	pkg("@ansora/vulna-adapter-oidc", ["layer:adapter"], ["@ansora/core-server"]),
	pkg("@ansora/synthetic-adapter-null", ["layer:adapter"]),
	pkg("@ansora/server-api", ["layer:app"], ["@ansora/core-server", "@ansora/vulna-adapter-oidc"]),
	pkg("@ansora/server-worker", ["layer:app"], ["@ansora/core-server", "@ansora/vulna-adapter-syslog"]),
])

const syslog: AdapterManifest = {
	name: "@ansora/vulna-adapter-syslog",
	ports: ["AuditSink"],
	processes: ["worker"],
	outboundCommunication: [{ target: "log-management" }],
	configurationSchema: { SYSLOG_HOST: { type: "string", required: true } },
}
const oidc: AdapterManifest = {
	name: "@ansora/vulna-adapter-oidc",
	ports: ["IdentityProvider"],
	processes: ["api"],
	outboundCommunication: [{ target: "identity-provider" }],
	configurationSchema: {},
}
const manifests = [syslog, oidc]

describe("profile build checks", () => {
	it("ADR-017 ADR-003 ř. 26 keeps each vendored package once, its pedigree in its directory and in the manifest", () => {
		const entry = { name: "@veevoy/dimse", pedigree: "vendor/dimse/PEDIGREE.md", source: "ADR-017" }
		const vendoredProfile: Profile = { ...profile, vendoredPackages: [entry] }
		const fork = new Map<string, WorkspacePackage>([
			[
				"@veevoy/dimse",
				{ name: "@veevoy/dimse", directory: "vendor/dimse", version: "1.0.0-veevoy.2", tags: [], dependencies: [] },
			],
		])
		const listed = (component: Record<string, string>): AdapterManifest => ({
			...syslog,
			thirdPartyComponents: [{ name: "@veevoy/dimse", ...component }],
		})
		const complete = { version: "1.0.0-veevoy.2", supplier: "veevoy", pedigree: entry.pedigree }
		const check = (checked: Profile, manifest: AdapterManifest, exists = true) =>
			checkVendoredPackages(
				checked,
				fork,
				[manifest],
				(directory) => directory,
				() => exists,
			).map((finding) => finding.reason)

		expect(check(vendoredProfile, listed(complete))).toEqual([])
		expect(check({ ...profile, vendoredPackages: [entry, entry] }, listed(complete))).toEqual([
			"vendored package listed more than once",
		])
		expect(check(vendoredProfile, listed(complete), false)).toEqual(["pedigree file missing"])
		expect(
			check(
				{ ...profile, vendoredPackages: [{ ...entry, pedigree: "vendor/other/PEDIGREE.md" }] },
				listed({ ...complete, pedigree: "vendor/other/PEDIGREE.md" }),
			),
		).toEqual(["pedigree outside the directory of its package"])
		expect(check(vendoredProfile, listed({ ...complete, version: "1.0.0-veevoy.1" }))).toEqual([
			"manifest version is not the vendored package version 1.0.0-veevoy.2",
		])
		expect(check(vendoredProfile, listed({ version: complete.version }))).toEqual([
			"manifest lacks supplier veevoy and pedigree vendor/dimse/PEDIGREE.md",
		])
	})

	it("ADR-017 lets profile packages depend on vendored packages, which depend only on each other", () => {
		const vendoredProfile: Profile = {
			...profile,
			vendoredPackages: [
				{ name: "@veevoy/dimse", pedigree: "vendor/dimse/PEDIGREE.md", source: "ADR-017" },
				{ name: "@veevoy/data", pedigree: "vendor/data/PEDIGREE.md", source: "ADR-017" },
			],
		}
		const withFork = (fork: [string, WorkspacePackage][]) =>
			new Map<string, WorkspacePackage>([
				...packages,
				pkg(
					"@ansora/vulna-adapter-syslog",
					["layer:adapter"],
					["@ansora/core-server", "@veevoy/dimse", "@veevoy/other"],
				),
				...fork,
			])

		expect(
			checkClosure(
				vendoredProfile,
				withFork([pkg("@veevoy/dimse", [], ["@veevoy/data"]), pkg("@veevoy/data", [])]),
			).map((finding) => [finding.what, finding.reason]),
		).toEqual([["@ansora/vulna-adapter-syslog → @veevoy/other", "dependency outside the profile"]])
		expect(
			checkClosure(vendoredProfile, withFork([pkg("@veevoy/dimse", [], ["@ansora/core-server"])])).map((finding) => [
				finding.what,
				finding.reason,
			]),
		).toEqual([
			["@ansora/vulna-adapter-syslog → @veevoy/other", "dependency outside the profile"],
			["@veevoy/dimse → @ansora/core-server", "vendored package depends on the product"],
			["@veevoy/data", "vendored package missing from the workspace"],
		])
	})

	it("passes a closed profile", () => {
		expect(checkClosure(profile, packages)).toEqual([])
		expect(checkPorts(["AuditSink", "IdentityProvider", "CardIdentityResolver"], manifests)).toEqual([])
		expect(checkProcesses(profile, manifests, packages)).toEqual([])
		expect(checkTargets(profile, manifests)).toEqual([])
		expect(checkConfigurationSchemas(manifests)).toEqual([])
		expect(checkBaseImage(profile)).toEqual([])
	})

	it("names a profile package missing from the workspace and a dependency outside the profile", () => {
		const leaking = new Map(packages)
		leaking.set(
			...pkg("@ansora/vulna-domain", ["layer:domain"], ["@ansora/core-server", "@ansora/synthetic-adapter-null"]),
		)
		expect(
			checkClosure({ ...profile, adapters: [...profile.adapters, "@ansora/vulna-adapter-x"] }, leaking).map(
				(f) => f.what,
			),
		).toEqual(["@ansora/vulna-domain → @ansora/synthetic-adapter-null", "@ansora/vulna-adapter-x"])
	})

	it("names a port that no adapter of the profile declares", () => {
		expect(checkPorts(["AuditSink", "ImageArchive"], manifests)).toEqual([
			{ gate: "profile", what: "ImageArchive", reason: "port without an adapter in the profile" },
		])
	})

	it("ties adapters to the entry points of their processes", () => {
		const detached = new Map(packages)
		detached.set(
			...pkg("@ansora/server-worker", ["layer:app"], ["@ansora/core-server", "@ansora/synthetic-adapter-null"]),
		)
		expect(checkProcesses(profile, manifests, detached).map((f) => `${f.what}: ${f.reason}`)).toEqual([
			"@ansora/server-worker → @ansora/vulna-adapter-syslog: the worker entry point does not depend on the adapter",
			"@ansora/server-worker → @ansora/synthetic-adapter-null: adapter outside the profile",
		])
		expect(checkProcesses(profile, [{ ...syslog, processes: ["api"] }, oidc], packages).map((f) => f.reason)).toEqual([
			"the api entry point does not depend on the adapter",
			"the manifest does not allow the worker process",
		])
	})

	it("ADR-054 bod 1 refuses a second production adapter of the clinical record port", () => {
		const medplum = { ...oidc, name: "@ansora/vulna-adapter-clinical-record-medplum", ports: ["ClinicalRecordStore"] }
		const postgres = { ...oidc, name: "@ansora/vulna-adapter-clinical-record-postgres", ports: ["ClinicalRecordStore"] }

		expect(checkClinicalRecordAdapter([medplum])).toEqual([])
		expect(checkClinicalRecordAdapter([medplum, postgres])).toEqual([
			{
				gate: "profile",
				what: "@ansora/vulna-adapter-clinical-record-postgres",
				reason: "a second production adapter of the ClinicalRecordStore port is not built",
			},
		])
	})

	it("fails a target outside the profile and a missing configuration schema", () => {
		expect(checkTargets(profile, [{ ...syslog, outboundCommunication: [{ target: "pacs" }] }])).toHaveLength(1)
		expect(checkConfigurationSchemas([{ ...syslog, configurationSchema: undefined }])).toHaveLength(1)
		expect(checkBaseImage({ ...profile, baseImage: { ...profile.baseImage, digest: null } })).toHaveLength(1)
	})
})

// CAP-029-R30, CAP-029-S20
describe("built images", () => {
	const built = {
		name: "clinical-record-cache",
		dockerfile: "deploy/images/valkey/Dockerfile",
		image: "ansora-vulna-valkey",
		baseImage: { image: "gcr.io/distroless/static-debian13", digest: `sha256:${"b".repeat(64)}` },
		sourceImage: {
			image: "valkey/valkey",
			version: "9.1.2-alpine",
			digest: `sha256:${"c".repeat(64)}`,
			license: "BSD-3-Clause",
		},
	}
	const dockerfile = [
		`FROM valkey/valkey@sha256:${"c".repeat(64)} AS source`,
		`FROM gcr.io/distroless/static-debian13@sha256:${"b".repeat(64)}`,
		"COPY --from=source /usr/local/bin/valkey-server /usr/local/bin/valkey-server",
	].join("\n")

	it("passes a Dockerfile that stands only on the two pinned references", () => {
		expect(checkBuiltImages({ ...profile, builtImages: [built] }, () => dockerfile)).toEqual([])
	})

	it("names a FROM outside the profile and a pinned image the Dockerfile does not use", () => {
		const other = dockerfile.replace(`valkey/valkey@sha256:${"c".repeat(64)}`, "valkey/valkey:latest")
		const findings = checkBuiltImages({ ...profile, builtImages: [built] }, () => other)
		expect(findings.map((finding) => finding.reason)).toEqual(["FROM outside the profile", "pinned image not used"])
	})

	it("reads FROM in any case and past its flags", () => {
		const flagged = `${dockerfile}\nfrom --platform=linux/amd64 alpine:latest AS extra`
		const findings = checkBuiltImages({ ...profile, builtImages: [built] }, () => flagged)
		expect(findings.map((finding) => finding.what)).toEqual(["deploy/images/valkey/Dockerfile: alpine:latest"])
	})

	it("tags the built image like the server image", () => {
		expect(builtImageReference(built, "ansora-vulna-server:1.2.0")).toBe("ansora-vulna-valkey:1.2.0")
		expect(builtImageReference(built, "registry.invalid:5000/ansora-vulna-server:dev")).toBe("ansora-vulna-valkey:dev")
		expect(builtImageReference(built, "registry.invalid:5000/ansora-vulna-server")).toBe("ansora-vulna-valkey:latest")
	})
})

describe("configuration keys used by the server", () => {
	const complete: Schema = { type: "object", additionalProperties: false, properties: {} }
	for (const key of Object.values(CONFIGURATION_KEY)) {
		const [section, name] = key.split(".") as [string, string]
		const properties = complete.properties as Record<string, Schema>
		properties[section] ??= { type: "object", additionalProperties: false, properties: {} }
		;(properties[section].properties as Record<string, Schema>)[name] = { type: "string" }
	}

	it("passes a schema that carries every key the server reads", () => {
		expect(checkConfigurationKeys(complete)).toEqual([])
	})

	it("names a key the schema lacks", () => {
		const { device_token: _, ...withoutDeviceToken } = complete.properties ?? {}
		const findings = checkConfigurationKeys({ ...complete, properties: withoutDeviceToken })
		expect(findings.map((finding) => finding.what)).toEqual([CONFIGURATION_KEY.DEVICE_TOKEN_LIFETIME_SECONDS])
	})
})

describe("code lists of the profile CAP-017-R06", () => {
	const WHAT = "code-lists.json"
	const DEFAULT_LANGUAGE = "cs"

	function listOf(code: string, items: ProfileCodeList["items"] = []): ProfileCodeList {
		return { code, name: code, items }
	}

	const complete: ProfileCodeLists = {
		codeLists: [
			listOf(CODE_LIST.WOUND_TYPE, [
				{
					code: "burn",
					names: [
						{ language: "CS", name: "Popálenina" },
						{ language: "en", name: "Burn" },
					],
				},
			]),
			listOf(CODE_LIST.HEALING_PHASE),
			listOf(CODE_LIST.DOCUMENT_TITLE),
		],
	}

	function reasonsOf(codeLists: ProfileCodeLists): string[] {
		return checkCodeLists(WHAT, codeLists, DEFAULT_LANGUAGE).map((finding) => `${finding.what}: ${finding.reason}`)
	}

	it("passes every list the server knows, with a default language name in any case", () => {
		expect(reasonsOf(complete)).toEqual([])
	})

	it("names a missing list and a list the server does not know", () => {
		const codeLists = { codeLists: [...complete.codeLists.slice(1), listOf("wound-colour")] }

		expect(reasonsOf(codeLists)).toEqual([
			`${WHAT}: code list ${CODE_LIST.WOUND_TYPE} is missing`,
			`${WHAT} wound-colour: unknown code list`,
		])
	})

	it("names a list, an item and a language listed twice", () => {
		const twice = listOf(CODE_LIST.WOUND_TYPE, [
			{ code: "burn", names: [{ language: "cs", name: "Popálenina" }] },
			{
				code: "burn",
				names: [
					{ language: "cs", name: "Popálenina" },
					{ language: "CS", name: "Spálenina" },
				],
			},
		])
		const codeLists = { codeLists: [...complete.codeLists, twice] }

		expect(reasonsOf(codeLists)).toEqual([
			`${WHAT} ${CODE_LIST.WOUND_TYPE}: code list listed twice`,
			`${WHAT} ${CODE_LIST.WOUND_TYPE}/burn: item code listed twice`,
			`${WHAT} ${CODE_LIST.WOUND_TYPE}/burn: a language named twice`,
		])
	})

	it("CAP-012-R28 names an item without a name in the default language", () => {
		const english = listOf(CODE_LIST.HEALING_PHASE, [{ code: "sloughy", names: [{ language: "en", name: "Sloughy" }] }])
		const codeLists = { codeLists: [complete.codeLists[0], english, complete.codeLists[2]] as ProfileCodeList[] }

		expect(reasonsOf(codeLists)).toEqual([
			`${WHAT} ${CODE_LIST.HEALING_PHASE}/sloughy: no name in the default language ${DEFAULT_LANGUAGE}`,
		])
	})
})
