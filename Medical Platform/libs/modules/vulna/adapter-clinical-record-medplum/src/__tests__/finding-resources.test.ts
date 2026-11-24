import type { ClinicalDraftFinding, ClinicalDraftWoundType } from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import { FINDING_RECORD } from "../draft-records"
import type { BodyStructure, Bundle, Condition, Extension, Observation } from "../fhir-types"
import {
	bodyStructureOf,
	conditionOf,
	findingBundleOf,
	findingResourceIdsOf,
	withdrawnFindingBundleOf,
} from "../finding-resources"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf } from "../identifiers"

const INSTANCE_BASE = "https://fhir.mou.cz/vulna"
const context = { systems: identifierSystemsOf(DEFAULT_CANONICAL_BASE), instanceBase: `${INSTANCE_BASE}/` }
const FINDING_ID = "44444444-4444-4444-8444-444444444444"
const ACQUISITION_ID = "55555555-5555-4555-8555-555555555555"
const DEPARTMENT_ID = "33333333-3333-4333-8333-333333333333"

const finding: ClinicalDraftFinding = {
	findingId: FINDING_ID,
	acquisitionId: ACQUISITION_ID,
	patientResourceId: "patient-7",
	department: { id: DEPARTMENT_ID, code: "KOC" },
	site: {
		regionCode: "181553006",
		laterality: "R",
		surface: "anterior",
		view: "anterior",
		x: 0.375,
		y: 0.755,
		bodyDiagramVersion: "1",
	},
}

const woundType: ClinicalDraftWoundType = {
	findingId: FINDING_ID,
	acquisitionId: ACQUISITION_ID,
	patientResourceId: "patient-7",
	conditionResourceId: "condition-3",
	department: { id: DEPARTMENT_ID, code: "KOC" },
	woundTypeCode: "leg-ulcer",
	woundTypeName: "Bércový vřed",
}

function part(extensions: readonly Extension[] | undefined, url: string): Extension | undefined {
	return extensions?.find((extension) => extension.url === url)
}

describe("finding of a draft record", () => {
	it("ADR-050 bod 4 documents a wound without clinical status, unconfirmed while the record is open", () => {
		const condition = conditionOf(finding, FINDING_RECORD.DRAFT, context)
		expect(condition.identifier).toEqual([{ system: `${DEFAULT_CANONICAL_BASE}/sid/finding`, value: FINDING_ID }])
		expect(condition.code?.coding).toEqual([
			{ system: `${DEFAULT_CANONICAL_BASE}/CodeSystem/vulna-finding-kind`, code: "wound" },
		])
		expect(condition.category?.[0]?.coding?.[0]?.code).toBe("wound-documentation")
		expect(condition.verificationStatus?.coding?.[0]?.code).toBe("unconfirmed")
		expect(condition.clinicalStatus).toBeUndefined()
		expect(condition.recorder).toBeUndefined()
		expect(condition.subject).toEqual({ reference: "Patient/patient-7" })
	})

	it("ADR-052 bod 5 tags every resource of the draft with the department, the projection and the record", () => {
		const tags = [
			{ system: `${DEFAULT_CANONICAL_BASE}/tag/department`, code: DEPARTMENT_ID },
			{ system: `${DEFAULT_CANONICAL_BASE}/CodeSystem/vulna-projection`, code: "v1" },
			{ system: `${DEFAULT_CANONICAL_BASE}/tag/draft`, code: ACQUISITION_ID },
		]
		expect(conditionOf(finding, FINDING_RECORD.DRAFT, context).meta?.tag).toEqual(tags)
		expect(bodyStructureOf(finding, FINDING_RECORD.DRAFT, context).meta?.tag).toEqual(tags)
	})

	it("ADR-050 bod 3 declares exactly one Vulna profile and the instance as the source", () => {
		expect(conditionOf(finding, FINDING_RECORD.DRAFT, context).meta).toMatchObject({
			profile: [`${DEFAULT_CANONICAL_BASE}/StructureDefinition/vulna-wound-finding`],
			source: INSTANCE_BASE,
		})
		expect(bodyStructureOf(finding, FINDING_RECORD.DRAFT, context).meta).toMatchObject({
			profile: [`${DEFAULT_CANONICAL_BASE}/StructureDefinition/vulna-wound-site`],
			source: INSTANCE_BASE,
		})
	})

	it("leaves out the department tag of a finding without a department", () => {
		const tags = conditionOf({ ...finding, department: undefined }, FINDING_RECORD.DRAFT, context).meta?.tag
		expect(tags?.map((tag) => tag.system)).toEqual([
			`${DEFAULT_CANONICAL_BASE}/CodeSystem/vulna-projection`,
			`${DEFAULT_CANONICAL_BASE}/tag/draft`,
		])
	})

	it("ADR-050 (doplnění D33) bod 3 withdraws a dropped finding as entered in error, never deleted", () => {
		expect(conditionOf(finding, FINDING_RECORD.WITHDRAWN, context).verificationStatus?.coding?.[0]?.code).toBe(
			"entered-in-error",
		)
		expect(bodyStructureOf(finding, FINDING_RECORD.WITHDRAWN, context).active).toBe(false)
	})
})

