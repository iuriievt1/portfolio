import { ACQUISITION_KIND, ENCOUNTER_STATUS, ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import { encountersOfId, seriesFake } from "../../acquisition/__tests__/scan-document-fakes"
import type { AcquisitionDraftRepository } from "../../acquisition/repositories/acquisition-draft.repository"
import type { AcquisitionFileRepository } from "../../acquisition/repositories/acquisition-file.repository"
import type { DecidedAcquisitionRepository } from "../../acquisition/repositories/decided-acquisition.repository"
import type { DocumentRepository } from "../../acquisition/repositories/document.repository"
import { ScanDocumentService } from "../../acquisition/services/scan-document.service"
import type { AcquisitionRow, DecisionReason } from "../../acquisition/types/acquisition.types"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import type { DocumentRecordService } from "../../clinical-record/services/document-record.service"
import type { EncounterRecordService } from "../../clinical-record/services/encounter-record.service"
import type { DraftDocumentRecord } from "../../clinical-record/types/clinical-record.types"
import type { DraftAssessmentService } from "../../finding/services/draft-assessment.service"
import type { FindingLocationService } from "../../finding/services/finding-location.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { PatientRepository } from "../../registry/repositories/patient.repository"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { EncounterRepository } from "../repositories/encounter.repository"
import { EncounterCancellationService } from "../services/encounter-cancellation.service"
import { EncounterEmptyingService } from "../services/encounter-emptying.service"
import { EncounterRejectionService } from "../services/encounter-rejection.service"
import type { EncounterRow } from "../types/encounter.types"
import {
	acquisitionRow,
	CURRENT,
	ENCOUNTER,
	encounterRow,
	fakeDatabase,
	foundPatient,
	NOW,
	OTHER_USER,
	problemOf,
} from "./encounter-fixtures"

interface Setup {
	encounter: EncounterRow
	acquisitions: AcquisitionRow[]
	storeFailure: ProblemException | undefined
}

const ownDraft = acquisitionRow({ id: "a0000000-0000-4000-8000-000000000001" })
const othersDraft = acquisitionRow({
	id: "a0000000-0000-4000-8000-000000000002",
	idempotency_key: "b0000000-0000-4000-8000-000000000002",
	operator_user_id: OTHER_USER,
})
const closedRecord = acquisitionRow({
	id: "a0000000-0000-4000-8000-000000000003",
	state: ACQUISITION_STATE.RECEIVED,
	closed_at: NOW,
	file_count: 1,
	department_id: "other-department",
})
const scanDraft = acquisitionRow({
	id: "a0000000-0000-4000-8000-000000000004",
	idempotency_key: "b0000000-0000-4000-8000-000000000004",
	kind: ACQUISITION_KIND.SCAN,
})

function harness(setup: Partial<Setup> = {}) {
	const state: Setup = {
		encounter: encounterRow(),
		acquisitions: [ownDraft, othersDraft],
		storeFailure: undefined,
		...setup,
	}
	const audits: NewAuditEvent[] = []
	const decided: { ids: string[]; reason: DecisionReason }[] = []
	const recorded: EncounterRow[] = []
	const steps: string[] = []
	const drafts = {
		hasClosed: async () => state.acquisitions.some((row) => row.state !== ACQUISITION_STATE.DRAFT),
		lockDraftsInEncounter: async () => state.acquisitions.filter((row) => row.state === ACQUISITION_STATE.DRAFT),
		deleteDrafts: async (_tx: never, ids: readonly string[]) => {
			state.acquisitions = state.acquisitions.filter((row) => !ids.includes(row.id))
		},
		countInEncounter: async () => state.acquisitions.length,
	} as unknown as AcquisitionDraftRepository
	const decisions = {
		record: async (_tx: never, rows: readonly AcquisitionRow[], reason: DecisionReason) => {
			decided.push({ ids: rows.map((row) => row.id), reason })
		},
	} as unknown as DecidedAcquisitionRepository
	const encounters = {
		findById: async () => state.encounter,
		lockById: async () => state.encounter,
		empty: async (_tx: never, id: string, status: EncounterRow["status"]) =>
			encounterRow({ id, source: state.encounter.source, status, started_at: null }),
	} as unknown as EncounterRepository
	const patients = {
		byIds: async (ids: readonly string[]) => ids.map((id) => foundPatient(id)),
	} as unknown as PatientRepository
	const records = {
		record: async (_tx: never, encounter: EncounterRow) => {
			if (state.storeFailure !== undefined) {
				throw state.storeFailure
			}
			recorded.push(encounter)
			steps.push("store")
			return { patient: "p", encounter: "e" }
		},
	} as unknown as EncounterRecordService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audits.push(event)
			steps.push("audit")
		},
	} as unknown as AuditRepository
	const withdrawn: string[] = []
	const locations = {
		withdrawNew: async (_tx: never, draft: AcquisitionRow) => {
			withdrawn.push(draft.id)
			steps.push("withdraw")
		},
	} as unknown as FindingLocationService
	const withdrawnAssessments: string[] = []
	const assessments = {
		withdraw: async (_tx: never, draft: AcquisitionRow) => {
			withdrawnAssessments.push(draft.id)
		},
	} as unknown as DraftAssessmentService
	const documents = {
		findByAcquisition: async (_tx: never, acquisitionId: string) => ({
			id: `${acquisitionId}-document`,
			acquisition_id: acquisitionId,
		}),
	} as unknown as DocumentRepository
	const withdrawnDocuments: DraftDocumentRecord[] = []
	const documentRecords = {
		withdrawDraft: async (_tx: never, record: DraftDocumentRecord) => {
			withdrawnDocuments.push(record)
		},
	} as unknown as DocumentRecordService
	const removedObjects: string[] = []
	const discardedBytes: string[] = []
	const files = {
		binaryObjectIdsOf: async (_tx: never, acquisitionId: string) => [
			`${acquisitionId}-image`,
			`${acquisitionId}-thumbnail`,
		],
	} as unknown as AcquisitionFileRepository
	const binaries = {
		removeAll: async (_tx: never, ids: readonly string[]) => {
			removedObjects.push(...ids)
		},
		discardBytes: async (ids: readonly string[]) => {
			discardedBytes.push(...ids)
		},
	} as unknown as BinaryObjectService
	const database = fakeDatabase()
	const service = new EncounterCancellationService(
		database,
		encounters,
		drafts,
		decisions,
		new EncounterEmptyingService(encounters, drafts, audit),
		records,
		new PatientLookupService(patients),
		new EncounterRejectionService(database, audit),
		audit,
		locations,
		assessments,
		new ScanDocumentService(documents, seriesFake().repository, encountersOfId(), documentRecords),
		files,
		binaries,
	)
	return {
		service,
		removedObjects,
		discardedBytes,
		audits,
		decided,
		recorded,
		steps,
		withdrawn,
		withdrawnAssessments,
		withdrawnDocuments,
		remaining: () => state.acquisitions,
	}
}

