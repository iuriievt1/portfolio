import { describe, expect, it } from "vitest"
import {
	checkClinicalRecordReach,
	checkDicomProjectionDependents,
	checkImport,
	checkTagRule,
	type Project,
} from "../boundary-check"
import { API_MUST_NOT_REACH, TAG_RULES } from "../rules"

const rules = [...TAG_RULES, API_MUST_NOT_REACH]

function project(name: string, directory: string, tags: string[], dependencies: string[] = []): Project {
	return { name, directory, tags, dependencies }
}

const domain = project("@ansora/vulna-domain", "libs/modules/vulna/domain", ["layer:domain", "process:shared"])
const adapter = project("@ansora/vulna-adapter-dicom-dimse", "libs/modules/vulna/adapter-dicom-dimse", [
	"layer:adapter",
	"process:worker",
])
const core = project("@ansora/core-server", "libs/core/server", ["layer:core", "process:shared"])
const clinicalRecord = project(
	"@ansora/vulna-adapter-clinical-record-medplum",
	"libs/modules/vulna/adapter-clinical-record-medplum",
	["layer:adapter", "process:shared"],
)
const projects = new Map([domain, adapter, core].map((entry) => [entry.name, entry]))

describe("B15 package boundaries", () => {
	it("CAP-029-S14 names the domain project, the adapter import and the broken rule", () => {
		const findings = checkImport(
			domain,
			"libs/modules/vulna/domain/src/finding.ts",
			"@ansora/vulna-adapter-dicom-dimse",
			projects,
			rules,
		)
		expect(findings).toEqual([
			{
				where: "libs/modules/vulna/domain/src/finding.ts",
				what: 'import "@ansora/vulna-adapter-dicom-dimse" (layer:adapter)',
				reason: "the domain does not know the adapter",
				source: "ADR-003 ř. 26",
			},
		])
	})

	it("CAP-029-S14 fails the same dependency declared in package.json", () => {
		const declared = new Map(projects)
		declared.set(domain.name, { ...domain, dependencies: [adapter.name] })
		const findings = TAG_RULES.flatMap((rule) => checkTagRule(declared, rule))
		expect(findings.map((finding) => finding.what)).toEqual([
			"@ansora/vulna-domain → @ansora/vulna-adapter-dicom-dimse (layer:adapter)",
		])
	})

	it("lets an adapter import only the ports of the domain and the core", () => {
		const file = "libs/modules/vulna/adapter-dicom-dimse/src/archive.ts"
		expect(checkImport(adapter, file, "@ansora/vulna-domain/ports", projects, rules)).toEqual([])
		expect(checkImport(adapter, file, "@ansora/core-server/ports", projects, rules)).toEqual([])
		expect(checkImport(adapter, file, "@ansora/vulna-domain", projects, rules)).toHaveLength(1)
		expect(checkImport(adapter, file, "@ansora/vulna-domain/src/model", projects, rules)).toHaveLength(1)
	})

	it("fails an adapter importing another adapter", () => {
		const other = project("@ansora/vulna-adapter-oidc", "libs/modules/vulna/adapter-oidc", [
			"layer:adapter",
			"process:api",
		])
		const all = new Map(projects)
		all.set(other.name, other)
		const findings = checkImport(other, "libs/modules/vulna/adapter-syslog/src/a.ts", adapter.name, all, rules)
		expect(findings.map((finding) => finding.reason)).toContain("an adapter must not import another adapter")
		expect(findings.every((finding) => finding.what.startsWith('import "@ansora/vulna-adapter-dicom-dimse"'))).toBe(
			true,
		)
	})

	it("fails the core importing a module and lets it import the contracts", () => {
		expect(checkImport(core, "libs/core/server/src/a.ts", domain.name, projects, rules)).toHaveLength(1)
		expect(checkImport(core, "libs/core/server/src/a.ts", "@ansora/contracts", projects, rules)).toEqual([])
	})

	it("CAP-029-S14 bans @medplum outside the clinical record adapter, also in the FHIR projection of the domain", () => {
		expect(checkImport(domain, "x.ts", "@medplum/core", projects, rules).map((finding) => finding.source)).toEqual([
			"ADR-002 ř. 21 ve znění ADR-042 bod 6, ADR-054 bod 3",
		])
		expect(checkImport(adapter, "x.ts", "@medplum/fhirtypes", projects, rules)).toHaveLength(1)
		expect(checkImport(clinicalRecord, "x.ts", "@medplum/core", projects, rules)).toEqual([])
	})

	it("ADR-054 bod 3 keeps the administration and the mobile app away from the clinical record adapter", () => {
		const admin = project("@ansora/admin", "apps/vulna-admin", ["layer:app", "process:admin"], [clinicalRecord.name])
		const api = project(
			"@ansora/server-api",
			"apps/vulna-server-api",
			["layer:app", "process:api"],
			[clinicalRecord.name],
		)
		const shared = project("@ansora/shared", "libs/shared", ["layer:core", "process:shared"], [clinicalRecord.name])
		const mobile = project("@ansora/mobile", "apps/vulna-mobile", ["layer:app", "process:mobile"], [shared.name])
		const graph = new Map([admin, api, mobile, shared, clinicalRecord].map((entry) => [entry.name, entry]))

		expect(checkClinicalRecordReach(graph).map((finding) => finding.what)).toEqual([
			"@ansora/admin → @ansora/vulna-adapter-clinical-record-medplum",
			"@ansora/mobile → @ansora/vulna-adapter-clinical-record-medplum",
		])
	})

	it("bans the DICOM library outside the worker", () => {
		expect(checkImport(domain, "x.ts", "dcmjs", projects, rules)).toHaveLength(1)
		expect(checkImport(domain, "x.ts", "tesseract.js", projects, rules)).toHaveLength(1)
		expect(checkImport(adapter, "x.ts", "dcmjs/build", projects, rules)).toEqual([])
	})

	it("bans the DICOM fork outside the worker", () => {
		expect(checkImport(domain, "x.ts", "@veevoy/dcmjs", projects, rules)).toHaveLength(1)
		expect(checkImport(core, "x.ts", "@veevoy/dcmjs-dimse", projects, rules)).toHaveLength(1)
		expect(checkImport(adapter, "x.ts", "@veevoy/dcmjs-dimse", projects, rules)).toEqual([])
	})

	describe("ADR-035 bod 1 lets only the entry point of the worker depend on the DICOM projection", () => {
		const projection = project("@ansora/vulna-projection-dicom", "libs/modules/vulna/projection-dicom", [
			"layer:domain",
			"process:worker",
		])
		const worker = project(
			"@ansora/server-worker",
			"apps/vulna-server-worker",
			["layer:app", "process:worker"],
			[projection.name],
		)
		const api = project("@ansora/server-api", "apps/vulna-server-api", ["layer:app", "process:api"])
		const reason = "only the entry point of the worker depends on the DICOM projection"

		it("names every other project that declares the projection", () => {
			const graph = new Map(
				[
					projection,
					worker,
					{ ...api, dependencies: [projection.name] },
					{ ...domain, dependencies: [projection.name] },
				].map((entry) => [entry.name, entry]),
			)

			expect(checkDicomProjectionDependents(graph).map((finding) => [finding.what, finding.reason])).toEqual([
				["@ansora/server-api → @ansora/vulna-projection-dicom", reason],
				["@ansora/vulna-domain → @ansora/vulna-projection-dicom", reason],
			])
		})

		it("names every other project that imports the projection", () => {
			const graph = new Map([projection, worker, api, domain, adapter].map((entry) => [entry.name, entry]))

			expect(checkImport(worker, "apps/vulna-server-worker/src/x.ts", projection.name, graph, rules)).toEqual([])
			expect(checkImport(projection, "x.ts", "@veevoy/dcmjs", graph, rules)).toEqual([])
			for (const importer of [api, domain, adapter]) {
				const reasons = checkImport(importer, "x.ts", projection.name, graph, rules).map((finding) => finding.reason)
				expect(reasons).toContain(reason)
			}
		})

		it("fails when the projection or the worker is not in the graph, so a rename cannot switch the rule off", () => {
			const renamed = new Map([worker].map((entry) => [entry.name, entry]))

			expect(checkDicomProjectionDependents(renamed).map((finding) => finding.what)).toEqual([
				"@ansora/vulna-projection-dicom is not in the project graph",
			])
		})
	})
})
