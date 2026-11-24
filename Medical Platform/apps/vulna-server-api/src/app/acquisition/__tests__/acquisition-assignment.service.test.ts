import { ACQUISITION_KIND, ENCOUNTER_STATUS, ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { EncounterRecordService } from "../../clinical-record/services/encounter-record.service"
import type { ViewerService } from "../../clinical-record/services/viewer.service"
import {
	acquisitionRow,
	CURRENT,
	DEPARTMENT,
	ENCOUNTER,
	encounterRow,
	fakeDatabase,
	foundPatient,
	NOW,
	OTHER_PATIENT,
	OTHER_USER,
	PATIENT,
	problemOf,
	USER,
} from "../../encounter/__tests__/encounter-fixtures"
import type { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import { EncounterEmptyingService } from "../../encounter/services/encounter-emptying.service"
import { EncounterRejectionService } from "../../encounter/services/encounter-rejection.service"
import { EncounterTargetService } from "../../encounter/services/encounter-target.service"
import type { EncounterRow, NewEncounter } from "../../encounter/types/encounter.types"
import { encounterIdOfKey } from "../../encounter/utils/encounter-identity"
import type { DraftAssessmentService } from "../../finding/services/draft-assessment.service"
import type { FindingLocationService } from "../../finding/services/finding-location.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { PatientRepository } from "../../registry/repositories/patient.repository"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { AcquisitionAssignmentInput } from "../dto/acquisition-assignment.input.dto"
import type { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import { AcquisitionAssignmentService } from "../services/acquisition-assignment.service"
import type { AcquisitionDraftViewService } from "../services/acquisition-draft-view.service"
import type { ScanDocumentService } from "../services/scan-document.service"
import type { AcquisitionRow, Assignment } from "../types/acquisition.types"

const TARGET = "e0000000-0000-4000-8000-000000000001"
const TARGET_KEY = "e0000000-0000-4000-8000-0000000000ff"
const FINDING = "f0000000-0000-4000-8000-000000000001"
const VERSION = 3

interface Setup {
	draft: AcquisitionRow
	encounters: EncounterRow[]
	remaining: number
	findingsOfPatient: string[]
}

function harness(setup: Partial<Setup> = {}) {
	const state: Setup = {
		draft: acquisitionRow({ version: VERSION }),
		encounters: [encounterRow(), encounterRow({ id: TARGET, patient_id: OTHER_PATIENT })],
		remaining: 0,
		findingsOfPatient: [],
		...setup,
	}
	const audits: NewAuditEvent[] = []
	const moves: Assignment[] = []
	const started: string[] = []
	const created: NewEncounter[] = []
	const emptied: EncounterRow[] = []
	const recorded: EncounterRow[] = []
	const drafts = {
		findById: async () => state.draft,
		lockById: async () => state.draft,
		reassign: async (_tx: never, id: string, assignment: Assignment) => {
			moves.push(assignment)
			return acquisitionRow({
				id,
				patient_id: assignment.patientId,
				encounter_id: assignment.encounterId,
				finding_id: assignment.findingId,
				version: state.draft.version + 1,
			})
		},
		countInEncounter: async () => state.remaining,
	} as unknown as AcquisitionDraftRepository
	const encounters = {
		lockById: async (_tx: never, id: string) => state.encounters.find((encounter) => encounter.id === id),
		lockByIds: async (_tx: never, ids: readonly string[]) =>
			state.encounters.filter((encounter) => ids.includes(encounter.id)),
		lockByKey: async (_tx: never, key: string) => state.encounters.find((encounter) => encounter.encounter_key === key),
		start: async (_tx: never, id: string) => {
			started.push(id)
			return encounterRow({ id, patient_id: OTHER_PATIENT, status: ENCOUNTER_STATUS.IN_PROGRESS })
		},
		insertCreatedInApp: async (_tx: never, encounter: NewEncounter) => {
			created.push(encounter)
			return encounterRow({ id: encounter.id, patient_id: encounter.patientId, encounter_key: encounter.encounterKey })
		},
		empty: async (_tx: never, id: string, status: EncounterRow["status"]) => {
			const row = encounterRow({ id, status, started_at: null })
			emptied.push(row)
			return row
		},
	} as unknown as EncounterRepository
	const patients = {
		byIds: async (ids: readonly string[]) => ids.map((id) => foundPatient(id)),
	} as unknown as PatientRepository
	const records = {
		record: async (_tx: never, encounter: EncounterRow) => {
			recorded.push(encounter)
			return { patient: "p", encounter: "e" }
		},
	} as unknown as EncounterRecordService
	const viewers = {
		viewerOf: async () => ({ userId: USER, departmentId: DEPARTMENT }),
	} as unknown as ViewerService
	const views = {
		viewOf: async (_sql: never, row: AcquisitionRow) => ({
			acquisition_id: row.id,
			patient_id: row.patient_id,
			encounter_id: row.encounter_id,
			version: row.version,
		}),
	} as unknown as AcquisitionDraftViewService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	const followed: (string | null)[] = []
	const findingSteps: string[] = []
	const documentSteps: string[] = []
	const scanDocuments = {
		withdraw: async (_tx: never, draft: AcquisitionRow) => {
			documentSteps.push(`withdraw from ${draft.encounter_id}`)
		},
		refound: async (_tx: never, moved: AcquisitionRow) => {
			documentSteps.push(`found in ${moved.encounter_id} after ${recorded.map((encounter) => encounter.id).join(",")}`)
		},
	} as unknown as ScanDocumentService
	const trackedLookups: { findingId: string; patientId: string; departmentId: string | null }[] = []
	const locations = {
		followAssignment: async (_tx: never, _before: AcquisitionRow, findingId: string | null) => {
			followed.push(findingId)
			findingSteps.push(`follow location:${findingId}`)
		},
		trackedFinding: async (_tx: never, findingId: string, patientId: string, departmentId: string | null) => {
			trackedLookups.push({ findingId, patientId, departmentId })
			if (!state.findingsOfPatient.includes(findingId)) {
				throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.PATIENT_MISMATCH)
			}
			return { id: findingId }
		},
	} as unknown as FindingLocationService
	const assessments = {
		withdraw: async (_tx: never, draft: AcquisitionRow) => {
			findingSteps.push(`withdraw assessment:${draft.patient_id}`)
		},
		followFinding: async (_tx: never, draft: AcquisitionRow, findingId: string | null) => {
			findingSteps.push(`follow assessment:${draft.patient_id}:${findingId}`)
		},
	} as unknown as DraftAssessmentService
	const database = fakeDatabase()
	const service = new AcquisitionAssignmentService(
		database,
		drafts,
		encounters,
		new EncounterTargetService(encounters),
		new EncounterEmptyingService(encounters, drafts, audit),
		new EncounterRejectionService(database, audit),
		records,
		views,
		viewers,
		new PatientLookupService(patients),
		audit,
		locations,
		assessments,
		scanDocuments,
	)
	return {
		service,
		audits,
		moves,
		started,
		created,
		emptied,
		recorded,
		followed,
		findingSteps,
		documentSteps,
		trackedLookups,
	}
}

function toTarget(overrides: Partial<AcquisitionAssignmentInput> = {}): AcquisitionAssignmentInput {
	return { patient_id: OTHER_PATIENT, encounter_id: TARGET, finding_id: null, ...overrides }
}

describe("record moved to another patient or visit CAP-014-R07", () => {
	it("CAP-014-S04 CAP-014-S52 moves the own draft, audits both patients and cancels the emptied visit", async () => {
		const run = harness()

		const moved = await run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget(), NOW)

		expect(moved).toMatchObject({ patient_id: OTHER_PATIENT, encounter_id: TARGET, version: VERSION + 1 })
		expect(run.moves).toEqual([{ patientId: OTHER_PATIENT, encounterId: TARGET, findingId: null }])
		expect(run.followed).toEqual([null])
		expect(run.audits.map((event) => event.eventType)).toEqual([
			AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_ASSIGNMENT_CHANGED,
			AUDIT_EVENT_TYPE.ENCOUNTER_EMPTIED,
		])
		expect(run.audits[0]?.details).toMatchObject({
			encounter_id: TARGET,
			operator_user_id: USER,
			assignment_change: {
				previous_patient_identifier: foundPatient(PATIENT).identifiers[0]?.value,
				new_patient_identifier: foundPatient(OTHER_PATIENT).identifiers[0]?.value,
				previous_encounter_id: ENCOUNTER,
				new_encounter_id: TARGET,
			},
		})
		expect(run.audits[1]?.details).toMatchObject({
			encounter_emptying: { previous_status: "in_progress", new_status: "cancelled", emptied_by: "assignment_change" },
		})
		expect(run.recorded.map((encounter) => [encounter.id, encounter.status])).toEqual([
			[TARGET, ENCOUNTER_STATUS.IN_PROGRESS],
			[ENCOUNTER, ENCOUNTER_STATUS.CANCELLED],
		])
	})

	it("CAP-014-R25 ADR-050 (doplnění D33) bod 3 takes the document out of the old visit and founds it in the new one", async () => {
		const run = harness()

		await run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget(), NOW)

		expect(run.documentSteps).toEqual([`withdraw from ${ENCOUNTER}`, `found in ${TARGET} after ${TARGET},${ENCOUNTER}`])
	})

	it("CAP-014-R29 returns a worklist visit left without records to planned", async () => {
		const run = harness({
			encounters: [encounterRow({ source: "worklist" }), encounterRow({ id: TARGET, patient_id: OTHER_PATIENT })],
		})

		await run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget(), NOW)

		expect(run.emptied.map((encounter) => encounter.status)).toEqual([ENCOUNTER_STATUS.PLANNED])
	})

	it("CAP-014-R29 keeps the visit that still has another record", async () => {
		const run = harness({ remaining: 1 })

		await run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget(), NOW)

		expect(run.emptied).toEqual([])
		expect(run.recorded.map((encounter) => encounter.id)).toEqual([TARGET])
	})

	it("CAP-014-R18 starts a planned target visit with the moved record", async () => {
		const run = harness({
			encounters: [
				encounterRow(),
				encounterRow({ id: TARGET, patient_id: OTHER_PATIENT, status: ENCOUNTER_STATUS.PLANNED, source: "worklist" }),
			],
		})

		await run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget(), NOW)

		expect(run.started).toEqual([TARGET])
	})

	it("CAP-014-R06 creates the new visit of the target patient with the department of the record", async () => {
		const run = harness()

		const moved = await run.service.assign(
			CURRENT,
			acquisitionRow().id,
			VERSION,
			toTarget({ encounter_id: undefined, encounter_key: TARGET_KEY }),
			NOW,
		)

		expect(run.created).toEqual([
			expect.objectContaining({
				id: encounterIdOfKey(TARGET_KEY),
				patientId: OTHER_PATIENT,
				encounterKey: TARGET_KEY,
				departmentId: DEPARTMENT,
				date: "2026-10-07",
			}),
		])
		expect(moved).toMatchObject({ encounter_id: encounterIdOfKey(TARGET_KEY) })
	})

	it("CAP-021-R29 repeats a finished move without changing or auditing anything", async () => {
		const run = harness({ draft: acquisitionRow({ patient_id: OTHER_PATIENT, encounter_id: TARGET, version: 4 }) })

		const moved = await run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget(), NOW)

		expect(moved).toMatchObject({ encounter_id: TARGET, version: 4 })
		expect(run.moves).toEqual([])
		expect(run.audits).toEqual([])
	})

	it("CAP-014-S46 keeps the own finding only when the patient stays", async () => {
		const own = acquisitionRow({ version: VERSION, finding_id: FINDING })
		const run = harness({
			draft: own,
			encounters: [encounterRow(), encounterRow({ id: TARGET })],
		})

		await run.service.assign(CURRENT, own.id, VERSION, toTarget({ patient_id: PATIENT, finding_id: FINDING }), NOW)

		expect(run.moves).toEqual([{ patientId: PATIENT, encounterId: TARGET, findingId: FINDING }])
	})

	it("CAP-014-R26 withdraws the assessment of a record that leaves its finding behind", async () => {
		const run = harness()

		await run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget(), NOW)

		expect(run.findingSteps).toEqual([
			`withdraw assessment:${PATIENT}`,
			"follow location:null",
			`follow assessment:${OTHER_PATIENT}:null`,
		])
	})

	it("CAP-014-S46 keeps the assessment on the finding the record moves with", async () => {
		const own = acquisitionRow({ version: VERSION, finding_id: FINDING })
		const run = harness({ draft: own, encounters: [encounterRow(), encounterRow({ id: TARGET })] })

		await run.service.assign(CURRENT, own.id, VERSION, toTarget({ patient_id: PATIENT, finding_id: FINDING }), NOW)

		expect(run.findingSteps).toEqual([`follow location:${FINDING}`, `follow assessment:${PATIENT}:${FINDING}`])
		expect(run.trackedLookups).toEqual([])
	})
})

