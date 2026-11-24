import type { ClinicalDraftAssessment, ClinicalDraftWoundType } from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import { FINDING_RECORD } from "../draft-records"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf } from "../identifiers"
import { assessmentObservationOf, woundTypeObservationOf } from "../observation-resources"

const INSTANCE_BASE = "https://fhir.mou.cz/vulna"
const context = { systems: identifierSystemsOf(DEFAULT_CANONICAL_BASE), instanceBase: `${INSTANCE_BASE}/` }
const FINDING_ID = "44444444-4444-4444-8444-444444444444"
const ACQUISITION_ID = "55555555-5555-4555-8555-555555555555"
const DEPARTMENT = { id: "33333333-3333-4333-8333-333333333333", code: "KOC" }
const DEPARTMENT_TAG = { system: `${DEFAULT_CANONICAL_BASE}/tag/department`, code: DEPARTMENT.id }
const DRAFT_TAG = { system: `${DEFAULT_CANONICAL_BASE}/tag/draft`, code: ACQUISITION_ID }

const woundType: ClinicalDraftWoundType = {
	findingId: FINDING_ID,
	acquisitionId: ACQUISITION_ID,
	patientResourceId: "patient-7",
	conditionResourceId: "condition-3",
	department: DEPARTMENT,
	woundTypeCode: "leg-ulcer",
	woundTypeName: "Bércový vřed",
}

const assessment: ClinicalDraftAssessment = {
	acquisitionId: ACQUISITION_ID,
	patientResourceId: "patient-7",
	conditionResourceId: "condition-3",
	bodyStructureResourceId: "body-structure-9",
	department: DEPARTMENT,
	healingPhaseCode: "granulating",
	healingPhaseName: "Granulace",
	description: "Okraje klidné",
}

describe("wound type of a draft finding ADR-050 bod 4", () => {
	it("CAP-017-R02 records the code of the instance code list for the finding, chosen by the user", () => {
		const observation = woundTypeObservationOf(woundType, FINDING_RECORD.DRAFT, context)

		expect(observation.identifier).toEqual([
			{ system: `${DEFAULT_CANONICAL_BASE}/sid/finding-wound-type`, value: FINDING_ID },
		])
		expect(observation.status).toBe("preliminary")
		expect(observation.code.coding).toEqual([{ system: "http://loinc.org", code: "72300-7" }])
		expect(observation.subject).toEqual({ reference: "Patient/patient-7" })
		expect(observation.focus).toEqual([{ reference: "Condition/condition-3" }])
		expect(observation.valueCodeableConcept).toEqual({
			coding: [{ system: `${INSTANCE_BASE}/CodeSystem/wound-type`, code: "leg-ulcer", userSelected: true }],
			text: "Bércový vřed",
		})
	})

	it("ADR-050 bod 3 tags the department, the projection and the draft and declares the profile", () => {
		expect(woundTypeObservationOf(woundType, FINDING_RECORD.DRAFT, context).meta).toEqual({
			profile: [`${DEFAULT_CANONICAL_BASE}/StructureDefinition/vulna-wound-type`],
			tag: [DEPARTMENT_TAG, { system: `${DEFAULT_CANONICAL_BASE}/CodeSystem/vulna-projection`, code: "v1" }, DRAFT_TAG],
			source: INSTANCE_BASE,
		})
	})

	it("leaves the text out when the code list has no name in the default language", () => {
		const nameless = woundTypeObservationOf({ ...woundType, woundTypeName: undefined }, FINDING_RECORD.DRAFT, context)

		expect(nameless.valueCodeableConcept).not.toHaveProperty("text")
	})

	it("ADR-052 bod 6 marks a withdrawn wound type as entered in error", () => {
		expect(woundTypeObservationOf(woundType, FINDING_RECORD.WITHDRAWN, context).status).toBe("entered-in-error")
	})
})

describe("assessment of a draft record ADR-050 bod 4", () => {
	it("CAP-017-R03 CAP-017-R04 records the healing phase and the note of the record on its finding and site", () => {
		const observation = assessmentObservationOf(assessment, FINDING_RECORD.DRAFT, context)

		expect(observation.identifier).toEqual([
			{ system: `${DEFAULT_CANONICAL_BASE}/sid/acquisition`, value: ACQUISITION_ID },
		])
		expect(observation.status).toBe("preliminary")
		expect(observation.code.coding).toEqual([{ system: "http://loinc.org", code: "96558-2" }])
		expect(observation.subject).toEqual({ reference: "Patient/patient-7" })
		expect(observation.focus).toEqual([{ reference: "Condition/condition-3" }])
		expect(observation.valueCodeableConcept).toEqual({
			coding: [{ system: `${INSTANCE_BASE}/CodeSystem/healing-phase`, code: "granulating", userSelected: true }],
			text: "Granulace",
		})
		expect(observation.note).toEqual([{ text: "Okraje klidné" }])
		expect(observation.component).toBeUndefined()
	})

	it("datovy-model.md 13.1 points the body site of the observation at the body structure", () => {
		const observation = assessmentObservationOf(assessment, FINDING_RECORD.DRAFT, context)

		expect(observation.bodySite).toEqual({
			extension: [
				{
					url: "http://hl7.org/fhir/StructureDefinition/bodySite",
					valueReference: { reference: "BodyStructure/body-structure-9" },
				},
			],
		})
		expect(observation.extension).toBeUndefined()
	})

	it("ADR-050 bod 3 tags the department, the projection and the draft and declares the profile", () => {
		expect(assessmentObservationOf(assessment, FINDING_RECORD.DRAFT, context).meta).toEqual({
			profile: [`${DEFAULT_CANONICAL_BASE}/StructureDefinition/vulna-healing-phase`],
			tag: [DEPARTMENT_TAG, { system: `${DEFAULT_CANONICAL_BASE}/CodeSystem/vulna-projection`, code: "v1" }, DRAFT_TAG],
			source: INSTANCE_BASE,
		})
	})

	it("ADR-052 bod 6 marks a withdrawn assessment as entered in error", () => {
		expect(assessmentObservationOf(assessment, FINDING_RECORD.WITHDRAWN, context).status).toBe("entered-in-error")
	})

	it("leaves the note out when the record has none", () => {
		expect(assessmentObservationOf({ ...assessment, description: undefined }, FINDING_RECORD.DRAFT, context).note).toBe(
			undefined,
		)
	})
})