describe("visit cancelled by the clinician Q-150", () => {
	it("CAP-014-R29 discards every draft, cancels the visit created in the app and records it", async () => {
		const run = harness()

		await run.service.cancel(CURRENT, ENCOUNTER, NOW)

		expect(run.remaining()).toEqual([])
		expect(run.decided).toEqual([{ ids: [ownDraft.id, othersDraft.id], reason: "discarded" }])
		expect(run.audits.map((event) => [event.eventType, event.objectId])).toEqual([
			[AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_DISCARD, ownDraft.id],
			[AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_DISCARD, othersDraft.id],
			[AUDIT_EVENT_TYPE.ENCOUNTER_EMPTIED, ENCOUNTER],
		])
		expect(run.audits[1]?.details).toMatchObject({ operator_user_id: OTHER_USER })
		expect(run.audits[2]?.details).toMatchObject({
			encounter_emptying: {
				previous_status: "in_progress",
				new_status: "cancelled",
				emptied_by: "encounter_cancellation",
			},
		})
		expect(run.recorded.map((encounter) => encounter.status)).toEqual([ENCOUNTER_STATUS.CANCELLED])
	})

	it("CAP-026-R17 deletes the files of every discarded draft, the bytes only after the commit", async () => {
		const run = harness()

		await run.service.cancel(CURRENT, ENCOUNTER, NOW)

		const expected = [ownDraft, othersDraft].flatMap((draft) => [`${draft.id}-image`, `${draft.id}-thumbnail`])
		expect(run.removedObjects).toEqual(expected)
		expect(run.discardedBytes).toEqual(expected)
	})

	it("ADR-054 bod 5 writes the store before the audit, so the audit chain lock waits for no network call", async () => {
		const run = harness()

		await run.service.cancel(CURRENT, ENCOUNTER, NOW)

		expect(run.steps).toEqual(["withdraw", "withdraw", "store", "audit", "audit", "audit"])
	})

	it("ADR-050 (doplnění D33) bod 3 withdraws the new finding of every discarded draft from the store", async () => {
		const run = harness()

		await run.service.cancel(CURRENT, ENCOUNTER, NOW)

		expect(run.withdrawn).toEqual([ownDraft.id, othersDraft.id])
		expect(run.withdrawnAssessments).toEqual([ownDraft.id, othersDraft.id])
	})

	it("CAP-021-R39 withdraws the scanned document of every discarded scan from the store", async () => {
		const run = harness({ acquisitions: [ownDraft, scanDraft] })

		await run.service.cancel(CURRENT, ENCOUNTER, NOW)

		expect(run.withdrawnDocuments).toEqual([
			{ documentId: `${scanDraft.id}-document`, acquisitionId: scanDraft.id, departmentId: scanDraft.department_id },
		])
	})

	it("CAP-014-R29 returns a worklist visit to planned", async () => {
		const run = harness({ encounter: encounterRow({ source: "worklist", encounter_key: null }) })

		await run.service.cancel(CURRENT, ENCOUNTER, NOW)

		expect(run.recorded).toEqual([expect.objectContaining({ status: ENCOUNTER_STATUS.PLANNED, started_at: null })])
	})

	it("CAP-014-R30 cancels a visit of an earlier day without a closed record", async () => {
		const run = harness({ encounter: encounterRow({ date: "2026-10-06" }) })

		await run.service.cancel(CURRENT, ENCOUNTER, NOW)

		expect(run.recorded.map((encounter) => encounter.status)).toEqual([ENCOUNTER_STATUS.CANCELLED])
	})

	it("refuses a visit with a closed record, even of another department, and audits the refusal", async () => {
		const run = harness({ acquisitions: [ownDraft, closedRecord] })

		const problem = await problemOf(run.service.cancel(CURRENT, ENCOUNTER, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.ENCOUNTER_HAS_CLOSED_RECORD)
		expect(run.remaining()).toEqual([ownDraft, closedRecord])
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.ENCOUNTER_ACTION_REJECTED,
				outcome: AUDIT_OUTCOME.REJECTED,
				details: expect.objectContaining({
					encounter_action: "cancel",
					reason: ERROR_CODE.ENCOUNTER_HAS_CLOSED_RECORD,
				}),
			}),
		])
	})

	it("CAP-014-R21 refuses a completed visit", async () => {
		const run = harness({ encounter: encounterRow({ status: ENCOUNTER_STATUS.COMPLETED }) })

		const problem = await problemOf(run.service.cancel(CURRENT, ENCOUNTER, NOW))

		expect(problem.code).toBe(ERROR_CODE.ENCOUNTER_COMPLETED)
	})

	it("repeats a finished cancellation without auditing it again", async () => {
		const run = harness({ encounter: encounterRow({ status: ENCOUNTER_STATUS.CANCELLED }), acquisitions: [] })

		await run.service.cancel(CURRENT, ENCOUNTER, NOW)

		expect(run.audits).toEqual([])
		expect(run.recorded).toEqual([])
	})

	it("ADR-054 bod 5 fails with documentation unavailable when the store does not answer", async () => {
		const failure = new ProblemException(HttpStatus.SERVICE_UNAVAILABLE, ERROR_CODE.DOCUMENTATION_UNAVAILABLE)

		const problem = await problemOf(harness({ storeFailure: failure }).service.cancel(CURRENT, ENCOUNTER, NOW))

		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
	})
})
