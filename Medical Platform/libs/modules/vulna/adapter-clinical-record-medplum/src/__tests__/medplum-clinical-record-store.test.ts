import { createHash } from "node:crypto"
import {
	CLINICAL_FILE_KIND,
	CLINICAL_RECORD_FAILURE,
	type ClinicalCodeListSet,
	type ClinicalDraftAssessment,
	type ClinicalDraftFinding,
	type ClinicalDraftWoundType,
	type ClinicalFoundedDocument,
	type ClinicalImageResource,
	ClinicalRecordStoreError,
	type ClinicalScannedDocumentPdf,
} from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import type { Bundle, BundleEntry, DocumentReference, ImagingStudy, Resource } from "../fhir-types"
import { DEFAULT_CANONICAL_BASE } from "../identifiers"
import { MedplumClinicalRecordStore } from "../medplum-clinical-record-store"

const BASE_URL = "http://store.invalid/"
const INSTANCE_BASE = "https://fhir.mou.cz/vulna"
const FINDING_ID = "44444444-4444-4444-8444-444444444444"
const ACQUISITION_ID = "55555555-5555-4555-8555-555555555555"
const DEPARTMENT = { id: "33333333-3333-4333-8333-333333333333", code: "KOC" }
const TOKEN_PATH = "oauth2/token"
const HTTP_OK = 200
const HTTP_CREATED = 201
const HTTP_BAD_REQUEST = 400
const BINARY_PATH = "fhir/R4/Binary/"
const BINARY_BYTES = Buffer.from("bytes of a wound photo")

interface Request {
	method: string
	url: string
	body: unknown
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
	description: undefined,
}

const DOCUMENT_ID = "66666666-6666-4666-8666-666666666666"

const ENCOUNTER_ID = "77777777-7777-4777-8777-777777777777"
const DOC_SERIES_UID = "2.25.111"
const PHOTO_SERIES_UID = "2.25.222"

const document: ClinicalFoundedDocument = {
	documentId: DOCUMENT_ID,
	acquisitionId: ACQUISITION_ID,
	department: DEPARTMENT,
	patientResourceId: "patient-7",
	study: {
		encounterId: ENCOUNTER_ID,
		encounterResourceId: "encounter-2",
		studyInstanceUid: "2.25.999",
		started: "2026-10-19T07:00:00.000Z",
		department: DEPARTMENT,
	},
	series: { seriesInstanceUid: DOC_SERIES_UID, number: 2, bodyRegion: undefined, laterality: null },
}

const withdrawnDocument = {
	documentId: DOCUMENT_ID,
	acquisitionId: ACQUISITION_ID,
	department: DEPARTMENT,
	series: { encounterId: ENCOUNTER_ID, seriesInstanceUid: DOC_SERIES_UID },
}

const STUDY_WITH_PHOTOS: ImagingStudy = {
	resourceType: "ImagingStudy",
	id: "study-1",
	status: "registered",
	subject: { reference: "Patient/patient-7" },
	series: [
		{ uid: PHOTO_SERIES_UID, number: 1, modality: { code: "XC" } },
		{ uid: DOC_SERIES_UID, number: 2, modality: { code: "DOC" } },
	],
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

const codeLists: ClinicalCodeListSet = {
	version: "4",
	defaultLanguage: "cs",
	codeLists: [
		{
			code: "wound-type",
			title: "Typ rány",
			concepts: [{ code: "leg-ulcer", isActive: true, names: { cs: "Bércový vřed" } }],
		},
	],
}

function answer(body: unknown, status = HTTP_OK): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/fhir+json" } })
}

function transactionResponseOf(request: Bundle): Bundle {
	return {
		resourceType: "Bundle",
		type: "transaction-response",
		entry: (request.entry ?? []).map(
			(entry: BundleEntry, index): BundleEntry => ({
				response: { status: "200 OK", location: `${entry.resource?.resourceType}/id-${index}/_history/2` },
			}),
		),
	}
}

// ADR-050 bod 10
function entriesOf(request: Request | undefined): BundleEntry[] {
	return (request?.body as Bundle | undefined)?.entry ?? []
}

