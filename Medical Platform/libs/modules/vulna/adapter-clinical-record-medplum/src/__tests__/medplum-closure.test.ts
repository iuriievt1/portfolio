import {
	CLINICAL_RECORD_FAILURE,
	ClinicalRecordStoreError,
	type ClinicalScanClosure,
	type ClinicalWoundClosure,
} from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import type { Bundle, BundleEntry, Resource } from "../fhir-types"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf } from "../identifiers"
import { MedplumClinicalRecordStore } from "../medplum-clinical-record-store"

const BASE_URL = "http://store.invalid/"
const FHIR = "fhir/R4"
const TOKEN_PATH = "oauth2/token"
const HTTP_OK = 200
const HTTP_CREATED = 201
const systems = identifierSystemsOf(DEFAULT_CANONICAL_BASE)
const DEPARTMENT = { id: "33333333-3333-4333-8333-333333333333", code: "KOC" }
const USER_ID = "77777777-7777-4777-8777-777777777777"
const ENCOUNTER_ID = "22222222-2222-4222-8222-222222222222"
const ACQUISITION_ID = "55555555-5555-4555-8555-555555555555"

interface Request {
	method: string
	url: string
	body: unknown
}

interface StoreContent {
	practitionerRole: boolean
	practitioner: boolean
	study: Resource | undefined
}

const closure: ClinicalWoundClosure = {
	acquisitionId: ACQUISITION_ID,
	patientId: "11111111-1111-4111-8111-111111111111",
	patientResourceId: "patient-7",
	department: DEPARTMENT,
	startedAt: "2026-10-07T07:50:00.000Z",
	closedAt: "2026-10-07T07:59:50.000Z",
	author: { userId: USER_ID, department: DEPARTMENT },
	station: { deviceId: "66666666-6666-4666-8666-666666666666", model: "SM-A576B" },
	study: {
		encounterId: ENCOUNTER_ID,
		encounterResourceId: "encounter-5",
		studyInstanceUid: "2.25.45",
		started: undefined,
		department: DEPARTMENT,
	},
	series: { seriesInstanceUid: "2.25.77", number: 1, bodyRegion: undefined, laterality: null },
	firstRecord: undefined,
	assessment: {
		acquisitionId: ACQUISITION_ID,
		patientResourceId: "patient-7",
		conditionResourceId: "condition-3",
		bodyStructureResourceId: "body-structure-9",
		department: DEPARTMENT,
		healingPhaseCode: "granulating",
		healingPhaseName: "Granulace",
		description: undefined,
	},
	closedWoundType: { code: "leg-ulcer", name: "Bércový vřed" },
}

const scanClosure: ClinicalScanClosure = {
	...closure,
	documentId: "88888888-8888-4888-8888-888888888888",
	title: { code: "discharge-report", text: "Propouštěcí zpráva" },
	pageCount: 2,
}

function answer(body: unknown, status = HTTP_OK): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/fhir+json" } })
}

function searchSet(resources: readonly Resource[]): Bundle {
	return { resourceType: "Bundle", type: "searchset", entry: resources.map((resource) => ({ resource })) }
}

function transactionResponseOf(request: Bundle): Bundle {
	return {
		resourceType: "Bundle",
		type: "transaction-response",
		entry: (request.entry ?? []).map(
			(entry: BundleEntry, index): BundleEntry => ({
				response: { status: "200 OK", location: `${entry.resource?.resourceType}/written-${index}/_history/1` },
			}),
		),
	}
}

