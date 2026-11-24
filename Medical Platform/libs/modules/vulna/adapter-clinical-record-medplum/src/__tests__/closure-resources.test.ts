import type {
	ClinicalClosure,
	ClinicalDraftAssessment,
	ClinicalDraftFinding,
	ClinicalDraftWoundType,
	ClinicalScanClosure,
	ClinicalScannedDocumentPdf,
	ClinicalWoundClosure,
} from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import {
	type ClosureReferences,
	scanClosureBundleOf,
	scannedPdfDocumentOf,
	stationDeviceOf,
	woundClosureBundleOf,
} from "../closure-resources"
import type {
	BodyStructure,
	Bundle,
	Condition,
	DocumentReference,
	ImagingStudy,
	Observation,
	Provenance,
	Resource,
} from "../fhir-types"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf } from "../identifiers"
import type { ProjectionContext } from "../resource-meta"

const context: ProjectionContext = {
	systems: identifierSystemsOf(DEFAULT_CANONICAL_BASE),
	instanceBase: "https://fhir.mou.cz/vulna/",
}
const { systems } = context
const DEPARTMENT = { id: "33333333-3333-4333-8333-333333333333", code: "KOC" }
const ACQUISITION_ID = "55555555-5555-4555-8555-555555555555"
const FINDING_ID = "44444444-4444-4444-8444-444444444444"
const PATIENT_ID = "11111111-1111-4111-8111-111111111111"
const ENCOUNTER_ID = "22222222-2222-4222-8222-222222222222"
const DEVICE_ID = "66666666-6666-4666-8666-666666666666"
const SERIES_UID = "2.25.77"
const OTHER_SERIES_UID = "2.25.78"
const URN = /^urn:uuid:[0-9a-f-]{36}$/

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
		bodyDiagramVersion: "1",
	},
}

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
	description: "Bez známek infekce",
}

const closure: ClinicalClosure = {
	acquisitionId: ACQUISITION_ID,
	patientId: PATIENT_ID,
	patientResourceId: "patient-7",
	department: DEPARTMENT,
	startedAt: "2026-10-07T07:50:00.000Z",
	closedAt: "2026-10-07T07:59:50.000Z",
	author: { userId: "77777777-7777-4777-8777-777777777777", department: DEPARTMENT },
	station: { deviceId: DEVICE_ID, model: "SM-A576B" },
	study: {
		encounterId: ENCOUNTER_ID,
		encounterResourceId: "encounter-5",
		studyInstanceUid: "2.25.45",
		started: "2026-10-07T07:30:00.000Z",
		department: DEPARTMENT,
	},
	series: {
		seriesInstanceUid: SERIES_UID,
		number: 2,
		bodyRegion: { code: "30021000", meaning: "Lower leg" },
		laterality: "R",
	},
}

const firstClosure: ClinicalWoundClosure = {
	...closure,
	firstRecord: { finding, woundType },
	assessment,
	closedWoundType: { code: "leg-ulcer", name: "Bércový vřed" },
}

const laterClosure: ClinicalWoundClosure = { ...firstClosure, firstRecord: undefined }

const scanClosure: ClinicalScanClosure = {
	...closure,
	series: { seriesInstanceUid: SERIES_UID, number: 3, bodyRegion: undefined, laterality: null },
	documentId: "88888888-8888-4888-8888-888888888888",
	title: { code: "discharge-report", text: "Propouštěcí zpráva" },
	pageCount: 3,
}

function resourcesOf(bundle: Bundle): Resource[] {
	return (bundle.entry ?? []).map((entry) => entry.resource as Resource)
}

function only<T extends Resource>(bundle: Bundle, resourceType: T["resourceType"]): T {
	const found = resourcesOf(bundle).filter((resource) => resource.resourceType === resourceType)
	expect(found).toHaveLength(1)
	return found[0] as T
}

function tagSystemsOf(resource: Resource): (string | undefined)[] {
	return (resource.meta?.tag ?? []).map((tag) => tag.system)
}