function storeHarness(rejection: unknown = undefined, found: readonly Resource[] = [], rejectedMethod?: string) {
	const requests: Request[] = []
	const stored = new Map<string, Resource>()
	const fetch = async (input: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> => {
		const url = String(input)
		if (url.endsWith(TOKEN_PATH)) {
			return answer({ access_token: "token", token_type: "Bearer", expires_in: 3600 })
		}
		const method = init?.method ?? "GET"
		const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined
		requests.push({ method, url: decodeURIComponent(url.slice(BASE_URL.length)), body })
		if (rejection !== undefined && (rejectedMethod === undefined || method === rejectedMethod)) {
			return answer(rejection, HTTP_BAD_REQUEST)
		}
		if (method === "POST") {
			return answer(transactionResponseOf(body as Bundle))
		}
		if (method === "GET" && url.includes(BINARY_PATH)) {
			return new Response(BINARY_BYTES, { status: HTTP_OK, headers: { "content-type": "image/jpeg" } })
		}
		if (method === "GET") {
			return answer({ resourceType: "Bundle", type: "searchset", entry: found.map((match) => ({ resource: match })) })
		}
		const existing = stored.get(url)
		const resource = { ...(body as Resource), id: existing?.id ?? `id-${stored.size + 1}` }
		stored.set(url, resource)
		return answer(resource, existing === undefined ? HTTP_CREATED : HTTP_OK)
	}
	const store = new MedplumClinicalRecordStore({
		baseUrl: BASE_URL,
		clientId: "client",
		clientSecret: "secret",
		canonicalBase: DEFAULT_CANONICAL_BASE,
		instanceBaseUri: `${INSTANCE_BASE}/`,
		serverVersion: "1.0.0",
		fetch,
	})
	return { store, requests, stored }
}

describe("draft observations written by identifier ADR-050 bod 10", () => {
	it("CAP-017-R02 writes the wound type over the identifier of its finding and returns the stored id", async () => {
		const run = storeHarness()

		const id = await run.store.recordDraftWoundType(woundType)
		await run.store.recordDraftWoundType(woundType)

		expect(id).toBe("id-1")
		expect(run.stored.size).toBe(1)
		expect(run.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
			`PUT fhir/R4/Observation?identifier=${DEFAULT_CANONICAL_BASE}/sid/finding-wound-type|${FINDING_ID}`,
			`PUT fhir/R4/Observation?identifier=${DEFAULT_CANONICAL_BASE}/sid/finding-wound-type|${FINDING_ID}`,
		])
	})

	it("CAP-017-R03 writes the assessment over the identifier of its record and withdraws the same resource", async () => {
		const run = storeHarness()

		await run.store.recordDraftAssessment(assessment)
		await run.store.withdrawDraftAssessment(assessment)

		expect(run.stored.size).toBe(1)
		expect(run.requests.map((request) => request.url)).toEqual([
			`fhir/R4/Observation?identifier=${DEFAULT_CANONICAL_BASE}/sid/acquisition|${ACQUISITION_ID}`,
			`fhir/R4/Observation?identifier=${DEFAULT_CANONICAL_BASE}/sid/acquisition|${ACQUISITION_ID}`,
		])
		expect(run.requests.map((request) => (request.body as { status: string }).status)).toEqual([
			"preliminary",
			"entered-in-error",
		])
	})

	it("names the withdrawal when the store refuses it", async () => {
		const run = storeHarness({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "invalid" }] })

		const failure = await run.store.withdrawDraftAssessment(assessment).then(
			() => undefined,
			(error: unknown) => error,
		)

		expect(failure).toBeInstanceOf(ClinicalRecordStoreError)
		expect((failure as ClinicalRecordStoreError).failure).toBe(CLINICAL_RECORD_FAILURE.REJECTED)
		expect((failure as ClinicalRecordStoreError).message).toContain(`withdrawing the assessment of the record`)
	})
})

