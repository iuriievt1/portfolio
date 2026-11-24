import {
	CLINICAL_RECORD_FAILURE,
	type ClinicalClosure,
	type ClinicalDraftAssessment,
	type ClinicalDraftFinding,
	ClinicalRecordStoreError,
	type ClinicalScannedDocument,
	ClosedRecordConflictError,
	CODE_LIST,
} from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import { type ClosureReferences, imagingStudyOf, scannedDocumentOf } from "../closure-resources"
import { MODALITY } from "../dicom-identifiers"
import { scannedDocumentContentOf } from "../document-resources"
import { FINDING_RECORD } from "../draft-records"
import type { DocumentReference, ImagingStudy, Observation, Resource } from "../fhir-types"
import { bodyStructureOf, conditionOf } from "../finding-resources"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf } from "../identifiers"
import { MedplumClosedRecordReader } from "../medplum-closed-record-reader"
import { assessmentObservationOf, codeListValueOf, woundTypeConcept } from "../observation-resources"
import { STUDY_STATUS } from "../study-resources"

const BASE_URL = "http://store.invalid/"
const TOKEN_PATH = "oauth2/token"
const INSTANCE_BASE = "https://fhir.mou.cz/vulna"
const HTTP_OK = 200
const HTTP_FORBIDDEN = 403
const HTTP_SERVICE_UNAVAILABLE = 503
const ACQUISITION_ID = "55555555-5555-4555-8555-555555555555"
const FINDING_ID = "44444444-4444-4444-8444-444444444444"
const DOCUMENT_ID = "66666666-6666-4666-8666-666666666666"
const PATIENT = "patient-7"
const STUDY = "study-1"
const STUDY_UID = "2.25.909090909090909090909090909090"
const SERIES_UID = "2.25.909090909090909090909090909091"
const DEPARTMENT = { id: "33333333-3333-4333-8333-333333333333", code: "KOC" }
const WORKER_CLIENT_ID = "worker"
const DRAFT_TAG_FILTER = "_tag:not"
const context = { systems: identifierSystemsOf(DEFAULT_CANONICAL_BASE), instanceBase: INSTANCE_BASE }
const draftTag = { system: context.systems.draftTag, code: ACQUISITION_ID }

const finding: ClinicalDraftFinding = {
	findingId: FINDING_ID,
	acquisitionId: ACQUISITION_ID,
	patientResourceId: PATIENT,
	department: DEPARTMENT,
	site: {
		regionCode: "181553006",
		laterality: "L",
		surface: "anterior",
		view: "anterior",
		x: 0.5,
		y: 0.25,
		bodyDiagramVersion: "2",
	},
}

const assessment: ClinicalDraftAssessment = {
	acquisitionId: ACQUISITION_ID,
	patientResourceId: PATIENT,
	conditionResourceId: "condition-3",
	bodyStructureResourceId: "body-structure-9",
	department: DEPARTMENT,
	healingPhaseCode: "granulating",
	healingPhaseName: "Granulační",
	description: "Okraje klidné",
}

const closure: ClinicalClosure = {
	acquisitionId: ACQUISITION_ID,
	patientId: "patient-local",
	patientResourceId: PATIENT,
	department: DEPARTMENT,
	startedAt: "2026-11-06T08:00:00.000Z",
	closedAt: "2026-11-06T08:10:00.000Z",
	author: { userId: "user-1", department: DEPARTMENT },
	station: { deviceId: "device-1", model: "Pixel 9a" },
	study: {
		encounterId: "encounter-1",
		encounterResourceId: "encounter-resource",
		studyInstanceUid: STUDY_UID,
		started: "2026-11-06T08:00:00.000Z",
		department: DEPARTMENT,
	},
	series: { seriesInstanceUid: SERIES_UID, number: 2, bodyRegion: undefined, laterality: null },
}

const references: ClosureReferences = {
	author: { reference: "PractitionerRole/role-1" },
	station: { reference: "Device/device-resource" },
	department: undefined,
	existingStudy: undefined,
}

