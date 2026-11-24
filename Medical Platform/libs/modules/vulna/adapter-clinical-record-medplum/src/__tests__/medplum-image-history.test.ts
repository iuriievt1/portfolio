import {
	ACQUISITION_KIND,
	CLINICAL_RECORD_FAILURE,
	type ClinicalDraftAssessment,
	type ClinicalDraftFinding,
	ClinicalRecordStoreError,
} from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import { FINDING_RECORD } from "../draft-records"
import type { Resource } from "../fhir-types"
import { bodyStructureOf, conditionOf } from "../finding-resources"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf } from "../identifiers"
import { MedplumImageHistory } from "../medplum-image-history"
import { assessmentObservationOf } from "../observation-resources"

const BASE_URL = "http://store.invalid/"
const TOKEN_PATH = "oauth2/token"
const HTTP_OK = 200
const HTTP_BAD_REQUEST = 400
const HTTP_FORBIDDEN = 403
const HTTP_SERVICE_UNAVAILABLE = 503
const MEMBERSHIP = "membership-1"
const ACQUISITION_ID = "55555555-5555-4555-8555-555555555555"
const FINDING_ID = "44444444-4444-4444-8444-444444444444"
const DEPARTMENT = { id: "33333333-3333-4333-8333-333333333333", code: "KOC" }
const context = { systems: identifierSystemsOf(DEFAULT_CANONICAL_BASE), instanceBase: "https://fhir.mou.cz/vulna" }

const finding: ClinicalDraftFinding = {
	findingId: FINDING_ID,
	acquisitionId: ACQUISITION_ID,
	patientResourceId: "patient-7",
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
	patientResourceId: "patient-7",
	conditionResourceId: "condition-3",
	bodyStructureResourceId: "body-structure-9",
	department: DEPARTMENT,
	healingPhaseCode: undefined,
	healingPhaseName: undefined,
	description: "Okraje klidné",
}

const STORED: Record<string, Resource[]> = {
	Observation: [
		{ ...assessmentObservationOf(assessment, FINDING_RECORD.CLOSED, context), id: "observation-1" },
		{ ...conditionOf(finding, FINDING_RECORD.CLOSED, context), id: "condition-3" },
	],
	BodyStructure: [{ ...bodyStructureOf(finding, FINDING_RECORD.CLOSED, context), id: "body-structure-9" }],
	DocumentReference: [],
}

// Medplum 5.2.18
const OUTCOMES: Record<number, unknown> = {
	[HTTP_FORBIDDEN]: {
		resourceType: "OperationOutcome",
		id: "forbidden",
		issue: [{ severity: "error", code: "forbidden", details: { text: "Forbidden" } }],
	},
	[HTTP_SERVICE_UNAVAILABLE]: {
		resourceType: "OperationOutcome",
		issue: [{ severity: "error", code: "exception", details: { text: "Service unavailable" } }],
	},
	[HTTP_BAD_REQUEST]: {
		resourceType: "OperationOutcome",
		issue: [
			{
				severity: "error",
				code: "invalid",
				details: { text: "Authentication error" },
				diagnostics: "OperationOutcomeError: Forbidden",
			},
		],
	},
}

interface SearchRequest {
	resourceType: string
	query: URLSearchParams
	onBehalfOf: string | null
}

function answer(body: unknown, status = HTTP_OK): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/fhir+json" } })
}

function headerOf(init: RequestInit | undefined, name: string): string | null {
	return new Headers(init?.headers).get(name)
}

function historyHarness(status = HTTP_OK) {
	const searches: SearchRequest[] = []
	const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		const url = new URL(String(input))
		if (url.pathname.endsWith(TOKEN_PATH)) {
			return answer({ access_token: "token", token_type: "Bearer", expires_in: 3600 })
		}
		const resourceType = url.pathname.split("/").at(-1) ?? ""
		searches.push({ resourceType, query: url.searchParams, onBehalfOf: headerOf(init, "X-Medplum-On-Behalf-Of") })
		const outcome = OUTCOMES[status]
		if (outcome !== undefined) {
			return answer(outcome, status)
		}
		const resources = STORED[resourceType] ?? []
		return answer({ resourceType: "Bundle", type: "searchset", entry: resources.map((resource) => ({ resource })) })
	}
	const history = new MedplumImageHistory({
		baseUrl: BASE_URL,
		clientId: "client",
		clientSecret: "secret",
		canonicalBase: DEFAULT_CANONICAL_BASE,
		instanceBaseUri: "https://fhir.mou.cz/vulna",
		fetch,
	})
	return { history, searches }
}

const reader = { membershipResourceId: MEMBERSHIP }