describe("scanned document of a draft record CAP-021-R39", () => {
	it("CAP-021-R39 CAP-021-R28 founds the document and the DOC series of its visit in one transaction", async () => {
		const run = storeHarness()

		const ids = await run.store.recordDraftDocument(document)

		expect(ids).toEqual({ document: "id-0", imagingStudy: "id-1" })
		const [search, transaction] = run.requests
		expect(search?.method).toBe("GET")
		expect(search?.url).toContain(`identifier=${DEFAULT_CANONICAL_BASE}/sid/imaging-study|${ENCOUNTER_ID}`)
		const entries = entriesOf(transaction)
		expect(entries.map((entry) => entry.request?.url)).toEqual([
			`DocumentReference?identifier=${encodeURIComponent(`${DEFAULT_CANONICAL_BASE}/sid/document|${DOCUMENT_ID}`)}`,
			`ImagingStudy?identifier=${encodeURIComponent(`${DEFAULT_CANONICAL_BASE}/sid/imaging-study|${ENCOUNTER_ID}`)}`,
		])
		const study = entries[1]?.resource as ImagingStudy
		expect(study.status).toBe("registered")
		expect(study.series).toEqual([
			{ uid: DOC_SERIES_UID, number: 2, modality: { system: expect.any(String), code: "DOC" } },
		])
		expect(study.series?.[0]?.instance).toBeUndefined()
		expect(study.meta?.tag).toContainEqual({ system: `${DEFAULT_CANONICAL_BASE}/tag/draft`, code: ACQUISITION_ID })
	})

	it("CAP-021-R39 adds the DOC series to the study the visit already has and keeps its other series", async () => {
		const run = storeHarness(undefined, [{ ...STUDY_WITH_PHOTOS, series: STUDY_WITH_PHOTOS.series?.slice(0, 1) }])

		await run.store.recordDraftDocument(document)

		const study = entriesOf(run.requests[1])[1]?.resource as ImagingStudy
		expect(study.id).toBe("study-1")
		expect(study.series?.map((series) => series.uid)).toEqual([PHOTO_SERIES_UID, DOC_SERIES_UID])
		expect(study.meta?.tag ?? []).not.toContainEqual({
			system: `${DEFAULT_CANONICAL_BASE}/tag/draft`,
			code: ACQUISITION_ID,
		})
	})

	it("ADR-050 (doplnění D33) bod 3 withdraws the document and takes its series out of the study of the visit", async () => {
		const run = storeHarness(undefined, [STUDY_WITH_PHOTOS])

		await run.store.withdrawDraftDocument(withdrawnDocument)

		const entries = entriesOf(run.requests[1])
		expect(entries[0]?.resource).toMatchObject({ resourceType: "DocumentReference", status: "entered-in-error" })
		const study = entries[1]?.resource as ImagingStudy
		expect(study.status).toBe("registered")
		expect(study.series?.map((series) => series.uid)).toEqual([PHOTO_SERIES_UID])
	})

	it("ADR-050 (doplnění D33) bod 3 withdraws a study that held only the series of the document", async () => {
		const run = storeHarness(undefined, [{ ...STUDY_WITH_PHOTOS, series: STUDY_WITH_PHOTOS.series?.slice(1) }])

		await run.store.withdrawDraftDocument(withdrawnDocument)

		const study = entriesOf(run.requests[1])[1]?.resource as ImagingStudy
		expect(study.status).toBe("entered-in-error")
	})

	it("withdraws only the document of a record founded before its series", async () => {
		const run = storeHarness()

		await run.store.withdrawDraftDocument({ ...withdrawnDocument, series: undefined })

		expect(run.requests).toHaveLength(1)
		expect(entriesOf(run.requests[0]).map((entry) => entry.resource?.resourceType)).toEqual(["DocumentReference"])
	})

	it("names the document when the store refuses it", async () => {
		const run = storeHarness({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "invalid" }] })

		const failure = await run.store.recordDraftDocument(document).then(
			() => undefined,
			(error: unknown) => error,
		)

		expect(failure).toBeInstanceOf(ClinicalRecordStoreError)
		expect((failure as ClinicalRecordStoreError).failure).toBe(CLINICAL_RECORD_FAILURE.REJECTED)
		expect((failure as ClinicalRecordStoreError).message).toContain(`recording the document ${DOCUMENT_ID}`)
	})
})

