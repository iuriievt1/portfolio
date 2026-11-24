import { ENCOUNTER_STATUS, ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, CONFIGURATION_KEY } from "@ansora/core-server"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { AcquisitionDraftRepository } from "../../acquisition/repositories/acquisition-draft.repository"
import type { AcquisitionFileRepository } from "../../acquisition/repositories/acquisition-file.repository"
import type { AcquisitionRow } from "../../acquisition/types/acquisition.types"
import type { FileCountRow } from "../../acquisition/types/acquisition-file.types"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { clinicalReadsFake, shownWound } from "../../clinical-record/__tests__/clinical-read-fixtures"
import type { ClinicalActorRepository } from "../../clinical-record/repositories/clinical-actor.repository"
import type { EncounterRecordService } from "../../clinical-record/services/encounter-record.service"
import { ViewerService } from "../../clinical-record/services/viewer.service"
import type { RecordVisibility } from "../../clinical-record/types/clinical-record.types"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { RecordReleaseService } from "../../image/services/record-release.service"
import type { PatientRepository } from "../../registry/repositories/patient.repository"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { EncounterRepository } from "../repositories/encounter.repository"
import type { RecordContentRepository } from "../repositories/record-content.repository"
import { EncounterService } from "../services/encounter.service"
import { EncounterRejectionService } from "../services/encounter-rejection.service"
import { EncounterViewService } from "../services/encounter-view.service"
import type { EncounterRow, RecordProgress } from "../types/encounter.types"
import {
	acquisitionRow,
	CURRENT,
	DEPARTMENT,
	DEVICE,
	ENCOUNTER,
	encounterRow,
	fakeDatabase,
	foundPatient,
	NOW,
	PATIENT,
	problemOf,
	TODAY,
	USER,
} from "./encounter-fixtures"

const PAGE_SIZE = { defaultSize: 50, maxSize: 100 }

interface Setup {
	encounter: EncounterRow | undefined
	acquisitions: AcquisitionRow[]
	listed: EncounterRow[]
	scheduledEnabled: boolean
	progress: ReadonlyMap<string, Partial<RecordProgress>>
	storeDown: boolean
}

// CAP-015-R30, CAP-020-R16
function isVisibleWith(row: AcquisitionRow, visibility: RecordVisibility): boolean {
	return row.state === ACQUISITION_STATE.DRAFT
		? row.operator_user_id === visibility.userId
		: visibility.closedAcquisitionIds.includes(row.id)
}