describe("body structure of a finding", () => {
	const structure = bodyStructureOf(finding, FINDING_RECORD.DRAFT, context)
	const included = part(
		structure.extension,
		"http://hl7.org/fhir/5.0/StructureDefinition/extension-BodyStructure.includedStructure",
	)
	const position = part(structure.extension, `${DEFAULT_CANONICAL_BASE}/StructureDefinition/body-diagram-position`)

	it("datovy-model.md 13.3 is one per finding and version of the body diagram", () => {
		expect(structure.identifier).toEqual([
			{ system: `${DEFAULT_CANONICAL_BASE}/sid/finding-site`, value: `${FINDING_ID}:1` },
		])
		expect(structure.active).toBe(true)
	})

	it("CAP-016-R03, CAP-016-R16, CAP-016-R20 carry the region without side, the patient's side and the surface", () => {
		expect(part(included?.extension, "structure")?.valueCodeableConcept?.coding).toEqual([
			{ system: "http://snomed.info/sct", code: "181553006", userSelected: true },
		])
		expect(part(included?.extension, "laterality")?.valueCodeableConcept?.coding).toEqual([
			{ system: "http://snomed.info/sct", code: "24028007", userSelected: true },
		])
		expect(part(included?.extension, "qualifier")?.valueCodeableConcept?.coding?.[0]?.code).toBe("anterior")
	})

	it("ADR-050 bod 15 writes the left side as its SNOMED CT code", () => {
		const left = bodyStructureOf(
			{ ...finding, site: { ...finding.site, laterality: "L" } },
			FINDING_RECORD.DRAFT,
			context,
		)
		const leftPart = part(
			left.extension,
			"http://hl7.org/fhir/5.0/StructureDefinition/extension-BodyStructure.includedStructure",
		)
		expect(part(leftPart?.extension, "laterality")?.valueCodeableConcept?.coding?.[0]?.code).toBe("7771000")
	})

	it("CAP-016-R11 carries no laterality on an unpaired region", () => {
		const sacral = bodyStructureOf(
			{ ...finding, site: { ...finding.site, regionCode: "51027004", laterality: null, view: "posterior" } },
			FINDING_RECORD.DRAFT,
			context,
		)
		const structurePart = part(
			sacral.extension,
			"http://hl7.org/fhir/5.0/StructureDefinition/extension-BodyStructure.includedStructure",
		)
		expect(part(structurePart?.extension, "laterality")).toBeUndefined()
	})

	it("CAP-016-R04 keeps the view, the normalised point and the version as the frame of the coordinates", () => {
		expect(position?.extension).toEqual([
			{ url: "view", valueCode: "anterior" },
			{ url: "coordinateX", valueDecimal: 0.375 },
			{ url: "coordinateY", valueDecimal: 0.755 },
			{ url: "diagramVersion", valueString: "1" },
		])
	})
})

describe("write of a draft finding", () => {
	it("ADR-050 bod 10 writes the finding and its body structure in one transaction by identifier", () => {
		const bundle = findingBundleOf(finding, FINDING_RECORD.DRAFT, context)
		expect(bundle.type).toBe("transaction")
		expect(bundle.entry?.map((entry) => entry.request)).toEqual([
			{
				method: "PUT",
				url: `Condition?identifier=${encodeURIComponent(`${DEFAULT_CANONICAL_BASE}/sid/finding|${FINDING_ID}`)}`,
			},
			{
				method: "PUT",
				url: `BodyStructure?identifier=${encodeURIComponent(`${DEFAULT_CANONICAL_BASE}/sid/finding-site|${FINDING_ID}:1`)}`,
			},
		])
	})

	it("ADR-050 bod 10 withdraws the finding, its body structure and its wound type in one transaction", () => {
		const bundle = withdrawnFindingBundleOf(finding, woundType, context)
		const [condition, bodyStructure, observation] = bundle.entry ?? []

		expect(bundle.type).toBe("transaction")
		expect(bundle.entry).toHaveLength(3)
		expect(observation?.request).toEqual({
			method: "PUT",
			url: `Observation?identifier=${encodeURIComponent(`${DEFAULT_CANONICAL_BASE}/sid/finding-wound-type|${FINDING_ID}`)}`,
		})
		expect((condition?.resource as Condition | undefined)?.verificationStatus?.coding?.[0]?.code).toBe(
			"entered-in-error",
		)
		expect((bodyStructure?.resource as BodyStructure | undefined)?.active).toBe(false)
		expect((observation?.resource as Observation | undefined)?.status).toBe("entered-in-error")
	})

	it("withdraws a finding without a wound type in two entries", () => {
		expect(withdrawnFindingBundleOf(finding, undefined, context).entry).toHaveLength(2)
	})

	it("reads the ids the store gave", () => {
		const result: Bundle = {
			resourceType: "Bundle",
			type: "transaction-response",
			entry: [
				{ response: { status: "201 Created", location: "Condition/c-1/_history/1" } },
				{ response: { status: "200 OK", location: "BodyStructure/b-1/_history/2" } },
			],
		}
		expect(findingResourceIdsOf(result)).toEqual({ condition: "c-1", bodyStructure: "b-1" })
	})

	it("refuses a result without the body structure", () => {
		const result: Bundle = {
			resourceType: "Bundle",
			type: "transaction-response",
			entry: [{ response: { status: "201 Created", location: "Condition/c-1/_history/1" } }],
		}
		expect(() => findingResourceIdsOf(result)).toThrow("body structure")
	})
})
