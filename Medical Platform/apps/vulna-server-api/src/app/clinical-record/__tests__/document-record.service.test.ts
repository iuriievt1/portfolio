import { ERROR_CODE } from "@ansora/contracts"
import {
	CLINICAL_RECORD_FAILURE,
	type ClinicalFoundedDocument,
	ClinicalRecordStoreError,
	type ClinicalRecordStorePort,
	type ClinicalWithdrawnDocument,
} from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { CodeListRepository } from "../../code-list/repositories/code-list.repository"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { problemOf } from "../../encounter/__tests__/encounter-fixtures"
import type { ClinicalActorRepository } from "../repositories/clinical-actor.repository"
import type { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import { ClinicalContentService } from "../services/clinical-content.service"
import { DocumentRecordService } from "../services/document-record.service"
import type { FoundedDocumentRecord, ResourceLink, WithdrawnDocumentRecord } from "../types/clinical-record.types"
import { storesWith } from "./clinical-record-fixtures"

const TX = {} as postgres.TransactionSql
const DEPARTMENT_ROW = { id: "77777777-7777-4777-8777-777777777777", code: "KOC" }
const DOCUMENT = "d1000000-0000-4000-8000-000000000001"
const DRAFT = "a0000000-0000-4000-8000-000000000001"
const ENCOUNTER = "e1000000-0000-4000-8000-000000000001"
const PATIENT = "p1000000-0000-4000-8000-000000000001"
const RESOURCE = "document-reference-1"
const STUDY_RESOURCE = "imaging-study-1"
const PATIENT_RESOURCE = "patient-7"
const ENCOUNTER_RESOURCE = "encounter-2"
const SERIES_UID = "2.25.111"
const STARTED_AT = new Date("2026-10-19T07:00:00.000Z")

const RECORD: FoundedDocumentRecord = {
	documentId: DOCUMENT,
	acquisitionId: DRAFT,
	departmentId: DEPARTMENT_ROW.id,
	patientId: PATIENT,
	encounter: { id: ENCOUNTER, studyInstanceUid: "2.25.999", startedAt: STARTED_AT, departmentId: DEPARTMENT_ROW.id },
	series: { seriesInstanceUid: SERIES_UID, number: 2 },
}

const WITHDRAWN: WithdrawnDocumentRecord = {
	documentId: DOCUMENT,
	acquisitionId: DRAFT,
	departmentId: DEPARTMENT_ROW.id,
	series: { encounterId: ENCOUNTER, seriesInstanceUid: SERIES_UID },
}

const SENT: ClinicalFoundedDocument = {
	documentId: DOCUMENT,
	acquisitionId: DRAFT,
	department: DEPARTMENT_ROW,
	patientResourceId: PATIENT_RESOURCE,
	study: {
		encounterId: ENCOUNTER,
		encounterResourceId: ENCOUNTER_RESOURCE,
		studyInstanceUid: "2.25.999",
		started: STARTED_AT.toISOString(),
		department: DEPARTMENT_ROW,
	},
	series: { seriesInstanceUid: SERIES_UID, number: 2, bodyRegion: undefined, laterality: null },
}

const RESOURCE_OF: Readonly<Record<string, string>> = {
	Patient: PATIENT_RESOURCE,
	Encounter: ENCOUNTER_RESOURCE,
	DocumentReference: RESOURCE,
}

function harness(store: Partial<ClinicalRecordStorePort> | undefined, isDocumentRecorded = true) {
	const written: ResourceLink[] = []
	const removed: [string, readonly string[]][] = []
	const actors = { departmentOf: async () => DEPARTMENT_ROW } as unknown as ClinicalActorRepository
	const links = {
		resourceIdOf: async (_tx: never, link: { resourceType: string }) =>
			link.resourceType === "DocumentReference" && !isDocumentRecorded ? undefined : RESOURCE_OF[link.resourceType],
		upsert: async (_tx: never, rows: readonly ResourceLink[]) => {
			written.push(...rows)
		},
		remove: async (_tx: never, kind: string, ids: readonly string[]) => {
			removed.push([kind, ids])
		},
	} as unknown as FhirResourceLinkRepository
	const content = new ClinicalContentService(actors, links, {} as CodeListRepository, {} as ConfigurationService)
	const service = new DocumentRecordService(storesWith(store), content, links)
	return { service, written, removed }
}

describe("scanned document of a draft in the clinical record CAP-021-R39", () => {
	it("CAP-021-R28 records the document and the DOC series of its visit and links both", async () => {
		const sent: ClinicalFoundedDocument[] = []
		const run = harness({
			recordDraftDocument: async (document) => {
				sent.push(document)
				return { document: RESOURCE, imagingStudy: STUDY_RESOURCE }
			},
		})

		await run.service.recordDraft(TX, RECORD)

		expect(sent).toEqual([SENT])
		expect(run.written).toEqual([
			{ resourceType: "DocumentReference", localKind: "document", localId: DOCUMENT, resourceId: RESOURCE },
			{ resourceType: "ImagingStudy", localKind: "imaging-study", localId: ENCOUNTER, resourceId: STUDY_RESOURCE },
		])
	})

	it("ADR-050 (doplnění D33) bod 3 withdraws the document with its series and forgets its link", async () => {
		const withdrawn: ClinicalWithdrawnDocument[] = []
		const run = harness({
			withdrawDraftDocument: async (document) => {
				withdrawn.push(document)
			},
		})

		await run.service.withdrawDraft(TX, WITHDRAWN)

		expect(withdrawn).toEqual([
			{
				documentId: DOCUMENT,
				acquisitionId: DRAFT,
				department: DEPARTMENT_ROW,
				series: { encounterId: ENCOUNTER, seriesInstanceUid: SERIES_UID },
			},
		])
		expect(run.removed).toEqual([["document", [DOCUMENT]]])
	})

	it("ADR-050 (doplnění D33) bod 3 leaves the store alone for a document it never received", async () => {
		const withdrawn: ClinicalWithdrawnDocument[] = []
		const run = harness(
			{
				withdrawDraftDocument: async (document) => {
					withdrawn.push(document)
				},
			},
			false,
		)

		await run.service.withdrawDraft(TX, WITHDRAWN)

		expect(withdrawn).toEqual([])
		expect(run.removed).toEqual([])
	})

	it("ADR-054 bod 5 answers documentation unavailable when the store does not answer", async () => {
		const run = harness({
			recordDraftDocument: async () => {
				throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "down")
			},
		})

		const problem = await problemOf(run.service.recordDraft(TX, RECORD))

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.written).toEqual([])
	})

	it("ADR-054 bod 5 answers documentation unavailable without a store", async () => {
		const problem = await problemOf(harness(undefined).service.recordDraft(TX, RECORD))

		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
	})
})
