import { ERROR_CODE } from "@ansora/contracts"
import {
	CLINICAL_RECORD_FAILURE,
	ClinicalRecordStoreError,
	type ClinicalRecordStorePort,
	type ClinicalScanClosure,
	type ClinicalWoundClosure,
} from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { CodeListRepository } from "../../code-list/repositories/code-list.repository"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { DEVICE, ENCOUNTER, PATIENT, problemOf, USER } from "../../encounter/__tests__/encounter-fixtures"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND } from "../constants/clinical-record.constants"
import type { ClinicalActorRepository } from "../repositories/clinical-actor.repository"
import type { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import { ClinicalContentService } from "../services/clinical-content.service"
import { ClosureRecordService } from "../services/closure-record.service"
import type { ClosedRecord, ClosedScanRecord, ClosedWoundRecord, ResourceLink } from "../types/clinical-record.types"
import { storesWith } from "./clinical-record-fixtures"

const TX = {} as postgres.TransactionSql
const RECORD_DEPARTMENT = { id: "77777777-7777-4777-8777-777777777777", code: "KOC" }
const AUTHOR_DEPARTMENT = { id: "78787878-7878-4878-8878-787878787878", code: "ONK" }
const FINDING = "f3000000-0000-4000-8000-000000000001"
const DRAFT = "a0000000-0000-4000-8000-000000000001"
const DOCUMENT = "d1000000-0000-4000-8000-000000000001"
const CLOSED_AT = new Date("2026-10-07T07:59:50Z")
// schema-postavy.md 3
const SCALP = "43067004"
const HEAD = { code: "69536005", meaning: "Head" }

const ITEMS = [
	{ codeListCode: "wound-type", code: "leg-ulcer", names: { cs: "Bércový vřed" } },
	{ codeListCode: "healing-phase", code: "granulating", names: { cs: "Granulace" } },
	{ codeListCode: "document-title", code: "discharge-report", names: { cs: "Propouštěcí zpráva" } },
]

const CLOSED: ClosedRecord = {
	acquisitionId: DRAFT,
	patientId: PATIENT,
	departmentId: RECORD_DEPARTMENT.id,
	operatorUserId: USER,
	station: { deviceId: DEVICE, model: "SM-A576B" },
	startedAt: new Date("2026-10-07T07:50:00Z"),
	closedAt: CLOSED_AT,
	encounter: {
		id: ENCOUNTER,
		studyInstanceUid: "2.25.1",
		startedAt: new Date("2026-10-07T07:30:00Z"),
		departmentId: RECORD_DEPARTMENT.id,
	},
	series: { seriesInstanceUid: "2.25.9", number: 2 },
}

const WOUND: ClosedWoundRecord = {
	...CLOSED,
	findingId: FINDING,
	isFirstRecordOfFinding: true,
	site: { regionCode: SCALP, laterality: null, view: "anterior", x: 0.5, y: 0.04, bodyDiagramVersion: "1" },
	woundTypeCode: "leg-ulcer",
	healingPhaseCode: "granulating",
	description: null,
}

const SCAN: ClosedScanRecord = {
	...CLOSED,
	documentId: DOCUMENT,
	titleCode: "discharge-report",
	titleText: null,
	pageCount: 3,
}

interface HarnessOptions {
	isEncounterRecorded: boolean
}

function harness(store: Partial<ClinicalRecordStorePort> | undefined, options: Partial<HarnessOptions> = {}) {
	const { isEncounterRecorded }: HarnessOptions = {
		isEncounterRecorded: true,
		...options,
	}
	const written: ResourceLink[] = []
	const askedMoments: Date[] = []
	const actors = {
		departmentOf: async () => RECORD_DEPARTMENT,
		departmentAt: async (_sql: never, _userId: string, moment: Date) => {
			askedMoments.push(moment)
			return AUTHOR_DEPARTMENT
		},
	} as unknown as ClinicalActorRepository
	const links = {
		resourceIdOf: async (_tx: never, link: Omit<ResourceLink, "resourceId">) =>
			link.localKind === LOCAL_KIND.ENCOUNTER && !isEncounterRecorded ? undefined : `${link.localKind}-9`,
		upsert: async (_tx: never, rows: readonly ResourceLink[]) => {
			written.push(...rows)
		},
	} as unknown as FhirResourceLinkRepository
	const codeLists = {
		items: async (_tx: never, codeListCode: string) => ITEMS.filter((item) => item.codeListCode === codeListCode),
	} as unknown as CodeListRepository
	const configuration = { instanceDefaultLanguage: async () => "cs" } as unknown as ConfigurationService
	const content = new ClinicalContentService(actors, links, codeLists, configuration)
	const service = new ClosureRecordService(storesWith(store), content, actors, links)
	return { service, written, askedMoments }
}

function woundStore(sent: ClinicalWoundClosure[]): Partial<ClinicalRecordStorePort> {
	return {
		recordWoundClosure: async (closure) => {
			sent.push(closure)
			return { imagingStudy: "study-1", station: "device-1" }
		},
	}
}

// CAP-021-R27, CAP-021-R31, ADR-050, ADR-054
describe("closed wound record sent to the clinical record CAP-021-S21", () => {
	it("ADR-050 names the author with the department valid when the record closed", async () => {
		const sent: ClinicalWoundClosure[] = []
		const run = harness(woundStore(sent))

		await run.service.recordWound(TX, WOUND)

		expect(run.askedMoments).toEqual([CLOSED_AT])
		expect(sent[0]?.author).toEqual({ userId: USER, department: AUTHOR_DEPARTMENT })
		expect(sent[0]?.department).toEqual(RECORD_DEPARTMENT)
	})

	it("sends the study of the visit, its series with the DICOM region and the device the record was closed on", async () => {
		const sent: ClinicalWoundClosure[] = []
		const run = harness(woundStore(sent))

		await run.service.recordWound(TX, WOUND)

		expect(sent[0]).toMatchObject({
			acquisitionId: DRAFT,
			patientId: PATIENT,
			patientResourceId: "patient-9",
			startedAt: "2026-10-07T07:50:00.000Z",
			closedAt: "2026-10-07T07:59:50.000Z",
			station: { deviceId: DEVICE, model: "SM-A576B" },
			study: {
				encounterId: ENCOUNTER,
				encounterResourceId: "encounter-9",
				studyInstanceUid: "2.25.1",
				started: "2026-10-07T07:30:00.000Z",
				department: RECORD_DEPARTMENT,
			},
			series: { seriesInstanceUid: "2.25.9", number: 2, bodyRegion: HEAD, laterality: null },
		})
	})

	it("CAP-020-R21 sends the wound type the record closed with by its name in the default language", async () => {
		const sent: ClinicalWoundClosure[] = []
		const run = harness(woundStore(sent))

		await run.service.recordWound(TX, WOUND)

		expect(sent[0]?.closedWoundType).toEqual({ code: "leg-ulcer", name: "Bércový vřed" })
		expect(sent[0]?.assessment).toMatchObject({ healingPhaseCode: "granulating", healingPhaseName: "Granulace" })
		expect(sent[0]?.firstRecord).toMatchObject({
			finding: { findingId: FINDING, acquisitionId: DRAFT },
			woundType: { woundTypeCode: "leg-ulcer", conditionResourceId: "finding-9" },
		})
	})

	it("CAP-017-S16 sends a wound record without the wound type and healing phase the instance switched off", async () => {
		const sent: ClinicalWoundClosure[] = []
		const run = harness(woundStore(sent))

		await run.service.recordWound(TX, {
			...WOUND,
			woundTypeCode: undefined,
			healingPhaseCode: undefined,
			description: "Klidné okraje",
		})

		expect(sent[0]?.closedWoundType).toBeUndefined()
		expect(sent[0]?.assessment).toMatchObject({
			healingPhaseCode: undefined,
			healingPhaseName: undefined,
			description: "Klidné okraje",
		})
		expect(sent[0]?.firstRecord?.finding).toMatchObject({ findingId: FINDING, acquisitionId: DRAFT })
		expect(sent[0]?.firstRecord?.woundType).toBeUndefined()
	})

	it("ADR-050 leaves the wound itself out of a later record", async () => {
		const sent: ClinicalWoundClosure[] = []
		const run = harness(woundStore(sent))

		await run.service.recordWound(TX, { ...WOUND, isFirstRecordOfFinding: false })

		expect(sent[0]?.firstRecord).toBeUndefined()
	})

	it("datovy-model.md 13.2 links the study of the visit and the device to what the store wrote", async () => {
		const run = harness(woundStore([]))

		await run.service.recordWound(TX, WOUND)

		expect(run.written).toEqual([
			{
				resourceType: FHIR_RESOURCE_TYPE.IMAGING_STUDY,
				localKind: LOCAL_KIND.IMAGING_STUDY,
				localId: ENCOUNTER,
				resourceId: "study-1",
			},
			{
				resourceType: FHIR_RESOURCE_TYPE.DEVICE,
				localKind: LOCAL_KIND.DEVICE,
				localId: DEVICE,
				resourceId: "device-1",
			},
		])
	})

	it("ADR-054 answers documentation unavailable when the store does not answer and links nothing", async () => {
		const run = harness({
			recordWoundClosure: async () => {
				throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "connection refused")
			},
		})

		const problem = await problemOf(run.service.recordWound(TX, WOUND))

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.written).toEqual([])
	})

	it("ADR-054 answers documentation unavailable without a configured store", async () => {
		const problem = await problemOf(harness(undefined).service.recordWound(TX, WOUND))

		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
	})

	it("refuses a record whose visit the clinical record does not hold", async () => {
		const run = harness(woundStore([]), { isEncounterRecorded: false })

		const problem = await problemOf(run.service.recordWound(TX, WOUND))

		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
	})
})

