import { ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { clinicalReadsFake, shownWound } from "../../clinical-record/__tests__/clinical-read-fixtures"
import type { FindingRecordService } from "../../clinical-record/services/finding-record.service"
import type { WoundTypeChangeRecord } from "../../clinical-record/types/clinical-record.types"
import type { CodeListChoiceService } from "../../code-list/services/code-list-choice.service"
import {
	CURRENT,
	DEPARTMENT,
	fakeDatabase,
	foundPatient,
	NOW,
	PATIENT,
	problemOf,
	USER,
} from "../../encounter/__tests__/encounter-fixtures"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { PatientRepository } from "../../registry/repositories/patient.repository"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { FindingRepository } from "../repositories/finding.repository"
import type { WoundTypeChangeRepository } from "../repositories/wound-type-change.repository"
import { FindingWoundTypeChangeService } from "../services/finding-wound-type-change.service"
import type { FindingRow, WoundTypeChoice } from "../types/finding.types"
import type { NewWoundTypeChange } from "../types/finding-history.types"
import {
	FINDING_ID,
	findingRow,
	NEXT_SET_VERSION,
	RECORD_ID,
	SET_VERSION,
	storedFinding,
	trackedRow,
} from "./finding-fixtures"

const REQUEST = {
	wound_type_code: "leg-ulcer",
	code_list_version: String(NEXT_SET_VERSION),
	previous_wound_type_code: "traumatic-wound",
}

interface Setup {
	finding: FindingRow | undefined
	isShownByStore: boolean
	offered: boolean
	isStoreUnavailable: boolean
	isReadUnavailable: boolean
}

function harness(setup: Partial<Setup> = {}) {
	const state: Setup = {
		finding: findingRow({ wound_type_code: "traumatic-wound", wound_type_code_list_version: SET_VERSION }),
		isShownByStore: true,
		offered: true,
		isStoreUnavailable: false,
		isReadUnavailable: false,
		...setup,
	}
	const steps: string[] = []
	const trackedFor: string[][] = []
	const set: WoundTypeChoice[] = []
	const inserted: NewWoundTypeChange[] = []
	const recorded: WoundTypeChangeRecord[] = []
	const audits: NewAuditEvent[] = []
	const findings = {
		findById: async () => state.finding,
		lockById: async () => state.finding,
		setWoundType: async (_tx: never, _id: string, choice: WoundTypeChoice) => {
			steps.push("finding")
			set.push(choice)
		},
		trackedById: async (_id: string, visibleAcquisitionIds: readonly string[]) => {
			trackedFor.push([...visibleAcquisitionIds])
			return trackedRow({ wound_type_code: set.at(-1)?.code ?? state.finding?.wound_type_code })
		},
	} as unknown as FindingRepository
	const { reads } = clinicalReadsFake({
		findings: state.isShownByStore
			? [storedFinding({ woundTypeCode: state.finding?.wound_type_code ?? undefined })]
			: [],
		wounds: state.isShownByStore ? [{ ...shownWound(RECORD_ID), findingId: FINDING_ID }] : [],
		unavailable: state.isReadUnavailable,
	})
	const changes = {
		insert: async (_tx: never, change: NewWoundTypeChange) => {
			steps.push("change")
			inserted.push(change)
		},
	} as unknown as WoundTypeChangeRepository
	const records = {
		recordWoundTypeChange: async (_tx: never, record: WoundTypeChangeRecord) => {
			if (state.isStoreUnavailable) {
				throw new ProblemException(HttpStatus.SERVICE_UNAVAILABLE, ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
			}
			steps.push("clinical record")
			recorded.push(record)
		},
	} as unknown as FindingRecordService
	const choices = {
		choose: async () => {
			if (!state.offered) {
				throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.RECORD_REJECTED)
			}
			return NEXT_SET_VERSION
		},
	} as unknown as CodeListChoiceService
	const patients = {
		byIds: async (ids: readonly string[]) => ids.filter((id) => id === PATIENT).map((id) => foundPatient(id)),
	} as unknown as PatientRepository
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			steps.push("audit")
			audits.push(event)
		},
	} as unknown as AuditRepository
	const service = new FindingWoundTypeChangeService(
		fakeDatabase(),
		findings,
		reads,
		changes,
		records,
		choices,
		new PatientLookupService(patients),
		audit,
	)
	return { service, steps, set, inserted, recorded, audits, trackedFor }
}