describe("refused move CAP-014-R26", () => {
	it("CAP-014-S43 refuses a visit of another patient and moves nothing", async () => {
		const run = harness({ encounters: [encounterRow(), encounterRow({ id: TARGET, patient_id: PATIENT })] })

		const problem = await problemOf(run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.PATIENT_MISMATCH)
		expect(run.moves).toEqual([])
		expect(run.audits).toEqual([])
	})

	it("CAP-014-S44 refuses a finding of another patient", async () => {
		const run = harness()

		const problem = await problemOf(
			run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget({ finding_id: FINDING }), NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.PATIENT_MISMATCH)
		expect(run.moves).toEqual([])
		expect(run.findingSteps).toEqual([])
	})

	it("accepts a finding with a closed record of the target patient", async () => {
		const run = harness({ findingsOfPatient: [FINDING] })

		await run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget({ finding_id: FINDING }), NOW)

		expect(run.moves).toEqual([{ patientId: OTHER_PATIENT, encounterId: TARGET, findingId: FINDING }])
	})

	it("CAP-020-R04 looks the finding up for the target patient in the department of the record", async () => {
		const run = harness({ findingsOfPatient: [FINDING] })

		await run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget({ finding_id: FINDING }), NOW)

		expect(run.trackedLookups).toEqual([{ findingId: FINDING, patientId: OTHER_PATIENT, departmentId: DEPARTMENT }])
	})

	it("refuses a finding on a document", async () => {
		const run = harness({ draft: acquisitionRow({ version: VERSION, kind: ACQUISITION_KIND.SCAN }) })

		const problem = await problemOf(
			run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget({ finding_id: FINDING }), NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.BAD_REQUEST)
	})

	it("CAP-014-S45 refuses a new visit key the server keeps for another patient", async () => {
		const run = harness({
			encounters: [encounterRow(), encounterRow({ id: TARGET, patient_id: PATIENT, encounter_key: TARGET_KEY })],
		})

		const problem = await problemOf(
			run.service.assign(
				CURRENT,
				acquisitionRow().id,
				VERSION,
				toTarget({ encounter_id: undefined, encounter_key: TARGET_KEY }),
				NOW,
			),
		)

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.IDEMPOTENCY_CONFLICT)
	})

	it("CAP-014-S32 refuses a completed target visit and audits the refusal", async () => {
		const run = harness({
			encounters: [
				encounterRow(),
				encounterRow({ id: TARGET, patient_id: OTHER_PATIENT, status: ENCOUNTER_STATUS.COMPLETED }),
			],
		})

		const problem = await problemOf(run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget(), NOW))

		expect(problem.code).toBe(ERROR_CODE.ENCOUNTER_COMPLETED)
		expect(run.moves).toEqual([])
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.ENCOUNTER_ACTION_REJECTED,
				outcome: AUDIT_OUTCOME.REJECTED,
				objectId: TARGET,
				details: expect.objectContaining({ encounter_action: "assign", reason: ERROR_CODE.ENCOUNTER_COMPLETED }),
			}),
		])
	})

	it("CAP-014-R30 refuses a target visit of an earlier day", async () => {
		const run = harness({
			encounters: [encounterRow(), encounterRow({ id: TARGET, patient_id: OTHER_PATIENT, date: "2026-10-06" })],
		})

		const problem = await problemOf(run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget(), NOW))

		expect(problem.code).toBe(ERROR_CODE.ENCOUNTER_NOT_TODAY)
	})

	it("CAP-021-R32 refuses a move over another version", async () => {
		const run = harness()

		const problem = await problemOf(run.service.assign(CURRENT, acquisitionRow().id, VERSION - 1, toTarget(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_VERSION_CONFLICT)
		expect(run.moves).toEqual([])
	})

	it("CAP-014-S05 refuses a closed record", async () => {
		const run = harness({
			draft: acquisitionRow({ state: ACQUISITION_STATE.RECEIVED, closed_at: NOW, file_count: 2, version: VERSION }),
		})

		const problem = await problemOf(run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget(), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_CLOSED)
	})

	it("CAP-014-S42 answers a draft of another author as missing", async () => {
		const run = harness({ draft: acquisitionRow({ operator_user_id: OTHER_USER, version: VERSION }) })

		const problem = await problemOf(run.service.assign(CURRENT, acquisitionRow().id, VERSION, toTarget(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})
})