// CAP-021-R27, CAP-021-R31, ADR-050, ADR-052
describe("first closure of a new wound CAP-021-S21", () => {
	const bundle = woundClosureBundleOf(firstClosure, references, context)

	it("writes the six resources of the record in one transaction, the study before the assessment that points to it", () => {
		expect(bundle.type).toBe("transaction")
		expect(resourcesOf(bundle).map((resource) => resource.resourceType)).toEqual([
			"BodyStructure",
			"Condition",
			"Observation",
			"ImagingStudy",
			"Observation",
			"Provenance",
		])
		expect(bundle.entry?.slice(0, 5).map((entry) => entry.request?.method)).toEqual(["PUT", "PUT", "PUT", "PUT", "PUT"])
	})

	it("ADR-052 leaves the draft tag on none of the resources of the record", () => {
		for (const resource of resourcesOf(bundle)) {
			expect(tagSystemsOf(resource)).not.toContain(systems.draftTag)
		}
	})

	it("ADR-050 drops the verification of the wound and names who recorded it", () => {
		const condition = only<Condition>(bundle, "Condition")

		expect(condition.verificationStatus).toBeUndefined()
		expect(condition.recorder).toEqual(references.author)
		expect(tagSystemsOf(condition)).toContain(systems.departmentTag)
	})

	it("keeps the body site active and the wound type final with its author", () => {
		const [woundTypeObservation] = resourcesOf(bundle).filter(
			(resource): resource is Observation => resource.resourceType === "Observation",
		)
		expect(only<BodyStructure>(bundle, "BodyStructure").active).toBe(true)
		expect(woundTypeObservation?.status).toBe("final")
		expect(woundTypeObservation?.performer).toEqual([references.author])
	})

	it("CAP-020-R21 makes the assessment final with the wound type it closed with, inside the study of the visit", () => {
		const studyUrl = bundle.entry?.[3]?.fullUrl
		const closedAssessment = resourcesOf(bundle)[4] as Observation

		expect(closedAssessment.status).toBe("final")
		expect(closedAssessment.partOf).toEqual([{ reference: studyUrl }])
		expect(closedAssessment.effectiveDateTime).toBe(closure.startedAt)
		expect(closedAssessment.note).toEqual([{ text: "Bez známek infekce" }])
		expect(closedAssessment.component).toEqual([
			{
				code: { coding: [{ system: "http://loinc.org", code: "72300-7" }] },
				valueCodeableConcept: {
					coding: [
						{ system: "https://fhir.mou.cz/vulna/CodeSystem/wound-type", code: "leg-ulcer", userSelected: true },
					],
					text: "Bércový vřed",
				},
			},
		])
		expect(bundle.entry?.[4]?.request?.url).toBe(
			`Observation?identifier=${encodeURIComponent(`${systems.acquisition}|${ACQUISITION_ID}`)}`,
		)
	})

	it("CAP-021-R28 registers the study of the visit with its series and no instances", () => {
		const study = only<ImagingStudy>(bundle, "ImagingStudy")

		expect(bundle.entry?.[3]?.request?.url).toBe(
			`ImagingStudy?identifier=${encodeURIComponent(`${systems.imagingStudy}|${ENCOUNTER_ID}`)}`,
		)
		expect(study.status).toBe("registered")
		expect(study.subject).toEqual({ reference: "Patient/patient-7" })
		expect(study.encounter).toEqual({ reference: "Encounter/encounter-5" })
		expect(study.started).toBe("2026-10-07T07:30:00.000Z")
		expect(study.identifier?.[1]).toMatchObject({ system: "urn:dicom:uid", value: "urn:oid:2.25.45" })
		expect(study.modality).toEqual([{ system: "http://dicom.nema.org/resources/ontology/DCM", code: "XC" }])
		expect(study.series).toEqual([
			{
				uid: SERIES_UID,
				number: 2,
				modality: { system: "http://dicom.nema.org/resources/ontology/DCM", code: "XC" },
				bodySite: { system: "http://snomed.info/sct", code: "30021000" },
				laterality: { system: "http://snomed.info/sct", code: "24028007" },
				performer: [{ actor: references.author }, { actor: references.station }, { actor: references.department }],
			},
		])
	})

	it("ADR-050 records the closure once, by its author on the device it came from", () => {
		const provenance = only<Provenance>(bundle, "Provenance")
		const placed = bundle.entry?.slice(0, 5).map((entry) => entry.fullUrl)

		for (const fullUrl of placed ?? []) {
			expect(fullUrl).toMatch(URN)
		}
		expect(provenance.target).toEqual(placed?.map((reference) => ({ reference })))
		expect(provenance.recorded).toBe(closure.closedAt)
		expect(provenance.agent.map((agent) => [agent.type?.coding?.[0]?.code, agent.who])).toEqual([
			["author", references.author],
			["composer", references.station],
		])
		expect(provenance.meta?.tag).toEqual([
			{ system: systems.provenanceKeyTag, code: `acquisition:${ACQUISITION_ID}:closed` },
			{ system: systems.patientTag, code: PATIENT_ID },
		])
		expect(bundle.entry?.[5]?.request).toEqual({
			method: "POST",
			url: "Provenance",
			ifNoneExist: `_tag=${encodeURIComponent(`${systems.provenanceKeyTag}|acquisition:${ACQUISITION_ID}:closed`)}`,
		})
	})
})