function harness(setup: Partial<Setup> = {}) {
	const state: Setup = {
		encounter: encounterRow(),
		acquisitions: [],
		listed: [],
		scheduledEnabled: false,
		progress: new Map(),
		storeDown: false,
		...setup,
	}
	const progressDevices: string[] = []
	const audits: NewAuditEvent[] = []
	const completed: string[] = []
	const recorded: EncounterRow[] = []
	const encounters = {
		findById: async () => state.encounter,
		lockById: async () => state.encounter,
		listOpenOnDay: async () => ({ rows: state.listed, nextCursor: null }),
		listAllDays: async () => ({ rows: state.listed, nextCursor: null }),
		listScheduled: async () => state.listed,
		complete: async (_tx: never, id: string, userId: string, now: Date) => {
			completed.push(id)
			return encounterRow({ id, status: ENCOUNTER_STATUS.COMPLETED, completed_at: now, completed_by: userId })
		},
	} as unknown as EncounterRepository
	const visibleIn = (encounterId: string, visibility: RecordVisibility) =>
		state.acquisitions.filter((row) => row.encounter_id === encounterId && isVisibleWith(row, visibility))
	const drafts = {
		listVisibleInEncounter: async (encounterId: string, visibility: RecordVisibility) => ({
			rows: visibleIn(encounterId, visibility),
			nextCursor: null,
		}),
		visibleCounts: async (_sql: never, ids: readonly string[], visibility: RecordVisibility) =>
			ids.map((id) => ({ encounter_id: id, count: visibleIn(id, visibility).length })),
		countClosedVisible: async (_sql: never, encounterId: string, closedAcquisitionIds: readonly string[]) =>
			state.acquisitions.filter(
				(row) =>
					row.encounter_id === encounterId &&
					row.state !== ACQUISITION_STATE.DRAFT &&
					closedAcquisitionIds.includes(row.id),
			).length,
		hasDraft: async (_sql: never, encounterId: string) =>
			state.acquisitions.some((row) => row.encounter_id === encounterId && row.state === ACQUISITION_STATE.DRAFT),
	} as unknown as AcquisitionDraftRepository
	const patients = {
		byIds: async (ids: readonly string[]) => ids.filter((id) => id === PATIENT).map((id) => foundPatient(id)),
	} as unknown as PatientRepository
	const actors = {
		actorOf: async () => ({
			userId: USER,
			displayName: "Test",
			department: { id: DEPARTMENT, code: "KOC" },
			roles: [],
		}),
	} as unknown as ClinicalActorRepository
	const records = {
		record: async (_tx: never, encounter: EncounterRow) => {
			recorded.push(encounter)
			return { patient: "p", encounter: "e" }
		},
	} as unknown as EncounterRecordService
	const configuration = {
		pageSize: async () => PAGE_SIZE,
		value: async (key: string) =>
			key === CONFIGURATION_KEY.SCHEDULED_ENCOUNTERS_ENABLED ? state.scheduledEnabled : undefined,
		integer: async () => 10,
		clinicalSteps: async () => ({ woundType: true, healingPhase: true }),
	} as unknown as ConfigurationService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	const progressOf = (id: string): Partial<RecordProgress> => state.progress.get(id) ?? {}
	const contents = {
		contentOf: async (_sql: never, ids: readonly string[]) =>
			ids.map((id) => ({
				acquisition_id: id,
				has_wound_type: progressOf(id).has_wound_type ?? false,
				has_healing_phase: progressOf(id).has_healing_phase ?? false,
				has_document_title: progressOf(id).has_document_title ?? false,
			})),
	} as unknown as RecordContentRepository
	const files = {
		countsOf: async (_sql: never, ids: readonly string[], deviceId: string): Promise<FileCountRow[]> => {
			progressDevices.push(deviceId)
			return ids.map((id) => {
				const received =
					progressOf(id).received_count ?? state.acquisitions.find((row) => row.id === id)?.file_count ?? 0
				const announced = progressOf(id).announced_count ?? 0
				const rejected = progressOf(id).rejected_count ?? 0
				return {
					acquisition_id: id,
					held: received + announced + rejected,
					received,
					announced,
					rejected,
					announced_elsewhere: progressOf(id).files_on_other_device === true ? announced : 0,
				}
			})
		},
	} as unknown as AcquisitionFileRepository
	const { reads } = clinicalReadsFake({
		wounds: state.acquisitions
			.filter((row) => row.state !== ACQUISITION_STATE.DRAFT && row.department_id === DEPARTMENT)
			.map((row) => shownWound(row.id)),
		unavailable: state.storeDown,
	})
	const database = fakeDatabase()
	const service = new EncounterService(
		database,
		encounters,
		drafts,
		new PatientLookupService(patients),
		new ViewerService(actors),
		records,
		configuration,
		audit,
		new EncounterRejectionService(database, audit),
		new EncounterViewService(database, drafts, reads),
		reads,
		contents,
		files,
		new RecordReleaseService(database, audit),
	)
	return { service, audits, completed, recorded, progressDevices }
}

const ownDraft = acquisitionRow({ id: "a0000000-0000-4000-8000-000000000001" })
const othersDraft = acquisitionRow({ id: "a0000000-0000-4000-8000-000000000002", operator_user_id: "other" })
const closedOfDepartment = acquisitionRow({
	id: "a0000000-0000-4000-8000-000000000003",
	state: ACQUISITION_STATE.RECEIVED,
	operator_user_id: "other",
	closed_at: NOW,
	file_count: 3,
})
const closedOfOtherDepartment = acquisitionRow({
	id: "a0000000-0000-4000-8000-000000000004",
	state: ACQUISITION_STATE.DELIVERED,
	department_id: "other-department",
	closed_at: NOW,
	file_count: 1,
})

