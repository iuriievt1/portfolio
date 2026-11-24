import {
	type ClinicalDelivery,
	type ClinicalFoundedDocument,
	ClinicalRecordStoreError,
} from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import { deliveryBundleOf } from "../delivery-resources"
import { draftStudyOf, withdrawnStudyOf } from "../document-resources"
import type { ImagingStudy } from "../fhir-types"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf, tokenOf } from "../identifiers"
import type { ProjectionContext } from "../resource-meta"

const context: ProjectionContext = {
	systems: identifierSystemsOf(DEFAULT_CANONICAL_BASE),
	instanceBase: "https://fhir.mou.cz/vulna/",
}
const { systems } = context
const ENCOUNTER_ID = "11111111-1111-4111-8111-111111111111"
const ACQUISITION_ID = "22222222-2222-4222-8222-222222222222"
const PATIENT_ID = "33333333-3333-4333-8333-333333333333"
const WOUND_SERIES = "2.25.101"
const OTHER_SERIES = "2.25.102"
const DOCUMENT_SERIES = "2.25.103"
const NEW_DOCUMENT_SERIES = "2.25.104"
const VL_PHOTOGRAPHIC = "1.2.840.10008.5.1.4.1.1.77.1.4"
const ENCAPSULATED_PDF = "1.2.840.10008.5.1.4.1.1.104.1"
const SERVER = { reference: "Device/server-1" }

const EXISTING: ImagingStudy = {
	resourceType: "ImagingStudy",
	id: "study-1",
	status: "registered",
	subject: { reference: "Patient/patient-1" },
	series: [
		{ uid: WOUND_SERIES, number: 1, modality: { code: "XC" }, description: "stale" },
		{ uid: OTHER_SERIES, number: 2, modality: { code: "XC" } },
		{ uid: DOCUMENT_SERIES, number: 3, modality: { code: "DOC" } },
	],
}

function delivery(change: Partial<ClinicalDelivery> = {}): ClinicalDelivery {
	return {
		acquisitionId: ACQUISITION_ID,
		patientId: PATIENT_ID,
		study: { encounterId: ENCOUNTER_ID },
		instances: [
			{
				seriesInstanceUid: WOUND_SERIES,
				sopClassUid: VL_PHOTOGRAPHIC,
				sopInstanceUid: "2.25.1002",
				number: 2,
				title: "ORIGINAL\\PRIMARY",
				description: undefined,
				seriesDescription: "Rána 1 · levý bok",
			},
			{
				seriesInstanceUid: WOUND_SERIES,
				sopClassUid: VL_PHOTOGRAPHIC,
				sopInstanceUid: "2.25.1001",
				number: 1,
				title: "DERIVED\\PRIMARY",
				description: "Oříznutí na zařízení",
				seriesDescription: "Rána 1 · levý bok",
			},
		],
		createdAt: "2026-11-09T10:15:30.250Z",
		confirmedAt: "2026-11-09T10:16:02.000Z",
		...change,
	}
}

function deliveredStudyOf(change: Partial<ClinicalDelivery> = {}): ImagingStudy {
	const study = deliveryBundleOf(EXISTING, delivery(change), SERVER, context).entry?.[0]?.resource
	if (study?.resourceType !== "ImagingStudy") {
		throw new Error("the delivery bundle starts with the study")
	}
	return study
}

const FOUNDED_DOCUMENT: ClinicalFoundedDocument = {
	documentId: "44444444-4444-4444-8444-444444444444",
	acquisitionId: "55555555-5555-4555-8555-555555555555",
	department: undefined,
	patientResourceId: "patient-1",
	study: {
		encounterId: ENCOUNTER_ID,
		encounterResourceId: "encounter-1",
		studyInstanceUid: "2.25.10",
		started: undefined,
		department: undefined,
	},
	series: { seriesInstanceUid: NEW_DOCUMENT_SERIES, number: 4, bodyRegion: undefined, laterality: null },
}