// CAP-021-R39, ADR-050
describe("closed scan record sent to the clinical record CAP-021-S35", () => {
	function scanStore(sent: ClinicalScanClosure[]): Partial<ClinicalRecordStorePort> {
		return {
			recordScanClosure: async (closure) => {
				sent.push(closure)
				return { imagingStudy: "study-1", station: "device-1", document: "document-1" }
			},
		}
	}

	it("CAP-018-R15 names a coded title in the default language and counts the pages", async () => {
		const sent: ClinicalScanClosure[] = []
		const run = harness(scanStore(sent))

		await run.service.recordScan(TX, SCAN)

		expect(sent[0]).toMatchObject({
			documentId: DOCUMENT,
			title: { code: "discharge-report", text: "Propouštěcí zpráva" },
			pageCount: 3,
			series: { seriesInstanceUid: "2.25.9", number: 2, bodyRegion: undefined, laterality: null },
		})
		expect(run.written.at(-1)).toEqual({
			resourceType: FHIR_RESOURCE_TYPE.DOCUMENT_REFERENCE,
			localKind: LOCAL_KIND.DOCUMENT,
			localId: DOCUMENT,
			resourceId: "document-1",
		})
	})

	it("CAP-018-R15 keeps a free-text title", async () => {
		const sent: ClinicalScanClosure[] = []
		const run = harness(scanStore(sent))

		await run.service.recordScan(TX, { ...SCAN, titleCode: null, titleText: "Výsledky z jiné nemocnice" })

		expect(sent[0]?.title).toEqual({ code: undefined, text: "Výsledky z jiné nemocnice" })
	})
})