// ADR-053 bod 3, ADR-054 bod 2, CAP-020-R16
describe("closed records read on behalf of the user", () => {
	it("CAP-020-S08 reads the closed wounds of the patient on behalf of the user", async () => {
		const run = historyHarness()

		const records = await run.history.closedWoundsOfPatient(reader, "patient-7")

		expect(records.wounds).toEqual([
			{
				acquisitionId: ACQUISITION_ID,
				findingId: FINDING_ID,
				site: { regionCode: "181553006", laterality: "L", view: "anterior", x: 0.5, y: 0.25, bodyDiagramVersion: "2" },
				healingPhaseCode: undefined,
				description: "Okraje klidné",
				closedWoundTypeCode: undefined,
			},
		])
		expect(run.searches.map((search) => [search.resourceType, search.onBehalfOf])).toEqual([
			["Observation", `ProjectMembership/${MEMBERSHIP}`],
			["BodyStructure", `ProjectMembership/${MEMBERSHIP}`],
		])
		expect(run.searches[0]?.query.get("subject")).toBe("Patient/patient-7")
		expect(run.searches[1]?.query.get("_id")).toBe("body-structure-9")
	})

	it("CAP-020-R18 reads the closed documents of the patient with one search on behalf of the user", async () => {
		const run = historyHarness()

		expect(await run.history.closedScansOfPatient(reader, "patient-7")).toEqual([])
		expect(run.searches.map((search) => [search.resourceType, search.onBehalfOf])).toEqual([
			["DocumentReference", `ProjectMembership/${MEMBERSHIP}`],
		])
		expect(run.searches[0]?.query.get("subject")).toBe("Patient/patient-7")
	})

	it("ADR-050 bod 11 asks for one page of at most 200 resources without a total", async () => {
		const run = historyHarness()

		await run.history.closedWoundsOfPatient(reader, "patient-7")

		expect(run.searches.map((search) => [search.query.get("_count"), search.query.get("_total")])).toEqual([
			["200", "none"],
			["200", "none"],
		])
	})

	it("ADR-053 bod 4 never answers a reader from what another reader was given", async () => {
		const run = historyHarness()

		await run.history.closedWoundsOfPatient(reader, "patient-7")
		await run.history.closedWoundsOfPatient({ membershipResourceId: "membership-2" }, "patient-7")

		expect(run.searches.filter((search) => search.resourceType === "Observation").map((s) => s.onBehalfOf)).toEqual([
			`ProjectMembership/${MEMBERSHIP}`,
			"ProjectMembership/membership-2",
		])
	})

	it("CAP-020-S09 CAP-020-S14 answers what the store refuses to show exactly like nothing", async () => {
		const run = historyHarness(HTTP_FORBIDDEN)

		expect(await run.history.closedWoundsOfPatient(reader, "patient-7")).toEqual({ findings: [], wounds: [] })
		expect(await run.history.closedScansOfPatient(reader, "patient-7")).toEqual([])
		expect(
			await run.history.closedAcquisitionsOfEncounters(reader, [
				{ encounterResourceId: "e", imagingStudyResourceId: "s" },
			]),
		).toEqual([])
	})

	it("ADR-053 (doplnění 2026-09-24) bod 3 fails when the store does not accept the reader", async () => {
		const run = historyHarness(HTTP_BAD_REQUEST)

		const failure = await run.history.closedRecordsOfFinding(reader, "condition-3").catch((error: unknown) => error)

		expect(failure).toBeInstanceOf(ClinicalRecordStoreError)
		expect((failure as ClinicalRecordStoreError).failure).toBe(CLINICAL_RECORD_FAILURE.REJECTED)
	})

	it("CAP-020-S10 answers an unavailable store as unavailable at once, without retrying", async () => {
		const run = historyHarness(HTTP_SERVICE_UNAVAILABLE)

		const failure = await run.history.closedRecordsOfFinding(reader, "condition-3").catch((error: unknown) => error)

		expect(failure).toBeInstanceOf(ClinicalRecordStoreError)
		expect((failure as ClinicalRecordStoreError).failure).toBe(CLINICAL_RECORD_FAILURE.UNAVAILABLE)
		expect(run.searches).toHaveLength(1)
	})

	it("CAP-014-R22 asks nothing for no visit and finds the records of a visit through its study and visit", async () => {
		const run = historyHarness()

		expect(await run.history.closedAcquisitionsOfEncounters(reader, [])).toEqual([])
		expect(run.searches).toEqual([])
		expect(
			await run.history.closedAcquisitionsOfEncounters(reader, [
				{ encounterResourceId: "encounter-5", imagingStudyResourceId: "study-5" },
			]),
		).toEqual([ACQUISITION_ID])
		expect(
			run.searches.map((search) => [search.resourceType, search.query.get("part-of") ?? search.query.get("encounter")]),
		).toEqual([
			["Observation", "ImagingStudy/study-5"],
			["DocumentReference", "Encounter/encounter-5"],
		])
	})

	it("CAP-020-R17 looks a closed record up by its identifier and kind", async () => {
		const run = historyHarness()

		await run.history.closedRecord(reader, { acquisitionId: ACQUISITION_ID, kind: ACQUISITION_KIND.PHOTO })
		await run.history.closedRecord(reader, { acquisitionId: ACQUISITION_ID, kind: ACQUISITION_KIND.SCAN })

		expect(run.searches.map((search) => [search.resourceType, search.query.get("identifier")])).toEqual([
			["Observation", `${DEFAULT_CANONICAL_BASE}/sid/acquisition|${ACQUISITION_ID}`],
			["BodyStructure", null],
			["DocumentReference", `${DEFAULT_CANONICAL_BASE}/sid/acquisition|${ACQUISITION_ID}`],
		])
	})
})
