import type {
	ClinicalClosure,
	ClinicalDraftAssessment,
	ClinicalDraftFinding,
	ClinicalDraftWoundType,
	ClinicalScanClosure,
	ClinicalWoundClosure,
} from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import { type ClosureReferences, scanClosureBundleOf, woundClosureBundleOf } from "../closure-resources"
import { FINDING_RECORD } from "../draft-records"
import type { BodyStructure, Bundle, Condition, DocumentReference, Observation, Resource } from "../fhir-types"
import { bodyStructureOf, conditionOf } from "../finding-resources"
import {
	acquisitionIdsOf,
	bodySiteOf,
	clinicalObservationQueryOf,
	closedScansOf,
	closedWoundsOf,
	encounterFilterOf,
	scannedDocumentQueryOf,
	studyFilterOf,
} from "../history-resources"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf } from "../identifiers"
import type { ProjectionContext } from "../resource-meta"

const context: ProjectionContext = {
	systems: identifierSystemsOf(DEFAULT_CANONICAL_BASE),
	instanceBase: "https://fhir.mou.cz/vulna/",
}
const DEPARTMENT = { id: "33333333-3333-4333-8333-333333333333", code: "KOC" }
const ACQUISITION_ID = "55555555-5555-4555-8555-555555555555"
const SCAN_ACQUISITION_ID = "56565656-5656-4565-8565-565656565656"
const FINDING_ID = "44444444-4444-4444-8444-444444444444"
const DOCUMENT_ID = "88888888-8888-4888-8888-888888888888"
const CONDITION_ID = "condition-3"
const BODY_STRUCTURE_ID = "body-structure-9"
const DRAFT_TAG = `${DEFAULT_CANONICAL_BASE}/tag/draft|`

const references: ClosureReferences = {
	author: { reference: "PractitionerRole/role-1" },
	station: { reference: "Device/device-1" },
	department: { reference: "Organization/department-1" },
	existingStudy: undefined,
}

const finding: ClinicalDraftFinding = {
	findingId: FINDING_ID,
	acquisitionId: ACQUISITION_ID,
	patientResourceId: "patient-7",
	department: DEPARTMENT,
	site: {
		regionCode: "181553006",
		laterality: "R",
		surface: "anterior",
		view: "anterior",
		x: 0.375,
		y: 0.755,
		bodyDiagramVersion: "2",
	},
}

const woundType: ClinicalDraftWoundType = {
	findingId: FINDING_ID,
	acquisitionId: ACQUISITION_ID,
	patientResourceId: "patient-7",
	conditionResourceId: CONDITION_ID,
	department: DEPARTMENT,
	woundTypeCode: "leg-ulcer",
	woundTypeName: "Bércový vřed",
}

const assessment: ClinicalDraftAssessment = {
	acquisitionId: ACQUISITION_ID,
	patientResourceId: "patient-7",
	conditionResourceId: CONDITION_ID,
	bodyStructureResourceId: BODY_STRUCTURE_ID,
	department: DEPARTMENT,
	healingPhaseCode: "granulating",
	healingPhaseName: "Granulace",
	description: "Bez známek infekce",
}

const closure: ClinicalClosure = {
	acquisitionId: ACQUISITION_ID,
	patientId: "11111111-1111-4111-8111-111111111111",
	patientResourceId: "patient-7",
	department: DEPARTMENT,
	startedAt: "2026-10-07T07:50:00.000Z",
	closedAt: "2026-10-07T07:59:50.000Z",
	author: { userId: "77777777-7777-4777-8777-777777777777", department: DEPARTMENT },
	station: { deviceId: "66666666-6666-4666-8666-666666666666", model: "SM-A576B" },
	study: {
		encounterId: "22222222-2222-4222-8222-222222222222",
		encounterResourceId: "encounter-5",
		studyInstanceUid: "2.25.45",
		started: "2026-10-07T07:30:00.000Z",
		department: DEPARTMENT,
	},
	series: { seriesInstanceUid: "2.25.77", number: 2, bodyRegion: undefined, laterality: "R" },
}

const woundClosure: ClinicalWoundClosure = {
	...closure,
	firstRecord: { finding, woundType },
	assessment,
	closedWoundType: { code: "leg-ulcer", name: "Bércový vřed" },
}

const scanClosure: ClinicalScanClosure = {
	...closure,
	acquisitionId: SCAN_ACQUISITION_ID,
	series: { seriesInstanceUid: "2.25.78", number: 3, bodyRegion: undefined, laterality: null },
	documentId: DOCUMENT_ID,
	title: { code: "discharge-report", text: "Propouštěcí zpráva" },
	pageCount: 3,
}

function ofType<T extends Resource>(bundle: Bundle, resourceType: T["resourceType"]): T[] {
	return (bundle.entry ?? [])
		.map((entry) => entry.resource as Resource)
		.filter((resource): resource is T => resource.resourceType === resourceType)
}