describe("visits of a patient CAP-014-R19, CAP-014-R24", () => {
	it("CAP-014-S24 counts own drafts and closed records of the department, never a draft of another user", async () => {
		const run = harness({
			listed: [encounterRow()],
			acquisitions: [ownDraft, othersDraft, closedOfDepartment, closedOfOtherDepartment],
		})

		const page = await run.service.listForPatient(CURRENT, { patient_id: PATIENT, date: TODAY }, NOW)

		expect(page.items).toEqual([
			expect.objectContaining({
				encounter_id: ENCOUNTER,
				acquisition_count: 2,
				accepts_new_records: true,
				status: "in_progress",
			}),
		])
		expect(page.next_cursor).toBeNull()
	})

	it("CAP-014-S26 audits the release of visits, the patient as the subject even with none", async () => {
		const run = harness({ listed: [] })

		const page = await run.service.listForPatient(CURRENT, { patient_id: PATIENT }, NOW)

		expect(page.items).toEqual([])
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.PATIENT_SEARCH,
				outcome: AUDIT_OUTCOME.NO_MATCH,
				details: { search_method: "patient_encounters", patient_identifier: "nis-5555", released_item_count: 0 },
			}),
		])
	})

	it("refuses an unknown patient", async () => {
		const problem = await problemOf(
			harness().service.listForPatient(CURRENT, { patient_id: "00000000-0000-4000-8000-000000000000" }, NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(problem.code).toBe(ERROR_CODE.RESOURCE_NOT_FOUND)
	})

	it("CAP-014-S38 gives a visit of an earlier day no new records", async () => {
		const page = await harness({ listed: [encounterRow({ date: "2026-10-06" })] }).service.listForPatient(
			CURRENT,
			{ patient_id: PATIENT },
			NOW,
		)

		expect(page.items[0]?.accepts_new_records).toBe(false)
	})
})

describe("content of a visit CAP-014-R22", () => {
	it("CAP-014-S35 CAP-014-S36 releases own drafts and closed records of the department and audits the count", async () => {
		const run = harness({ acquisitions: [ownDraft, othersDraft, closedOfDepartment, closedOfOtherDepartment] })

		const page = await run.service.listContent(CURRENT, ENCOUNTER, {}, NOW)

		expect(page.items).toEqual([
			expect.objectContaining({ acquisition_id: ownDraft.id, state: "draft", missing_step: "images" }),
			expect.objectContaining({ acquisition_id: closedOfDepartment.id, state: "received", file_count: 3 }),
		])
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.PATIENT_RECORD_RELEASE,
				outcome: AUDIT_OUTCOME.RELEASED,
				objectId: ENCOUNTER,
				details: expect.objectContaining({
					release_kind: "encounter_content",
					encounter_id: ENCOUNTER,
					released_item_count: 2,
				}),
			}),
		])
	})

	it("CAP-014-R22 CAP-015-R35 shows the files the server holds and misses for the device of the request", async () => {
		const locatedDraft = acquisitionRow({ id: ownDraft.id, finding_id: "f0000000-0000-4000-8000-000000000001" })
		const run = harness({
			acquisitions: [locatedDraft, closedOfDepartment],
			progress: new Map([
				[locatedDraft.id, { received_count: 2, announced_count: 1, has_wound_type: true, has_healing_phase: true }],
				[closedOfDepartment.id, { received_count: 3 }],
			]),
		})

		const page = await run.service.listContent(CURRENT, ENCOUNTER, {}, NOW)

		expect(page.items).toEqual([
			expect.objectContaining({
				acquisition_id: locatedDraft.id,
				state: "draft",
				file_count: 2,
				missing_file_count: 1,
				missing_step: "files",
			}),
			expect.objectContaining({ acquisition_id: closedOfDepartment.id, state: "received", file_count: 3 }),
		])
		expect(run.progressDevices).toEqual([DEVICE])
	})

	it("CAP-014-R29 does not release a cancelled visit", async () => {
		const problem = await problemOf(
			harness({ encounter: encounterRow({ status: ENCOUNTER_STATUS.CANCELLED }) }).service.listContent(
				CURRENT,
				ENCOUNTER,
				{},
				NOW,
			),
		)

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})

	it("ADR-054 bod 5 CAP-025-R28 answers that the documentation is unavailable and audits a release of nothing", async () => {
		const run = harness({ acquisitions: [ownDraft, closedOfDepartment], storeDown: true })

		const content = await problemOf(run.service.listContent(CURRENT, ENCOUNTER, {}, NOW))
		const visits = await problemOf(run.service.listForPatient(CURRENT, { patient_id: PATIENT }, NOW))

		for (const problem of [content, visits]) {
			expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
			expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		}
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.PATIENT_RECORD_RELEASE,
				details: expect.objectContaining({ release_kind: "encounter_content", released_item_count: 0 }),
			}),
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.PATIENT_SEARCH,
				outcome: AUDIT_OUTCOME.NO_MATCH,
				details: expect.objectContaining({ search_method: "patient_encounters", released_item_count: 0 }),
			}),
		])
	})
})