describe("change of the wound type of a finding CAP-020-R21", () => {
	it("CAP-020-S25 changes the type for later records, keeps the change and audits it", async () => {
		const run = harness()

		const finding = await run.service.change(CURRENT, FINDING_ID, REQUEST, NOW)

		expect(finding.wound_type_code).toBe("leg-ulcer")
		expect(run.set).toEqual([{ code: "leg-ulcer", codeListVersion: NEXT_SET_VERSION, setBy: USER }])
		expect(run.inserted).toEqual([
			{
				id: expect.any(String),
				findingId: FINDING_ID,
				changedAt: NOW,
				changedBy: USER,
				previousCode: "traumatic-wound",
				previousCodeListVersion: SET_VERSION,
				code: "leg-ulcer",
				codeListVersion: NEXT_SET_VERSION,
			},
		])
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.FINDING_WOUND_TYPE_CHANGED,
				objectId: FINDING_ID,
				outcome: AUDIT_OUTCOME.SUCCESS,
				actorUserId: USER,
				details: expect.objectContaining({
					wound_type_change: {
						finding_id: FINDING_ID,
						previous_wound_type_code: "traumatic-wound",
						wound_type_code: "leg-ulcer",
						code_list_version: String(NEXT_SET_VERSION),
					},
				}),
			}),
		])
	})

	it("CAP-020-R21 ADR-054 bod 3 writes the change into the clinical record in the same transaction, before the audit", async () => {
		const run = harness()

		await run.service.change(CURRENT, FINDING_ID, REQUEST, NOW)

		expect(run.recorded).toEqual([
			{
				changeId: run.inserted[0]?.id,
				findingId: FINDING_ID,
				patientId: PATIENT,
				departmentId: DEPARTMENT,
				woundTypeCode: "leg-ulcer",
				changedAt: NOW,
				changedBy: USER,
			},
		])
		expect(run.steps).toEqual(["finding", "change", "clinical record", "audit"])
	})

	it("ADR-054 bod 3 refuses the change as documentation unavailable and audits nothing", async () => {
		const run = harness({ isStoreUnavailable: true })

		const problem = await problemOf(run.service.change(CURRENT, FINDING_ID, REQUEST, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.recorded).toEqual([])
		expect(run.audits).toEqual([])
	})

	it("CAP-021-R29 answers a change to the type the finding already carries without a second audit record", async () => {
		const run = harness({ finding: findingRow() })

		const finding = await run.service.change(CURRENT, FINDING_ID, REQUEST, NOW)

		expect(finding.wound_type_code).toBe("leg-ulcer")
		expect(run.set).toEqual([])
		expect(run.inserted).toEqual([])
		expect(run.recorded).toEqual([])
		expect(run.audits).toEqual([])
	})

	it("CAP-020-R21 refuses a change made against a type that changed in the meantime", async () => {
		const run = harness({ finding: findingRow({ wound_type_code: "burn" }) })

		const problem = await problemOf(run.service.change(CURRENT, FINDING_ID, REQUEST, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.FINDING_WOUND_TYPE_CONFLICT)
		expect(run.set).toEqual([])
		expect(run.recorded).toEqual([])
		expect(run.audits).toEqual([])
	})

	it("CAP-017-R08 refuses a type the code list does not offer", async () => {
		const run = harness({ offered: false })

		const problem = await problemOf(run.service.change(CURRENT, FINDING_ID, REQUEST, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(run.inserted).toEqual([])
	})

	it("CAP-020-R16 answers a finding the store does not show as not found and changes nothing", async () => {
		const run = harness({ isShownByStore: false })

		const problem = await problemOf(run.service.change(CURRENT, FINDING_ID, REQUEST, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(problem.code).toBe(ERROR_CODE.RESOURCE_NOT_FOUND)
		expect(run.set).toEqual([])
		expect(run.recorded).toEqual([])
		expect(run.audits).toEqual([])
	})

	it("CAP-020-S10 refuses the change while the store cannot tell what the user may see", async () => {
		const run = harness({ isReadUnavailable: true })

		const problem = await problemOf(run.service.change(CURRENT, FINDING_ID, REQUEST, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.set).toEqual([])
		expect(run.audits).toEqual([])
	})

	it("ADR-054 bod 2 answers the changed finding from the records the store shows", async () => {
		const run = harness()

		const finding = await run.service.change(CURRENT, FINDING_ID, REQUEST, NOW)

		expect(finding.wound_type_code).toBe("leg-ulcer")
		expect(run.trackedFor).toEqual([[RECORD_ID]])
	})
})