describe("instances written after a confirmed C-STORE CAP-021-R28 ✓ backend.md 3 T4", () => {
	it("refuses the delivery of a record whose study is not in the store and writes nothing", async () => {
		const run = storeHarness()

		await expect(
			run.store.recordDelivery({
				acquisitionId: ACQUISITION_ID,
				patientId: "patient-7",
				study: { encounterId: ENCOUNTER_ID },
				instances: [],
				createdAt: undefined,
				confirmedAt: "2026-11-09T10:16:02.000Z",
			}),
		).rejects.toMatchObject({ failure: CLINICAL_RECORD_FAILURE.REJECTED })
		expect(run.requests.map((request) => request.method)).toEqual(["GET"])
	})
})

describe("withdrawal of a new finding ADR-050 bod 10, ADR-050 (doplnění D33) bod 3", () => {
	it("withdraws the finding, its body structure and its wound type in one transaction", async () => {
		const run = storeHarness()

		await run.store.withdrawDraftFinding(finding, woundType)

		expect(run.requests).toHaveLength(1)
		const [request] = run.requests
		const bundle = request?.body as Bundle | undefined
		expect(request?.method).toBe("POST")
		expect(bundle?.type).toBe("transaction")
		expect(bundle?.entry?.map((entry) => entry.resource?.resourceType)).toEqual([
			"Condition",
			"BodyStructure",
			"Observation",
		])
	})
})

describe("code lists published to the clinical record CAP-017-R20", () => {
	it("CAP-017-S15 writes each code system and value set over its canonical URL and never duplicates it", async () => {
		const run = storeHarness()

		await run.store.publishCodeLists(codeLists)
		await run.store.publishCodeLists(codeLists)

		expect(run.stored.size).toBe(3)
		expect(run.requests.slice(0, 3).map((request) => `${request.method} ${request.url}`)).toEqual([
			`PUT fhir/R4/CodeSystem?url=${INSTANCE_BASE}/CodeSystem/wound-type`,
			`PUT fhir/R4/ValueSet?url=${INSTANCE_BASE}/ValueSet/wound-type`,
			`PUT fhir/R4/ValueSet?url=${INSTANCE_BASE}/ValueSet/wound-type-active`,
		])
	})
})

describe("source of a photo written after its upload CAP-021-R37", () => {
	const image: ClinicalImageResource = {
		kind: CLINICAL_FILE_KIND.IMAGE,
		fileId: "66666666-6666-4666-8666-666666666666",
		acquisitionId: ACQUISITION_ID,
		sequence: 1,
		department: DEPARTMENT,
		patientResourceId: "patient-1",
		encounterResourceId: "encounter-1",
		seriesInstanceUid: "2.25.1",
		sopInstanceUid: undefined,
		original: { binaryId: "binary-1", contentType: "image/jpeg", sizeBytes: 3, sha1Base64: "sha1", sha256: "sha256" },
		thumbnail: undefined,
		viewingCopy: undefined,
		findingResourceId: "condition-1",
		assessmentResourceId: undefined,
		studyResourceId: "study-1",
	}

	it("CAP-021-R37 writes the DocumentReference over our file identifier and keeps one when written again", async () => {
		const run = storeHarness()

		const id = await run.store.recordFileResource(image)
		await run.store.recordFileResource(image)

		expect(id).toBe("id-1")
		expect(run.stored.size).toBe(1)
		expect(run.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
			`PUT fhir/R4/DocumentReference?identifier=${DEFAULT_CANONICAL_BASE}/sid/image|${image.fileId}`,
			`PUT fhir/R4/DocumentReference?identifier=${DEFAULT_CANONICAL_BASE}/sid/image|${image.fileId}`,
		])
	})

	it("ADR-050 bod 10 takes a refused source as a rejection, so the administrator learns of it", async () => {
		const run = storeHarness({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "invalid" }] })

		const error = await run.store.recordFileResource(image).catch((caught: unknown) => caught)

		expect(error).toBeInstanceOf(ClinicalRecordStoreError)
		expect((error as ClinicalRecordStoreError).failure).toBe(CLINICAL_RECORD_FAILURE.REJECTED)
	})
})