const document: ClinicalScannedDocument = {
	acquisitionId: ACQUISITION_ID,
	documentId: DOCUMENT_ID,
	patientResourceId: PATIENT,
	department: DEPARTMENT,
	closedAt: "2026-11-06T08:10:00.000Z",
	author: { userId: "user-1", department: DEPARTMENT },
	title: { code: "discharge-report", text: "Propouštěcí zpráva" },
	pageCount: 2,
	study: { encounterResourceId: "encounter-resource" },
	series: { seriesInstanceUid: SERIES_UID },
}

function closedStudy(): ImagingStudy {
	return { ...imagingStudyOf(closure, MODALITY.PHOTO, references, context), id: STUDY }
}

function closedAssessment(id = "observation-1", changes: Partial<ClinicalDraftAssessment> = {}): Observation {
	return {
		...assessmentObservationOf({ ...assessment, ...changes }, FINDING_RECORD.CLOSED, context),
		id,
		partOf: [{ reference: `ImagingStudy/${STUDY}` }],
		component: [
			{
				code: woundTypeConcept(),
				valueCodeableConcept: codeListValueOf(INSTANCE_BASE, CODE_LIST.WOUND_TYPE, "leg-ulcer", "Bércový vřed"),
			},
		],
	}
}

function closedDocument(id = "document-reference-1"): DocumentReference {
	return {
		...scannedDocumentOf(document, `ImagingStudy/${STUDY}`, references.author, scannedDocumentContentOf(2), context),
		id,
	}
}

function closedResources(): Record<string, Resource[]> {
	return {
		Observation: [closedAssessment(), { ...conditionOf(finding, FINDING_RECORD.CLOSED, context), id: "condition-3" }],
		BodyStructure: [{ ...bodyStructureOf(finding, FINDING_RECORD.CLOSED, context), id: "body-structure-9" }],
		ImagingStudy: [closedStudy()],
		DocumentReference: [closedDocument()],
	}
}

interface SearchRequest {
	resourceType: string
	query: URLSearchParams
	onBehalfOf: string | null
}

function answer(body: unknown, status = HTTP_OK): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/fhir+json" } })
}

function outcomeOf(status: number): unknown {
	return {
		resourceType: "OperationOutcome",
		issue: [{ severity: "error", code: status === HTTP_FORBIDDEN ? "forbidden" : "exception" }],
	}
}

function readerHarness(stored = closedResources(), status = HTTP_OK) {
	const searches: SearchRequest[] = []
	const signIns: URLSearchParams[] = []
	const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		const url = new URL(String(input))
		if (url.pathname.endsWith(TOKEN_PATH)) {
			signIns.push(new URLSearchParams(String(init?.body)))
			return answer({ access_token: "token", token_type: "Bearer", expires_in: 3600 })
		}
		const resourceType = url.pathname.split("/").at(-1) ?? ""
		searches.push({
			resourceType,
			query: url.searchParams,
			onBehalfOf: new Headers(init?.headers).get("X-Medplum-On-Behalf-Of"),
		})
		if (status !== HTTP_OK) {
			return answer(outcomeOf(status), status)
		}
		const id = url.searchParams.get("_id")
		const resources = (stored[resourceType] ?? []).filter((resource) => id === null || resource.id === id)
		return answer({ resourceType: "Bundle", type: "searchset", entry: resources.map((resource) => ({ resource })) })
	}
	const reader = new MedplumClosedRecordReader({
		baseUrl: BASE_URL,
		clientId: WORKER_CLIENT_ID,
		clientSecret: "secret",
		canonicalBase: DEFAULT_CANONICAL_BASE,
		instanceBaseUri: INSTANCE_BASE,
		fetch,
	})
	return { reader, searches, signIns }
}

function withDraftTag<T extends Resource>(resource: T): T {
	return { ...resource, meta: { ...resource.meta, tag: [...(resource.meta?.tag ?? []), draftTag] } }
}

