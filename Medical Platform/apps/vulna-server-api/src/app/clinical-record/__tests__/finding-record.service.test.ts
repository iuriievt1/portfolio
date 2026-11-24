import { ERROR_CODE } from "@ansora/contracts"
import {
	CLINICAL_RECORD_FAILURE,
	type ClinicalDraftAssessment,
	type ClinicalDraftFinding,
	type ClinicalDraftWoundType,
	ClinicalRecordStoreError,
	type ClinicalRecordStorePort,
	type ClinicalWoundTypeChange,
} from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { CodeListRepository } from "../../code-list/repositories/code-list.repository"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { PATIENT, problemOf, USER } from "../../encounter/__tests__/encounter-fixtures"
import { FHIR_RESOURCE_TYPE } from "../constants/clinical-record.constants"
import type { ClinicalActorRepository } from "../repositories/clinical-actor.repository"
import type { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import { ClinicalContentService } from "../services/clinical-content.service"
import { FindingRecordService } from "../services/finding-record.service"
import type {
	DraftAssessmentRecord,
	DraftFindingRecord,
	ResourceLink,
	WoundTypeChangeRecord,
} from "../types/clinical-record.types"
import { storesWith } from "./clinical-record-fixtures"

const TX = {} as postgres.TransactionSql
const DEPARTMENT_ROW = { id: "77777777-7777-4777-8777-777777777777", code: "KOC" }
const FINDING = "f3000000-0000-4000-8000-000000000001"
const DRAFT = "a0000000-0000-4000-8000-000000000001"
const CHANGE = "c4000000-0000-4000-8000-000000000001"
const CHANGED_AT = new Date("2026-10-22T09:15:00Z")
const AUTHOR_DEPARTMENT = { id: "78787878-7878-4878-8878-787878787878", code: "ONK" }

function linkedResourceIdOf(link: Pick<ResourceLink, "resourceType" | "localId">): string {
	return `${link.resourceType}/${link.localId}`
}

const PATIENT_RESOURCE = linkedResourceIdOf({ resourceType: FHIR_RESOURCE_TYPE.PATIENT, localId: PATIENT })
const CONDITION_RESOURCE = linkedResourceIdOf({ resourceType: FHIR_RESOURCE_TYPE.CONDITION, localId: FINDING })

const RECORD: DraftFindingRecord = {
	findingId: FINDING,
	acquisitionId: DRAFT,
	patientId: PATIENT,
	departmentId: DEPARTMENT_ROW.id,
	site: {
		regionCode: "84607009",
		laterality: "R",
		view: "posterior",
		x: 125 / 200,
		y: 392 / 400,
		bodyDiagramVersion: "1",
	},
}

const ASSESSMENT: DraftAssessmentRecord = {
	acquisitionId: DRAFT,
	findingId: FINDING,
	patientId: PATIENT,
	departmentId: DEPARTMENT_ROW.id,
	bodyDiagramVersion: "1",
	healingPhaseCode: "granulating",
	description: null,
}

const CHANGE_RECORD: WoundTypeChangeRecord = {
	changeId: CHANGE,
	findingId: FINDING,
	patientId: PATIENT,
	departmentId: DEPARTMENT_ROW.id,
	woundTypeCode: "leg-ulcer",
	changedAt: CHANGED_AT,
	changedBy: USER,
}

const ITEMS = [
	{
		id: "i1",
		codeListCode: "wound-type",
		code: "leg-ulcer",
		sequence: 1,
		isActive: true,
		names: { cs: "Bércový vřed" },
	},
	{
		id: "i2",
		codeListCode: "healing-phase",
		code: "granulating",
		sequence: 1,
		isActive: true,
		names: { cs: "Granulace" },
	},
]

function harness(store: Partial<ClinicalRecordStorePort> | undefined, isPatientRecorded = true) {
	const written: ResourceLink[] = []
	const removed: [string, readonly string[]][] = []
	const askedMoments: Date[] = []
	const actors = {
		departmentOf: async () => DEPARTMENT_ROW,
		departmentAt: async (_sql: never, _userId: string, moment: Date) => {
			askedMoments.push(moment)
			return AUTHOR_DEPARTMENT
		},
	} as unknown as ClinicalActorRepository
	const links = {
		resourceIdOf: async (_tx: never, link: Pick<ResourceLink, "resourceType" | "localKind" | "localId">) =>
			isPatientRecorded ? linkedResourceIdOf(link) : undefined,
		upsert: async (_tx: never, rows: readonly ResourceLink[]) => {
			written.push(...rows)
		},
		remove: async (_tx: never, kind: string, ids: readonly string[]) => {
			removed.push([kind, ids])
		},
	} as unknown as FhirResourceLinkRepository
	const codeLists = {
		items: async (_tx: never, codeListCode: string) => ITEMS.filter((item) => item.codeListCode === codeListCode),
	} as unknown as CodeListRepository
	const configuration = { instanceDefaultLanguage: async () => "cs" } as unknown as ConfigurationService
	const content = new ClinicalContentService(actors, links, codeLists, configuration)
	const service = new FindingRecordService(storesWith(store), content, links)
	return { service, written, removed, askedMoments }
}

describe("finding of a draft in the clinical record ADR-054 bod 3", () => {
	it("CAP-016-S15 records the finding with the plantar surface of the heel and links both resources", async () => {
		const sent: ClinicalDraftFinding[] = []
		const run = harness({
			recordDraftFinding: async (finding) => {
				sent.push(finding)
				return { condition: "c-1", bodyStructure: "b-1" }
			},
		})

		await run.service.recordDraft(TX, RECORD)

		expect(sent[0]).toEqual({
			findingId: FINDING,
			acquisitionId: DRAFT,
			patientResourceId: PATIENT_RESOURCE,
			department: DEPARTMENT_ROW,
			site: { ...RECORD.site, surface: "plantar" },
		})
		expect(run.written).toEqual([
			{ resourceType: "Condition", localKind: "finding", localId: FINDING, resourceId: "c-1" },
			{ resourceType: "BodyStructure", localKind: "finding-site", localId: `${FINDING}:1`, resourceId: "b-1" },
		])
	})

	it("ADR-050 (doplnění D33) bod 3 withdraws the finding and forgets its links", async () => {
		const withdrawn: (ClinicalDraftWoundType | undefined)[] = []
		const run = harness({
			withdrawDraftFinding: async (_finding, woundType) => {
				withdrawn.push(woundType)
			},
		})

		await run.service.withdrawDraft(TX, { ...RECORD, woundTypeCode: null })

		expect(withdrawn).toEqual([undefined])
		expect(run.removed).toEqual([
			["finding", [FINDING]],
			["finding-site", [`${FINDING}:1`]],
		])
	})

	it("ADR-050 bod 10 withdraws the wound type in the same write as its new finding", async () => {
		const withdrawn: (ClinicalDraftWoundType | undefined)[] = []
		const run = harness({
			withdrawDraftFinding: async (_finding, woundType) => {
				withdrawn.push(woundType)
			},
		})

		await run.service.withdrawDraft(TX, { ...RECORD, woundTypeCode: "leg-ulcer" })

		expect(withdrawn).toEqual([
			{
				findingId: FINDING,
				acquisitionId: DRAFT,
				patientResourceId: PATIENT_RESOURCE,
				conditionResourceId: CONDITION_RESOURCE,
				department: DEPARTMENT_ROW,
				woundTypeCode: "leg-ulcer",
				woundTypeName: "Bércový vřed",
			},
		])
		expect(run.removed).toContainEqual(["finding-wound-type", [FINDING]])
	})

	it("datovy-model.md 13.1 sends the wound type with its name in the default language of the instance", async () => {
		const sent: ClinicalDraftWoundType[] = []
		const run = harness({
			recordDraftWoundType: async (woundType) => {
				sent.push(woundType)
				return "o-1"
			},
		})

		await run.service.recordWoundType(TX, {
			findingId: FINDING,
			acquisitionId: DRAFT,
			patientId: PATIENT,
			departmentId: DEPARTMENT_ROW.id,
			woundTypeCode: "leg-ulcer",
		})

		expect(sent[0]?.woundTypeName).toBe("Bércový vřed")
		expect(run.written).toEqual([
			{ resourceType: "Observation", localKind: "finding-wound-type", localId: FINDING, resourceId: "o-1" },
		])
	})

	it("datovy-model.md 13.1 sends the healing phase with its name in the default language of the instance", async () => {
		const sent: ClinicalDraftAssessment[] = []
		const run = harness({
			recordDraftAssessment: async (assessment) => {
				sent.push(assessment)
				return "o-2"
			},
		})

		await run.service.recordAssessment(TX, ASSESSMENT)

		expect(sent[0]).toMatchObject({ healingPhaseCode: "granulating", healingPhaseName: "Granulace" })
	})

	it("CAP-017-S16 sends the note without a healing phase the instance switched off", async () => {
		const sent: ClinicalDraftAssessment[] = []
		const run = harness({
			recordDraftAssessment: async (assessment) => {
				sent.push(assessment)
				return "o-2"
			},
		})

		await run.service.recordAssessment(TX, { ...ASSESSMENT, healingPhaseCode: undefined, description: "Klidné okraje" })

		expect(sent[0]).toMatchObject({
			healingPhaseCode: undefined,
			healingPhaseName: undefined,
			description: "Klidné okraje",
		})
	})

	it("ADR-054 bod 5 answers documentation unavailable when the store does not answer", async () => {
		const run = harness({
			recordDraftFinding: async () => {
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

	it("refuses to write a finding whose patient the clinical record does not hold", async () => {
		const run = harness({ recordDraftFinding: async () => ({ condition: "c", bodyStructure: "b" }) }, false)

		const problem = await problemOf(run.service.recordDraft(TX, RECORD))

		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
	})
})

// CAP-020-R21, ADR-049 (doplnění D32), ADR-054 bod 3
describe("wound type change in the clinical record", () => {
	it("CAP-020-S25 sends the new type with its name and the author in the department of the moment of the change", async () => {
		const sent: ClinicalWoundTypeChange[] = []
		const run = harness({
			recordWoundTypeChange: async (change) => {
				sent.push(change)
				return "o-1"
			},
		})

		await run.service.recordWoundTypeChange(TX, CHANGE_RECORD)

		expect(sent).toEqual([
			{
				changeId: CHANGE,
				findingId: FINDING,
				patientId: PATIENT,
				patientResourceId: PATIENT_RESOURCE,
				conditionResourceId: CONDITION_RESOURCE,
				department: DEPARTMENT_ROW,
				woundTypeCode: "leg-ulcer",
				woundTypeName: "Bércový vřed",
				changedAt: "2026-10-22T09:15:00.000Z",
				author: { userId: USER, department: AUTHOR_DEPARTMENT },
			},
		])
		expect(run.askedMoments).toEqual([CHANGED_AT])
		expect(run.written).toEqual([
			{ resourceType: "Observation", localKind: "finding-wound-type", localId: FINDING, resourceId: "o-1" },
		])
	})

	it("ADR-054 bod 3 answers documentation unavailable when the store refuses the change", async () => {
		const run = harness({
			recordWoundTypeChange: async () => {
				throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "store down")
			},
		})

		const problem = await problemOf(run.service.recordWoundTypeChange(TX, CHANGE_RECORD))

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.written).toEqual([])
	})

	it("ADR-054 answers documentation unavailable without a configured store", async () => {
		const problem = await problemOf(harness(undefined).service.recordWoundTypeChange(TX, CHANGE_RECORD))

		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
	})
})