describe("PDF of a scanned document written after its upload CAP-021-R39", () => {
	const role: Resource = { resourceType: "PractitionerRole", id: "role-1" }
	const pdfDocument: ClinicalScannedDocumentPdf = {
		acquisitionId: ACQUISITION_ID,
		documentId: DOCUMENT_ID,
		patientResourceId: "patient-7",
		department: DEPARTMENT,
		closedAt: "2026-11-02T09:30:00.000Z",
		author: { userId: "99999999-9999-4999-8999-999999999999", department: DEPARTMENT },
		title: { code: undefined, text: "Propouštěcí zpráva" },
		pageCount: 3,
		study: { encounterResourceId: "encounter-1" },
		series: { seriesInstanceUid: DOC_SERIES_UID },
		studyResourceId: "study-1",
		delivered: undefined,
		pdf: { binaryId: "binary-pdf", contentType: "application/pdf", sizeBytes: 3, sha1Base64: "sha1", sha256: "sha256" },
	}

	it("CAP-021-R39 rewrites the DocumentReference of the document over its identifier and keeps one when written again", async () => {
		const run = storeHarness(undefined, [role])

		const id = await run.store.recordScannedDocumentPdf(pdfDocument)
		await run.store.recordScannedDocumentPdf(pdfDocument)

		expect(id).toBe("id-1")
		expect(run.stored.size).toBe(1)
		expect(run.requests.filter((request) => request.method === "PUT").map((request) => request.url)).toEqual([
			`fhir/R4/DocumentReference?identifier=${DEFAULT_CANONICAL_BASE}/sid/document|${DOCUMENT_ID}`,
			`fhir/R4/DocumentReference?identifier=${DEFAULT_CANONICAL_BASE}/sid/document|${DOCUMENT_ID}`,
		])
		const written = [...run.stored.values()][0] as DocumentReference
		expect(written.content?.[0]?.attachment?.url).toBe("Binary/binary-pdf")
		expect(written.author).toEqual([{ reference: "PractitionerRole/role-1" }])
		expect(written.context?.related).toEqual([{ reference: "ImagingStudy/study-1" }])
	})

	it("ADR-050 bod 10 takes a refused document as a rejection, so the administrator learns of it", async () => {
		const outcome = { resourceType: "OperationOutcome", issue: [{ severity: "error", code: "invalid" }] }
		const run = storeHarness(outcome, [role], "PUT")

		const error = await run.store.recordScannedDocumentPdf(pdfDocument).catch((caught: unknown) => caught)

		expect(run.requests.at(-1)?.method).toBe("PUT")
		expect(error).toBeInstanceOf(ClinicalRecordStoreError)
		expect((error as ClinicalRecordStoreError).failure).toBe(CLINICAL_RECORD_FAILURE.REJECTED)
	})
})

describe("attachment hash of a Binary the buffer no longer holds CAP-021-R37, CAP-026-R18", () => {
	it("ADR-050 bod 11 reads the Binary by its id and returns the SHA-1 of its bytes in base64", async () => {
		const run = storeHarness()

		const hash = await run.store.attachmentHashOf("binary-1")

		expect(hash).toBe(createHash("sha1").update(BINARY_BYTES).digest("base64"))
		expect(run.requests.map((request) => `${request.method} ${request.url}`)).toEqual([`GET ${BINARY_PATH}binary-1`])
	})

	it("takes a Binary the store refuses as a rejection", async () => {
		const run = storeHarness({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "invalid" }] })

		const error = await run.store.attachmentHashOf("binary-1").then(
			() => undefined,
			(caught: unknown) => caught,
		)

		expect(error).toBeInstanceOf(ClinicalRecordStoreError)
		expect((error as ClinicalRecordStoreError).failure).toBe(CLINICAL_RECORD_FAILURE.REJECTED)
	})
})
