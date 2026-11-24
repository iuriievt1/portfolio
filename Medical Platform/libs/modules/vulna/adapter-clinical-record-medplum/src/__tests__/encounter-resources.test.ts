import { type ClinicalEncounterRecord, ENCOUNTER_STATUS } from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import { type EncounterContext, encounterBundleOf, resourceIdsOf } from "../encounter-resources"
import type { Bundle, Encounter, Patient, Provenance } from "../fhir-types"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf } from "../identifiers"

const context: EncounterContext = {
	systems: identifierSystemsOf(DEFAULT_CANONICAL_BASE),
	instanceBase: "https://fhir.mou.cz/vulna/",
	serviceProvider: { reference: "Organization/dep" },
	device: { reference: "Device/server" },
}

const record: ClinicalEncounterRecord = {
	patient: {
		patientId: "11111111-1111-4111-8111-111111111111",
		familyName: "Nováková",
		givenName: "Jana",
		birthDate: "1970-02-03",
		sex: "female",
		identifiers: [
			{ system: "mou-nis", value: "123456", issuer: "MOÚ NIS", validUntil: undefined },
			{ system: "mou-nis", value: "000001", issuer: undefined, validUntil: "2026-10-01T00:00:00Z" },
		],
		demographicsRevision: 3,
	},
	encounter: {
		encounterId: "22222222-2222-4222-8222-222222222222",
		status: ENCOUNTER_STATUS.IN_PROGRESS,
		date: "2026-10-07",
		startedAt: "2026-10-07T08:00:00Z",
		statusChangedAt: "2026-10-07T08:00:00Z",
		studyInstanceUid: "2.25.45",
		department: { id: "33333333-3333-4333-8333-333333333333", code: "KOC" },
		completedByUserId: undefined,
	},
}

// CAP-014-R17, CAP-014-R29, ADR-050 bod 3, Q-110
describe("status of a visit left without records", () => {
	function statusOf(status: ClinicalEncounterRecord["encounter"]["status"]): string | undefined {
		const changed = { ...record, encounter: { ...record.encounter, status, statusChangedAt: "2026-10-07T09:00:00Z" } }
		const [, encounterEntry, , provenanceEntry] = encounterBundleOf(changed, context).entry ?? []
		expect(provenanceEntry?.request?.ifNoneExist).toContain(encodeURIComponent(`:${status}:2026-10-07T09:00:00Z`))
		const encounter = encounterEntry?.resource as Encounter | undefined
		return encounter?.status
	}

	it("CAP-014-S51 writes a worklist visit back as planned", () => {
		expect(statusOf(ENCOUNTER_STATUS.PLANNED)).toBe("planned")
	})

	it("CAP-014-S52 writes a visit created in the app as cancelled", () => {
		expect(statusOf(ENCOUNTER_STATUS.CANCELLED)).toBe("cancelled")
	})
})

// CAP-014-R17, ADR-050 bod 3, ADR-050 bod 9, ADR-050 bod 10
describe("transaction of the first record of a visit", () => {
	const bundle = encounterBundleOf(record, context)
	const [patientEntry, encounterEntry, patientProvenance, encounterProvenance] = bundle.entry ?? []

	it("updates the patient conditionally by our identifier and carries the identifiers of the customer", () => {
		expect(bundle.type).toBe("transaction")
		expect(patientEntry?.request).toEqual({
			method: "PUT",
			url: `Patient?identifier=${encodeURIComponent(`${context.systems.patient}|${record.patient.patientId}`)}`,
		})
		const patient = patientEntry?.resource as Patient
		expect(patient.identifier?.map((identifier) => identifier.system)).toEqual([
			context.systems.patient,
			"https://fhir.mou.cz/vulna/sid/customer/mo-nis/patient-id",
			"https://fhir.mou.cz/vulna/sid/customer/registry/patient-id",
		])
		expect(patient.identifier?.[2]).toMatchObject({ use: "old", period: { end: "2026-10-01T00:00:00Z" } })
		expect(patient.name).toEqual([{ family: "Nováková", given: ["Jana"] }])
		expect(patient.gender).toBe("female")
	})

	it("CHG-175 NAB-479 writes a patient created from the wristband with identifiers only", () => {
		const unnamed = {
			...record,
			patient: {
				...record.patient,
				familyName: undefined,
				givenName: undefined,
				birthDate: undefined,
				sex: undefined,
				identifiers: [{ system: "mou-nis", value: "5603121234", issuer: undefined, validUntil: undefined }],
			},
		}
		const [entry] = encounterBundleOf(unnamed, context).entry ?? []
		const patient = entry?.resource as Patient

		expect(patient.identifier?.map((identifier) => identifier.value)).toEqual([record.patient.patientId, "5603121234"])
		expect(patient).not.toHaveProperty("name")
		expect(patient).not.toHaveProperty("birthDate")
		expect(patient).not.toHaveProperty("gender")
	})

	it("writes the visit in progress with its study, department tag and provider", () => {
		const encounter = encounterEntry?.resource as Encounter
		expect(encounter.status).toBe("in-progress")
		expect(encounter.subject).toEqual({ reference: `urn:uuid:${record.patient.patientId}` })
		expect(encounter.serviceProvider).toEqual(context.serviceProvider)
		expect(encounter.meta?.tag).toEqual([
			{ system: context.systems.departmentTag, code: record.encounter.department?.id },
		])
		expect(encounter.identifier?.[1]).toMatchObject({ system: "urn:dicom:uid", value: "urn:oid:2.25.45" })
	})

	it("records provenance once per demographics revision and per status change, by the server device", () => {
		expect(patientProvenance?.request?.ifNoneExist).toBe(
			`_tag=${encodeURIComponent(`${context.systems.provenanceKeyTag}|patient:${record.patient.patientId}:3`)}`,
		)
		expect(encounterProvenance?.request?.ifNoneExist).toBe(
			`_tag=${encodeURIComponent(
				`${context.systems.provenanceKeyTag}|encounter:${record.encounter.encounterId}:in_progress:2026-10-07T08:00:00Z`,
			)}`,
		)
		const provenance = encounterProvenance?.resource as Provenance
		expect(provenance.agent?.[0]?.who).toEqual(context.device)
		expect(provenance.target).toEqual([{ reference: `urn:uuid:${record.encounter.encounterId}` }])
	})
})

describe("answer of the store", () => {
	it("reads the ids of the patient and the visit from the entries", () => {
		const result: Bundle = {
			resourceType: "Bundle",
			type: "transaction-response",
			entry: [
				{ response: { status: "200 OK", location: "Patient/p1/_history/2" } },
				{
					response: { status: "201 Created" },
					resource: { resourceType: "Encounter", id: "e1", status: "in-progress", class: {} },
				},
				{ response: { status: "200 OK", location: "Provenance/x/_history/1" } },
				{ response: { status: "201 Created", location: "Provenance/y/_history/1" } },
			],
		}
		expect(resourceIdsOf(result)).toEqual({ patient: "p1", encounter: "e1" })
	})

	it("treats an error in an entry as a rejection", () => {
		const result: Bundle = {
			resourceType: "Bundle",
			type: "transaction-response",
			entry: [{ response: { status: "400 Bad Request" } }],
		}
		expect(() => resourceIdsOf(result)).toThrow("patient")
	})
})