describe("completion of a visit CAP-014-R20", () => {
	it("CAP-014-S28 CAP-025-S23 completes a visit with a closed record and records it", async () => {
		const run = harness({ acquisitions: [closedOfDepartment] })

		const view = await run.service.complete(CURRENT, ENCOUNTER, NOW)

		expect(view).toMatchObject({ status: "completed", completed_by: USER, acquisition_count: 1 })
		expect(run.completed).toEqual([ENCOUNTER])
		expect(run.recorded.map((encounter) => encounter.status)).toEqual(["completed"])
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.ENCOUNTER_COMPLETED,
				outcome: AUDIT_OUTCOME.COMPLETED,
				details: expect.objectContaining({
					encounter_completion: { previous_status: "in_progress", closed_record_count: 1 },
				}),
			}),
		])
	})

	it("CAP-014-S30 CAP-014-S34 refuses a visit with a draft and audits the refusal", async () => {
		const run = harness({ acquisitions: [closedOfDepartment, othersDraft] })

		const problem = await problemOf(run.service.complete(CURRENT, ENCOUNTER, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.ENCOUNTER_HAS_DRAFT)
		expect(run.completed).toEqual([])
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.ENCOUNTER_ACTION_REJECTED,
				details: expect.objectContaining({ encounter_action: "complete", reason: "encounter-has-draft" }),
			}),
		])
	})

	it("CAP-014-S31 refuses a visit without a closed record the user sees", async () => {
		const problem = await problemOf(
			harness({ acquisitions: [closedOfOtherDepartment] }).service.complete(CURRENT, ENCOUNTER, NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.ENCOUNTER_WITHOUT_CLOSED_RECORD)
	})

	it("CAP-014-R29 refuses a cancelled visit with its own code", async () => {
		const problem = await problemOf(
			harness({ encounter: encounterRow({ status: ENCOUNTER_STATUS.CANCELLED }) }).service.complete(
				CURRENT,
				ENCOUNTER,
				NOW,
			),
		)

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.ENCOUNTER_CANCELLED)
	})

	it("CAP-014-S50 answers a repeated completion with the same result and no second audit record", async () => {
		const done = encounterRow({ status: ENCOUNTER_STATUS.COMPLETED, completed_at: NOW, completed_by: USER })
		const run = harness({ encounter: done, acquisitions: [closedOfDepartment] })

		const view = await run.service.complete(CURRENT, ENCOUNTER, NOW)

		expect(view).toMatchObject({ status: "completed", completed_at: NOW.toISOString(), completed_by: USER })
		expect(run.completed).toEqual([])
		expect(run.audits).toEqual([])
	})
})

describe("scheduled visits of today CAP-014-R16", () => {
	it("CAP-014-S12 releases nothing while the section is off and audits an empty release", async () => {
		const run = harness({ listed: [encounterRow({ source: "worklist", status: ENCOUNTER_STATUS.PLANNED })] })

		const list = await run.service.listScheduled(CURRENT, { date: TODAY }, NOW)

		expect(list.items).toEqual([])
		expect(run.audits).toEqual([
			expect.objectContaining({
				outcome: AUDIT_OUTCOME.NO_MATCH,
				details: { search_method: "scheduled_list", released_item_count: 0 },
			}),
		])
	})

	it("releases the planned visits of the department with their patients", async () => {
		const planned = encounterRow({
			source: "worklist",
			status: ENCOUNTER_STATUS.PLANNED,
			scheduled_time: "09:30:00",
			started_at: null,
		})
		const run = harness({ scheduledEnabled: true, listed: [planned] })

		const list = await run.service.listScheduled(CURRENT, { date: TODAY }, NOW)

		expect(list.items).toEqual([
			{
				patient: expect.objectContaining({ patient_id: PATIENT }),
				encounter: expect.objectContaining({ scheduled_time: "2026-10-07T07:30:00.000Z", status: "planned" }),
			},
		])
		expect(run.audits[0]).toMatchObject({ outcome: AUDIT_OUTCOME.MATCH, details: { patient_identifier: "nis-5555" } })
	})
})