// ADR-050
describe("later closure of a known wound", () => {
	it("writes only the assessment, the study and the provenance and leaves the wound alone", () => {
		const bundle = woundClosureBundleOf(laterClosure, references, context)

		expect(resourcesOf(bundle).map((resource) => resource.resourceType)).toEqual([
			"ImagingStudy",
			"Observation",
			"Provenance",
		])
	})
})

// CAP-017-R16, CHG-181
describe("closure of a wound whose type and healing phase the instance switched off CAP-017-S16", () => {
	const locatedOnly: ClinicalWoundClosure = {
		...firstClosure,
		firstRecord: { finding, woundType: undefined },
		assessment: { ...assessment, healingPhaseCode: undefined, healingPhaseName: undefined },
		closedWoundType: undefined,
	}
	const bundle = woundClosureBundleOf(locatedOnly, references, context)
	const closedAssessment = only<Observation>(bundle, "Observation")

	it("writes the wound and its body site without a wound type", () => {
		expect(resourcesOf(bundle).map((resource) => resource.resourceType)).toEqual([
			"BodyStructure",
			"Condition",
			"ImagingStudy",
			"Observation",
			"Provenance",
		])
		expect(closedAssessment.component).toBeUndefined()
	})

	it("keeps the note and the body site on the assessment and marks the healing phase as not asked", () => {
		expect(closedAssessment.valueCodeableConcept).toBeUndefined()
		expect(closedAssessment.dataAbsentReason?.coding?.[0]?.code).toBe("not-asked")
		expect(closedAssessment.note).toEqual([{ text: assessment.description }])
		expect(closedAssessment.bodySite).toBeDefined()
	})
})

// CAP-021-R11, ADR-050
describe("study shared by the records of one visit CAP-021-S11", () => {
	const existingStudy: ImagingStudy = {
		resourceType: "ImagingStudy",
		id: "study-4",
		meta: { versionId: "3", tag: [{ system: systems.draftTag, code: "stale" }] },
		status: "available",
		subject: { reference: "Patient/patient-7" },
		numberOfInstances: 2,
		series: [
			{
				uid: OTHER_SERIES_UID,
				number: 1,
				modality: { system: "http://dicom.nema.org/resources/ontology/DCM", code: "DOC" },
				instance: [{ uid: "2.25.90", sopClass: { system: "urn:ietf:rfc:3986", code: "urn:oid:1.2" } }],
			},
			{
				uid: SERIES_UID,
				number: 2,
				modality: { system: "http://dicom.nema.org/resources/ontology/DCM", code: "XC" },
				performer: [{ actor: references.author }, { actor: { reference: "Device/device-0" } }],
				instance: [{ uid: "2.25.91", sopClass: { system: "urn:ietf:rfc:3986", code: "urn:oid:1.3" } }],
			},
		],
	}
	const bundle = woundClosureBundleOf(laterClosure, { ...references, existingStudy }, context)
	const study = only<ImagingStudy>(bundle, "ImagingStudy")

	it("keeps the other series and the instances the delivery already confirmed", () => {
		expect(study.id).toBe("study-4")
		expect(study.status).toBe("available")
		expect(study.numberOfInstances).toBe(2)
		expect(study.series?.map((series) => [series.uid, series.instance?.length])).toEqual([
			[OTHER_SERIES_UID, 1],
			[SERIES_UID, 1],
		])
		expect(study.modality?.map((modality) => modality.code)).toEqual(["DOC", "XC"])
	})

	it("adds the author, the device and the department of this record to the series without repeating them", () => {
		expect(study.series?.[1]?.performer).toEqual([
			{ actor: references.author },
			{ actor: { reference: "Device/device-0" } },
			{ actor: references.station },
			{ actor: references.department },
		])
	})

	it("replaces the stored meta with the meta of the closed record", () => {
		expect(study.meta?.versionId).toBeUndefined()
		expect(tagSystemsOf(study)).not.toContain(systems.draftTag)
		expect(study.meta?.profile).toEqual([systems.imagingStudyProfile])
	})
})