// ADR-054 bod 4, CAP-012-R30, integrace-dicom.md 2
describe("closed record read for the DICOM assembly", () => {
	it("ADR-054 bod 4 reads the closed wound record with its study, finding, site and codes", async () => {
		const run = readerHarness()

		expect(await run.reader.closedWoundRecord(ACQUISITION_ID)).toEqual({
			acquisitionId: ACQUISITION_ID,
			patientResourceId: PATIENT,
			study: {
				patientResourceId: PATIENT,
				studyInstanceUid: STUDY_UID,
				series: [{ seriesInstanceUid: SERIES_UID, number: 2 }],
			},
			findingId: FINDING_ID,
			site: { regionCode: "181553006", laterality: "L", view: "anterior", x: 0.5, y: 0.25, bodyDiagramVersion: "2" },
			healingPhaseCode: "granulating",
			closedWoundTypeCode: "leg-ulcer",
			description: "Okraje klidné",
		})
	})

	it("ADR-052 bod 5 asks only for the closed assessment of the record, with its finding, under the worker's own credential", async () => {
		const run = readerHarness()

		await run.reader.closedWoundRecord(ACQUISITION_ID)

		expect(run.searches.map((search) => search.resourceType)).toEqual(["Observation", "BodyStructure", "ImagingStudy"])
		const [observations, structures, studies] = run.searches
		expect(observations?.query.get("identifier")).toBe(`${context.systems.acquisition}|${ACQUISITION_ID}`)
		expect(observations?.query.get(DRAFT_TAG_FILTER)).toBe(`${context.systems.draftTag}|`)
		expect(observations?.query.get("status")).toBe("final")
		expect(observations?.query.get("code")).toBe("http://loinc.org|96558-2")
		expect(observations?.query.get("_include")).toBe("Observation:focus")
		expect(structures?.query.get("_id")).toBe("body-structure-9")
		expect(structures?.query.get(DRAFT_TAG_FILTER)).toBe(`${context.systems.draftTag}|`)
		expect(studies?.query.get("_id")).toBe(STUDY)
		expect(studies?.query.get(DRAFT_TAG_FILTER)).toBe(`${context.systems.draftTag}|`)
		expect(run.searches.every((search) => search.onBehalfOf === null)).toBe(true)
		expect(run.signIns.map((signIn) => signIn.get("client_id"))).toEqual([WORKER_CLIENT_ID])
	})

	it("CAP-020-R21 reads a closed wound record without a healing phase", async () => {
		const stored = closedResources()
		const withoutPhase = closedAssessment("observation-1", { healingPhaseCode: undefined, healingPhaseName: undefined })
		const observations = (stored.Observation ?? []).map((resource) =>
			resource.resourceType === "Observation" ? withoutPhase : resource,
		)
		const run = readerHarness({ ...stored, Observation: observations })

		const record = await run.reader.closedWoundRecord(ACQUISITION_ID)

		expect(record?.findingId).toBe(FINDING_ID)
		expect(record?.healingPhaseCode).toBeUndefined()
		expect(record?.closedWoundTypeCode).toBe("leg-ulcer")
	})

	it("CAP-021-R39 reads the closed scan with its title code and text", async () => {
		const run = readerHarness()

		expect(await run.reader.closedScanRecord(ACQUISITION_ID)).toEqual({
			acquisitionId: ACQUISITION_ID,
			patientResourceId: PATIENT,
			study: {
				patientResourceId: PATIENT,
				studyInstanceUid: STUDY_UID,
				series: [{ seriesInstanceUid: SERIES_UID, number: 2 }],
			},
			documentId: DOCUMENT_ID,
			title: { code: "discharge-report", text: "Propouštěcí zpráva" },
		})
		expect(run.searches.map((search) => search.resourceType)).toEqual(["DocumentReference", "ImagingStudy"])
		const [documents, studies] = run.searches
		expect(documents?.query.get("identifier")).toBe(`${context.systems.acquisition}|${ACQUISITION_ID}`)
		expect(documents?.query.get(DRAFT_TAG_FILTER)).toBe(`${context.systems.draftTag}|`)
		expect(documents?.query.get("_profile")).toBe(context.systems.scannedDocumentProfile)
		expect(documents?.query.get("status")).toBe("current")
		expect(studies?.query.get(DRAFT_TAG_FILTER)).toBe(`${context.systems.draftTag}|`)
		expect(run.searches.every((search) => search.onBehalfOf === null)).toBe(true)
	})

	it.each([
		["no assessment", (stored: Record<string, Resource[]>) => ({ ...stored, Observation: [] })],
		[
			"a finding still a draft",
			(stored: Record<string, Resource[]>) => ({
				...stored,
				Observation: (stored.Observation ?? []).map((resource) =>
					resource.resourceType === "Condition" ? withDraftTag(resource) : resource,
				),
			}),
		],
		[
			"an assessment still a draft",
			(stored: Record<string, Resource[]>) => ({
				...stored,
				Observation: (stored.Observation ?? []).map((resource) =>
					resource.resourceType === "Observation" ? withDraftTag(resource) : resource,
				),
			}),
		],
		["no site", (stored: Record<string, Resource[]>) => ({ ...stored, BodyStructure: [] })],
		[
			"a site still a draft",
			(stored: Record<string, Resource[]>) => ({
				...stored,
				BodyStructure: (stored.BodyStructure ?? []).map(withDraftTag),
			}),
		],
		["no study", (stored: Record<string, Resource[]>) => ({ ...stored, ImagingStudy: [] })],
		[
			"a study still a draft",
			(stored: Record<string, Resource[]>) => ({ ...stored, ImagingStudy: [withDraftTag(closedStudy())] }),
		],
		[
			"a withdrawn study",
			(stored: Record<string, Resource[]>) => ({
				...stored,
				ImagingStudy: [{ ...closedStudy(), status: STUDY_STATUS.ENTERED_IN_ERROR }],
			}),
		],
	])("ADR-054 bod 4 answers no closed wound record with %s (negative)", async (_, change) => {
		const run = readerHarness(change(closedResources()))

		expect(await run.reader.closedWoundRecord(ACQUISITION_ID)).toBeUndefined()
	})

	it.each([
		[
			"a document that is not final",
			{ DocumentReference: [{ ...closedDocument(), docStatus: "preliminary" as const }] },
		],
		["a document still a draft", { DocumentReference: [withDraftTag(closedDocument())] }],
		["no study", { ImagingStudy: [] }],
	])("CAP-021-R39 answers no closed scan for %s (negative)", async (_, change) => {
		const run = readerHarness({ ...closedResources(), ...change })

		expect(await run.reader.closedScanRecord(ACQUISITION_ID)).toBeUndefined()
	})

	it("ADR-054 bod 4 refuses to choose between two closed assessments of one record", async () => {
		const stored = closedResources()
		const run = readerHarness({
			...stored,
			Observation: [...(stored.Observation ?? []), closedAssessment("observation-2")],
		})

		await expect(run.reader.closedWoundRecord(ACQUISITION_ID)).rejects.toThrow(ClosedRecordConflictError)
	})

	it("ADR-054 bod 4 refuses to choose between two closed documents of one record", async () => {
		const run = readerHarness({
			...closedResources(),
			DocumentReference: [closedDocument(), closedDocument("document-2")],
		})

		await expect(run.reader.closedScanRecord(ACQUISITION_ID)).rejects.toThrow(ClosedRecordConflictError)
	})

	it.each([
		[HTTP_SERVICE_UNAVAILABLE, CLINICAL_RECORD_FAILURE.UNAVAILABLE],
		[HTTP_FORBIDDEN, CLINICAL_RECORD_FAILURE.REJECTED],
	])("ADR-054 bod 4 reports a store answering %i as a failure of the store", async (status, failure) => {
		const run = readerHarness(closedResources(), status)

		await expect(run.reader.closedWoundRecord(ACQUISITION_ID)).rejects.toThrow(
			expect.objectContaining({ constructor: ClinicalRecordStoreError, failure }),
		)
	})
})
