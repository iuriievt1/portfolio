import type { ClinicalDraftFinding, ClinicalDraftWoundType, ClinicalWoundTypeChange } from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import { FINDING_RECORD } from "../draft-records"
import type { Observation, PractitionerRole, Provenance, Reference } from "../fhir-types"
import { conditionOf } from "../finding-resources"
import { closedWoundsOf } from "../history-resources"
import { codeSystemUrlOf, DEFAULT_CANONICAL_BASE, identifierSystemsOf, tokenOf } from "../identifiers"
import { woundTypeObservationOf } from "../observation-resources"
import type { ProjectionContext } from "../resource-meta"
import { woundTypeChangeBundleOf } from "../wound-type-change-resources"

const context: ProjectionContext = {
	systems: identifierSystemsOf(DEFAULT_CANONICAL_BASE),
	instanceBase: "https://fhir.mou.cz/vulna/",
}
const DEPARTMENT = { id: "33333333-3333-4333-8333-333333333333", code: "KOC" }
const FINDING_ID = "44444444-4444-4444-8444-444444444444"
const ACQUISITION_ID = "55555555-5555-4555-8555-555555555555"
const CHANGE_ID = "66666666-6666-4666-8666-666666666666"
const PATIENT_ID = "11111111-1111-4111-8111-111111111111"
const CONDITION_ID = "condition-3"
const CHANGED_AT = "2026-10-22T09:15:00.000Z"
const AUTHOR: Reference<PractitionerRole> = { reference: "PractitionerRole/role-7" }

const change: ClinicalWoundTypeChange = {
	changeId: CHANGE_ID,
	findingId: FINDING_ID,
	patientId: PATIENT_ID,
	patientResourceId: "patient-7",
	conditionResourceId: CONDITION_ID,
	department: DEPARTMENT,
	woundTypeCode: "leg-ulcer",
	woundTypeName: "Bércový vřed",
	changedAt: CHANGED_AT,
	author: { userId: "77777777-7777-4777-8777-777777777777", department: DEPARTMENT },
}

const closedWoundType: ClinicalDraftWoundType = {
	findingId: FINDING_ID,
	acquisitionId: ACQUISITION_ID,
	patientResourceId: "patient-7",
	conditionResourceId: CONDITION_ID,
	department: DEPARTMENT,
	woundTypeCode: "traumatic-wound",
	woundTypeName: "Traumatická rána",
}

const finding: ClinicalDraftFinding = {
	findingId: FINDING_ID,
	acquisitionId: ACQUISITION_ID,
	patientResourceId: "patient-7",
	department: DEPARTMENT,
	site: {
		regionCode: "25763004",
		laterality: "R",
		surface: "anterior",
		view: "anterior",
		x: 0.4,
		y: 0.85,
		bodyDiagramVersion: "2",
	},
}

function entriesOf() {
	const bundle = woundTypeChangeBundleOf(change, AUTHOR, context)
	const [observationEntry, provenanceEntry] = bundle.entry ?? []
	if (observationEntry === undefined || provenanceEntry === undefined) {
		throw new Error("the change writes no observation or provenance")
	}
	return {
		bundle,
		observationEntry,
		provenanceEntry,
		observation: observationEntry.resource as Observation,
		provenance: provenanceEntry.resource as Provenance,
	}
}

// CAP-020-R21, ADR-049 (doplnění D32), ADR-050 bod 10, backend.md 3 T5
describe("wound type change written into the clinical record", () => {
	it("CAP-020-S25 amends the wound type observation with the new type and its author", () => {
		const { observation } = entriesOf()

		expect(observation).toEqual({
			...woundTypeObservationOf(closedWoundType, FINDING_RECORD.CLOSED, context),
			status: "amended",
			issued: CHANGED_AT,
			valueCodeableConcept: {
				coding: [
					{ system: codeSystemUrlOf(context.instanceBase, "wound-type"), code: "leg-ulcer", userSelected: true },
				],
				text: "Bércový vřed",
			},
			performer: [AUTHOR],
		})
	})

	it("ADR-049 (doplnění D32) rewrites the one wound type observation of the finding, not a second one", () => {
		const { observationEntry } = entriesOf()

		expect(observationEntry.request).toEqual({
			method: "PUT",
			url: `Observation?identifier=${encodeURIComponent(tokenOf(context.systems.findingWoundType, FINDING_ID))}`,
		})
	})

	it("CAP-025-R30 records who changed the type and when as the provenance of that change only", () => {
		const { observationEntry, provenanceEntry, provenance } = entriesOf()

		expect(provenance.target).toEqual([{ reference: observationEntry.fullUrl }])
		expect(provenance.recorded).toBe(CHANGED_AT)
		expect(provenance.agent).toEqual([
			{
				type: {
					coding: [{ system: "http://terminology.hl7.org/CodeSystem/provenance-participant-type", code: "author" }],
				},
				who: AUTHOR,
			},
		])
		expect(provenance.meta?.tag).toEqual([
			{ system: context.systems.provenanceKeyTag, code: `finding:${FINDING_ID}:wound-type-change:${CHANGE_ID}` },
			{ system: context.systems.patientTag, code: PATIENT_ID },
		])
		expect(provenanceEntry.request?.method).toBe("POST")
	})

	it("ADR-050 bod 10 writes the change as one transaction of two entries", () => {
		const { bundle } = entriesOf()

		expect(bundle.type).toBe("transaction")
		expect(bundle.entry).toHaveLength(2)
	})

	it("CAP-020-R21 shows the changed type in the history read back from the store", () => {
		const { observation } = entriesOf()
		const condition = { ...conditionOf(finding, FINDING_RECORD.CLOSED, context), id: CONDITION_ID }

		const records = closedWoundsOf(
			{ observations: [{ ...observation, id: "observation-1" }], conditions: [condition], bodyStructures: [] },
			context,
		)

		expect(records.findings).toEqual([{ findingId: FINDING_ID, woundTypeCode: "leg-ulcer" }])
	})
})