// CAP-021-R39, ADR-050
describe("closure of a scanned document CAP-021-S35", () => {
	const bundle = scanClosureBundleOf(scanClosure, references, context)
	const document = only<DocumentReference>(bundle, "DocumentReference")

	it("writes the study with a DOC series, the document and the provenance in one transaction", () => {
		expect(resourcesOf(bundle).map((resource) => resource.resourceType)).toEqual([
			"ImagingStudy",
			"DocumentReference",
			"Provenance",
		])
		const study = only<ImagingStudy>(bundle, "ImagingStudy")
		expect(study.series).toEqual([
			{
				uid: SERIES_UID,
				number: 3,
				modality: { system: "http://dicom.nema.org/resources/ontology/DCM", code: "DOC" },
				performer: [{ actor: references.author }, { actor: references.station }, { actor: references.department }],
			},
		])
	})

	it("CAP-018-R15 names the document by its title, author, date and page count without a URL or master identifier", () => {
		expect(bundle.entry?.[1]?.request?.url).toBe(
			`DocumentReference?identifier=${encodeURIComponent(`${systems.document}|${scanClosure.documentId}`)}`,
		)
		expect(document.status).toBe("current")
		expect(document.docStatus).toBe("final")
		expect(document.type).toEqual({
			coding: [
				{ system: "https://fhir.mou.cz/vulna/CodeSystem/document-title", code: "discharge-report", userSelected: true },
			],
			text: "Propouštěcí zpráva",
		})
		expect(document.author).toEqual([references.author])
		expect(document.date).toBe(closure.closedAt)
		expect(document.masterIdentifier).toBeUndefined()
		expect(document.content).toEqual([
			{
				attachment: {
					contentType: "application/pdf",
					extension: [
						{ url: "http://hl7.org/fhir/5.0/StructureDefinition/extension-Attachment.pages", valuePositiveInt: 3 },
					],
				},
				format: {
					system: "http://ihe.net/fhir/ihe.formatcode.fhir/CodeSystem/formatcode",
					code: "urn:ihe:iti:xds-sd:pdf:2008",
				},
			},
		])
		expect(document.context?.related).toEqual([{ reference: bundle.entry?.[0]?.fullUrl }])
		expect(tagSystemsOf(document)).not.toContain(systems.draftTag)
	})

	it("CAP-018-R15 keeps a free-text title as text only", () => {
		const written = scanClosureBundleOf(
			{ ...scanClosure, title: { code: undefined, text: "Výsledky z jiné nemocnice" } },
			references,
			context,
		)

		expect(only<DocumentReference>(written, "DocumentReference").type).toEqual({ text: "Výsledky z jiné nemocnice" })
	})
})