function storedWound() {
	const bundle = woundClosureBundleOf(woundClosure, references, context)
	const [structure] = ofType<BodyStructure>(bundle, "BodyStructure")
	const [condition] = ofType<Condition>(bundle, "Condition")
	if (structure === undefined || condition === undefined) {
		throw new Error("the closure writes no finding")
	}
	return {
		observations: ofType<Observation>(bundle, "Observation"),
		conditions: [{ ...condition, id: CONDITION_ID }],
		bodyStructures: [{ ...structure, id: BODY_STRUCTURE_ID }],
	}
}

function storedDocument(): DocumentReference {
	const [document] = ofType<DocumentReference>(
		scanClosureBundleOf(scanClosure, references, context),
		"DocumentReference",
	)
	if (document === undefined) {
		throw new Error("the closure writes no document")
	}
	return document
}

// ADR-054 bod 2, CAP-020-R03, datovy-model.md 13.1
describe("closed records read back from the store", () => {
	it("CAP-020-S08 reads back the wound record exactly as the closure wrote it", () => {
		expect(closedWoundsOf(storedWound(), context)).toEqual({
			findings: [{ findingId: FINDING_ID, woundTypeCode: "leg-ulcer" }],
			wounds: [
				{
					acquisitionId: ACQUISITION_ID,
					findingId: FINDING_ID,
					site: {
						regionCode: "181553006",
						laterality: "R",
						view: "anterior",
						x: 0.375,
						y: 0.755,
						bodyDiagramVersion: "2",
					},
					healingPhaseCode: "granulating",
					description: "Bez známek infekce",
					closedWoundTypeCode: "leg-ulcer",
				},
			],
		})
	})

	it("CAP-020-S15 reads back the scanned document exactly as the closure wrote it", () => {
		expect(closedScansOf([storedDocument()], context)).toEqual([
			{
				acquisitionId: SCAN_ACQUISITION_ID,
				documentId: DOCUMENT_ID,
				closedAt: "2026-10-07T07:59:50.000Z",
				title: { code: "discharge-report", text: "Propouštěcí zpráva" },
				pageCount: 3,
			},
		])
	})

	it("CAP-016-R16 reads back every view and side of the body diagram", () => {
		for (const site of [
			{ regionCode: "181553006", laterality: "L" as const, view: "posterior" as const },
			{ regionCode: "302545001", laterality: null, view: "plantar" as const },
			{ regionCode: "302545001", laterality: "R" as const, view: "right_lateral" as const },
		]) {
			const placed = { ...finding, site: { ...finding.site, ...site } }

			expect(bodySiteOf(bodyStructureOf(placed, FINDING_RECORD.CLOSED, context), context)).toEqual({
				...site,
				x: 0.375,
				y: 0.755,
				bodyDiagramVersion: "2",
			})
		}
	})

	it("CAP-020-R16 shows no site and no finding the store did not hand over", () => {
		const { observations } = storedWound()

		const records = closedWoundsOf({ observations, conditions: [], bodyStructures: [] }, context)

		expect(records.findings).toEqual([])
		expect(records.wounds).toEqual([
			expect.objectContaining({ acquisitionId: ACQUISITION_ID, findingId: undefined, site: undefined }),
		])
	})

	it("ADR-052 bod 5 never takes a finding of a draft for a closed one", () => {
		const stored = storedWound()
		const draft = { ...conditionOf(finding, FINDING_RECORD.DRAFT, context), id: CONDITION_ID }

		expect(closedWoundsOf({ ...stored, conditions: [draft] }, context).findings).toEqual([])
	})

	it("CAP-020-R17 leaves out a resource without the identifier of its record", () => {
		const anonymous = { ...storedDocument(), identifier: [] }

		expect(closedScansOf([anonymous], context)).toEqual([])
	})

	it("CAP-014-R22 counts each closed record of a visit once", () => {
		const { observations } = storedWound()

		expect(acquisitionIdsOf(observations, [storedDocument()], context)).toEqual([ACQUISITION_ID, SCAN_ACQUISITION_ID])
	})
})

// ADR-050 bod 8, ADR-052 bod 5, ADR-053 bod 3
describe("queries of the closed records", () => {
	it("CAP-020-R20 asks only for closed, valid observations with their findings", () => {
		expect(clinicalObservationQueryOf(context, { subject: "Patient/patient-7" })).toEqual({
			subject: "Patient/patient-7",
			"_tag:not": DRAFT_TAG,
			code: "http://loinc.org|96558-2,http://loinc.org|72300-7",
			"status:not": "entered-in-error",
			_include: "Observation:focus",
		})
	})

	it("CAP-020-R18 asks only for closed current scanned documents", () => {
		expect(scannedDocumentQueryOf(context, encounterFilterOf(["encounter-5", "encounter-6"]))).toEqual({
			encounter: "Encounter/encounter-5,Encounter/encounter-6",
			"_tag:not": DRAFT_TAG,
			_profile: `${DEFAULT_CANONICAL_BASE}/StructureDefinition/vulna-scanned-document`,
			status: "current",
		})
	})

	it("CAP-014-R22 finds the assessments of a visit through its study", () => {
		expect(studyFilterOf(["study-1", "study-2"])).toEqual({ "part-of": "ImagingStudy/study-1,ImagingStudy/study-2" })
	})
})