// ADR-050
function closureHarness(content: Partial<StoreContent> = {}) {
	const stored: StoreContent = { practitionerRole: true, practitioner: true, study: undefined, ...content }
	const requests: Request[] = []
	const searches: Record<string, () => Resource[]> = {
		PractitionerRole: () => (stored.practitionerRole ? [{ resourceType: "PractitionerRole", id: "role-1" }] : []),
		Practitioner: () => (stored.practitioner ? [{ resourceType: "Practitioner", id: "practitioner-1" }] : []),
		Organization: () => [
			{ resourceType: "Organization", id: "root-1", identifier: [{ system: systems.organization, value: "MOU" }] },
		],
		ImagingStudy: () => (stored.study === undefined ? [] : [stored.study]),
	}
	const fetch = async (input: string | URL | globalThis.Request, init?: RequestInit): Promise<Response> => {
		const url = String(input)
		if (url.endsWith(TOKEN_PATH)) {
			return answer({ access_token: "token", token_type: "Bearer", expires_in: 3600 })
		}
		const method = init?.method ?? "GET"
		const path = decodeURIComponent(url.slice(BASE_URL.length))
		const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined
		requests.push({ method, url: path, body })
		const resourceType = path.slice(FHIR.length + 1).split("?")[0] ?? ""
		if (method === "GET") {
			return answer(searchSet(searches[resourceType]?.() ?? []))
		}
		if (path === FHIR) {
			return answer(transactionResponseOf(body as Bundle))
		}
		return answer({ ...(body as Resource), id: `${resourceType.toLowerCase()}-1` }, HTTP_CREATED)
	}
	const store = new MedplumClinicalRecordStore({
		baseUrl: BASE_URL,
		clientId: "client",
		clientSecret: "secret",
		canonicalBase: DEFAULT_CANONICAL_BASE,
		instanceBaseUri: "https://fhir.mou.cz/vulna/",
		serverVersion: "1.0.0",
		fetch,
	})
	return { store, requests, stored }
}

function requestLinesOf(requests: readonly Request[]): string[] {
	return requests.map((request) => `${request.method} ${request.url.split("?")[0]}`)
}

// CAP-021-R27, CAP-021-R31, ADR-054
describe("closure written synchronously into the store CAP-021-S21", () => {
	it("ADR-050 writes the device before the transaction of the record", async () => {
		const run = closureHarness()

		const ids = await run.store.recordWoundClosure(closure)

		expect(requestLinesOf(run.requests)).toEqual([
			`POST ${FHIR}/Device`,
			`GET ${FHIR}/PractitionerRole`,
			`GET ${FHIR}/Organization`,
			`POST ${FHIR}/Organization`,
			`GET ${FHIR}/ImagingStudy`,
			`POST ${FHIR}`,
		])
		expect(ids).toEqual({ imagingStudy: "written-0", station: "device-1" })
	})

	it("ADR-050 looks the author up by the role in the department valid at the closure", async () => {
		const run = closureHarness()

		await run.store.recordWoundClosure(closure)

		const roleSearch = run.requests.find((request) => request.url.startsWith(`${FHIR}/PractitionerRole`))
		expect(roleSearch?.url).toContain(`identifier=${systems.practitionerRole}|${USER_ID}.${DEPARTMENT.id}`)
	})

	it("names the practitioner as the author of a user without a department", async () => {
		const run = closureHarness()

		await run.store.recordWoundClosure({ ...closure, author: { userId: USER_ID, department: undefined } })

		expect(requestLinesOf(run.requests)).toContain(`GET ${FHIR}/Practitioner`)
		expect(requestLinesOf(run.requests)).not.toContain(`GET ${FHIR}/PractitionerRole`)
	})

	it("ADR-054 refuses the closure as unavailable while the author is not in the store and writes no record", async () => {
		const run = closureHarness({ practitionerRole: false })

		const failure = run.store.recordWoundClosure(closure)

		await expect(failure).rejects.toBeInstanceOf(ClinicalRecordStoreError)
		await expect(failure).rejects.toMatchObject({ failure: CLINICAL_RECORD_FAILURE.UNAVAILABLE })
		expect(requestLinesOf(run.requests)).not.toContain(`POST ${FHIR}`)
	})

	it("CAP-021-R11 merges the record into the study the visit already has", async () => {
		const run = closureHarness({
			study: {
				resourceType: "ImagingStudy",
				id: "study-4",
				status: "registered",
				subject: { reference: "Patient/patient-7" },
				series: [{ uid: "2.25.70", number: 1, modality: { code: "XC" } }],
			},
		})

		await run.store.recordWoundClosure({ ...closure, series: { ...closure.series, number: 2 } })

		const transaction = run.requests.at(-1)?.body as Bundle
		const study = transaction.entry?.find((entry) => entry.resource?.resourceType === "ImagingStudy")?.resource
		expect(study).toMatchObject({ id: "study-4", series: [{ uid: "2.25.70" }, { uid: "2.25.77", number: 2 }] })
	})

	it("CAP-021-S35 returns the document it wrote for a scanned document", async () => {
		const run = closureHarness()

		const ids = await run.store.recordScanClosure(scanClosure)

		expect(ids).toEqual({ imagingStudy: "written-0", station: "device-1", document: "written-1" })
	})
})