describe("PDF of a scanned document CAP-021-R39", () => {
	const pdfDocument: ClinicalScannedDocumentPdf = {
		...scanClosure,
		studyResourceId: "study-9",
		delivered: undefined,
		pdf: {
			binaryId: "binary-pdf",
			contentType: "application/pdf",
			sizeBytes: 177_172,
			sha1Base64: "c2hhMQ==",
			sha256: "a".repeat(64),
		},
	}
	const studyReference = `ImagingStudy/${pdfDocument.studyResourceId}`
	const document = scannedPdfDocumentOf(pdfDocument, studyReference, references.author, context)

	it("CAP-021-R28 adds the archive's identifier, the title, language and creation the builder wrote once confirmed", () => {
		const delivered = {
			sopInstanceUid: "2.25.5005",
			title: "Propouštěcí zpráva",
			language: "cs",
			createdAt: "2026-11-09T10:15:30.250Z",
		}
		const confirmed = scannedPdfDocumentOf({ ...pdfDocument, delivered }, studyReference, references.author, context)

		expect(document).not.toHaveProperty("masterIdentifier")
		expect(confirmed.masterIdentifier).toEqual({ system: "urn:ietf:rfc:3986", value: "urn:oid:2.25.5005" })
		expect(confirmed.content[0]?.attachment).toMatchObject({
			title: "Propouštěcí zpráva",
			language: "cs",
			creation: "2026-11-09T10:15:30.250Z",
		})
	})

	it("CAP-021-R39 points at the Binary with the PDF, its size and both digests", () => {
		expect(document.content).toEqual([
			{
				attachment: {
					contentType: "application/pdf",
					url: "Binary/binary-pdf",
					size: 177_172,
					hash: "c2hhMQ==",
					extension: [
						{ url: "http://hl7.org/fhir/5.0/StructureDefinition/extension-Attachment.pages", valuePositiveInt: 3 },
						{ url: systems.attachmentSha256, valueString: "a".repeat(64) },
					],
				},
				format: {
					system: "http://ihe.net/fhir/ihe.formatcode.fhir/CodeSystem/formatcode",
					code: "urn:ihe:iti:xds-sd:pdf:2008",
				},
			},
		])
	})

	it("CAP-026-R20 drops the link of a PDF kept only in the PACS and marks it archive-only", () => {
		const delivered = { sopInstanceUid: "2.25.5005", title: undefined, language: undefined, createdAt: undefined }
		const archived = { ...pdfDocument, delivered, pdf: { contentType: "application/pdf", sha256: "a".repeat(64) } }

		const resource = scannedPdfDocumentOf(archived, studyReference, references.author, context)

		expect(resource.content[0]?.attachment).toEqual({
			contentType: "application/pdf",
			extension: [
				{ url: "http://hl7.org/fhir/5.0/StructureDefinition/extension-Attachment.pages", valuePositiveInt: 3 },
				{ url: systems.attachmentSha256, valueString: "a".repeat(64) },
				{ url: systems.contentAvailability, valueCode: "archive-only" },
			],
		})
		expect(resource.masterIdentifier).toEqual({ system: "urn:ietf:rfc:3986", value: "urn:oid:2.25.5005" })
	})

	it("CAP-026-R20 refuses a PDF kept only in the PACS before the archive confirmed its instance", () => {
		const archived = { ...pdfDocument, pdf: { contentType: "application/pdf", sha256: undefined } }

		expect(() => scannedPdfDocumentOf(archived, studyReference, references.author, context)).toThrow(
			expect.objectContaining({ failure: "rejected" }),
		)
	})

	it("CAP-021-R39 keeps the title, author, date and study of the closure", () => {
		const closed = only<DocumentReference>(scanClosureBundleOf(scanClosure, references, context), "DocumentReference")

		expect({ ...document, content: undefined, context: undefined }).toEqual({
			...closed,
			content: undefined,
			context: undefined,
		})
		expect(document.context).toEqual({ ...closed.context, related: [{ reference: studyReference }] })
	})
})

// ADR-050, integrace-dicom.md 5.9
describe("device a record was closed on", () => {
	it("names the device by its model and our identifier, never by its hardware identifier", () => {
		expect(stationDeviceOf(closure.station, systems)).toEqual({
			resourceType: "Device",
			identifier: [{ system: systems.device, value: DEVICE_ID }],
			status: "active",
			deviceName: [{ name: "SM-A576B", type: "model-name" }],
		})
	})
})