describe("the study after a confirmed C-STORE CAP-021-R28 ✓ integrace-dicom.md 5.9", () => {
	it("adds the confirmed instances in order with the texts the builder wrote and makes the study available", () => {
		const study = deliveredStudyOf()

		expect(study.status).toBe("available")
		expect(study.series?.[0]).toEqual({
			uid: WOUND_SERIES,
			number: 1,
			modality: { code: "XC" },
			description: "Rána 1 · levý bok",
			numberOfInstances: 2,
			instance: [
				{
					uid: "2.25.1001",
					sopClass: { system: "urn:ietf:rfc:3986", code: `urn:oid:${VL_PHOTOGRAPHIC}` },
					number: 1,
					title: "DERIVED\\PRIMARY",
					extension: [{ url: systems.instanceDescription, valueString: "Oříznutí na zařízení" }],
				},
				{
					uid: "2.25.1002",
					sopClass: { system: "urn:ietf:rfc:3986", code: `urn:oid:${VL_PHOTOGRAPHIC}` },
					number: 2,
					title: "ORIGINAL\\PRIMARY",
				},
			],
		})
		expect(study.series?.[1]).toEqual(EXISTING.series?.[1])
		expect(study).toMatchObject({ numberOfSeries: 1, numberOfInstances: 2 })
	})

	it("integrace-dicom.md 5.9 leaves out the series description when the confirmed instances differ in it", () => {
		const [first, second] = delivery().instances
		if (first === undefined || second === undefined) {
			throw new Error("the fixture has two instances")
		}
		const study = deliveredStudyOf({ instances: [first, { ...second, seriesDescription: "Rána 1 · pravý bok" }] })

		expect(study.series?.[0]?.description).toBeUndefined()
	})

	it("integrace-dicom.md 5.9 Document Title describes the series of a scanned document", () => {
		const study = deliveredStudyOf({
			instances: [
				{
					seriesInstanceUid: DOCUMENT_SERIES,
					sopClassUid: ENCAPSULATED_PDF,
					sopInstanceUid: "2.25.1003",
					number: 1,
					title: "Propouštěcí zpráva",
					description: undefined,
					seriesDescription: "Propouštěcí zpráva",
				},
			],
		})

		expect(study.series?.[2]).toMatchObject({
			uid: DOCUMENT_SERIES,
			description: "Propouštěcí zpráva",
			numberOfInstances: 1,
			instance: [{ uid: "2.25.1003", title: "Propouštěcí zpráva" }],
		})
	})

	it("refuses a delivery into a series the study does not have", () => {
		const [first] = delivery().instances
		if (first === undefined) {
			throw new Error("the fixture has an instance")
		}

		expect(() => deliveredStudyOf({ instances: [{ ...first, seriesInstanceUid: "2.25.999" }] })).toThrow(
			ClinicalRecordStoreError,
		)
	})

	it("backend.md 3 T4 writes the study and one delivery provenance per record authored by the server", () => {
		const bundle = deliveryBundleOf(EXISTING, delivery(), SERVER, context)

		expect(bundle.type).toBe("transaction")
		expect(bundle.entry?.map((entry) => entry.request)).toEqual([
			{
				method: "PUT",
				url: `ImagingStudy?identifier=${encodeURIComponent(tokenOf(systems.imagingStudy, ENCOUNTER_ID))}`,
			},
			{
				method: "POST",
				url: "Provenance",
				ifNoneExist: `_tag=${encodeURIComponent(
					tokenOf(systems.provenanceKeyTag, `acquisition:${ACQUISITION_ID}:delivery-confirmed`),
				)}`,
			},
		])
		expect(bundle.entry?.[1]?.resource).toMatchObject({
			resourceType: "Provenance",
			target: [{ reference: bundle.entry?.[0]?.fullUrl }],
			recorded: "2026-11-09T10:16:02.000Z",
			occurredDateTime: "2026-11-09T10:15:30.250Z",
			agent: [{ type: { coding: [{ code: "author" }] }, who: SERVER }],
		})
	})

	it("records no instance creation time for objects built before it was recorded", () => {
		const bundle = deliveryBundleOf(EXISTING, delivery({ createdAt: undefined }), SERVER, context)

		expect(bundle.entry?.[1]?.resource).not.toHaveProperty("occurredDateTime")
	})

	it("CAP-021-R39 keeps the delivered instances when a later scan of the visit is founded or withdrawn", () => {
		const delivered = deliveredStudyOf()
		const founded = draftStudyOf(delivered, FOUNDED_DOCUMENT, context)
		const withdrawn = withdrawnStudyOf(
			founded,
			{ encounterId: ENCOUNTER_ID, seriesInstanceUid: NEW_DOCUMENT_SERIES },
			FOUNDED_DOCUMENT,
			context,
		)

		for (const study of [founded, withdrawn]) {
			expect(study).toMatchObject({ status: "available", numberOfSeries: 1, numberOfInstances: 2 })
			expect(study.series?.[0]?.instance).toEqual(delivered.series?.[0]?.instance)
		}
	})
})
