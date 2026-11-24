import { ACQUISITION_KIND, ENCOUNTER_STATUS, ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, CONFIGURATION_KEY } from "@ansora/core-server"
import type { ActorDepartment } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import {
	clinicalReadsFake,
	type StoreHistory,
	shownWound,
} from "../../clinical-record/__tests__/clinical-read-fixtures"
import type { ClinicalActorRepository } from "../../clinical-record/repositories/clinical-actor.repository"
import type { DocumentRecordService } from "../../clinical-record/services/document-record.service"
import type { EncounterRecordService } from "../../clinical-record/services/encounter-record.service"
import { ViewerService } from "../../clinical-record/services/viewer.service"
import type { DraftDocumentRecord } from "../../clinical-record/types/clinical-record.types"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
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
	OTHER_PATIENT,
	OTHER_USER,
	PATIENT,
	problemOf,
	SESSION,
	USER,
} from "../../encounter/__tests__/encounter-fixtures"
import type { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import { EncounterRejectionService } from "../../encounter/services/encounter-rejection.service"
import { EncounterTargetService } from "../../encounter/services/encounter-target.service"
import type { EncounterRow, NewEncounter } from "../../encounter/types/encounter.types"
import { encounterIdOfKey } from "../../encounter/utils/encounter-identity"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { SessionRepository } from "../../login/repositories/session.repository"
import type { UserSession } from "../../login/types/login.types"
import type { PatientRepository } from "../../registry/repositories/patient.repository"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { AcquisitionDraftCreateInput } from "../dto/acquisition-draft-create.input.dto"
import type { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import type { AcquisitionFileRepository } from "../repositories/acquisition-file.repository"
import type { DocumentRepository } from "../repositories/document.repository"
import { AcquisitionDraftService } from "../services/acquisition-draft.service"
import type { AcquisitionDraftViewService } from "../services/acquisition-draft-view.service"
import { OperatorVerificationService } from "../services/operator-verification.service"
import { ScanDocumentService } from "../services/scan-document.service"
import type { AcquisitionRow, NewDraft } from "../types/acquisition.types"
import type { FileCountRow } from "../types/acquisition-file.types"
import { documentIdOfDraft } from "../utils/document-identity"
import { encountersOfId, seriesFake } from "./scan-document-fakes"

const KEY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const ENCOUNTER_KEY = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const DRAFT_LIMIT = 2
const PAGE_SIZE = 50

interface Setup {
	existing: AcquisitionRow | undefined
	actorDepartment: ActorDepartment | undefined
	draftCount: number
	encounterById: EncounterRow | undefined
	encounterByKey: EncounterRow | undefined
	versionExists: boolean
	operatorSession: UserSession | undefined
	storeFailure: ProblemException | undefined
	documentFailure: ProblemException | undefined
	ownDrafts: AcquisitionRow[]
	fileCounts: FileCountRow[]
	storeShows: Partial<StoreHistory>
}

function draftInput(overrides: Partial<AcquisitionDraftCreateInput> = {}): AcquisitionDraftCreateInput {
	return {
		operator: { user_id: USER, session_id: SESSION },
		patient_id: PATIENT,
		encounter_key: ENCOUNTER_KEY,
		kind: ACQUISITION_KIND.PHOTO,
		started_at: "2026-10-07T07:59:00Z",
		configuration_version: 3,
		...overrides,
	}
}

function harness(setup: Partial<Setup> = {}) {
	const state: Setup = {
		existing: undefined,
		actorDepartment: { id: DEPARTMENT, code: "KOC" },
		draftCount: 0,
		encounterById: undefined,
		encounterByKey: undefined,
		versionExists: true,
		operatorSession: undefined,
		storeFailure: undefined,
		documentFailure: undefined,
		ownDrafts: [],
		fileCounts: [],
		storeShows: {},
		...setup,
	}
	const audits: NewAuditEvent[] = []
	const createdEncounters: NewEncounter[] = []
	const createdDrafts: NewDraft[] = []
	const startedEncounters: string[] = []
	const recorded: EncounterRow[] = []
	const documents: DraftDocumentRecord[] = []
	const drafts = {
		findByIdempotencyKey: async () => state.existing,
		findById: async () => state.existing,
		configurationVersionExists: async () => state.versionExists,
		countOwnDrafts: async () => state.draftCount,
		listOwnDrafts: async () => ({ rows: state.ownDrafts, nextCursor: null }),
		insert: async (_tx: never, draft: NewDraft) => {
			createdDrafts.push(draft)
			return acquisitionRow({
				id: draft.id,
				idempotency_key: draft.idempotencyKey,
				encounter_id: draft.encounterId,
				kind: draft.kind,
				department_id: draft.departmentId,
			})
		},
	} as unknown as AcquisitionDraftRepository
	const encounters = {
		lockById: async () => state.encounterById,
		lockByKey: async () => state.encounterByKey,
		start: async (_tx: never, id: string) => {
			startedEncounters.push(id)
			return encounterRow({ id, status: ENCOUNTER_STATUS.IN_PROGRESS })
		},
		insertCreatedInApp: async (_tx: never, encounter: NewEncounter) => {
			createdEncounters.push(encounter)
			return encounterRow({ id: encounter.id, encounter_key: encounter.encounterKey })
		},
	} as unknown as EncounterRepository
	const sessions = { findById: async () => state.operatorSession } as unknown as SessionRepository
	const patients = {
		byIds: async (ids: readonly string[]) => ids.filter((id) => id === PATIENT).map((id) => foundPatient(id)),
	} as unknown as PatientRepository
	const actors = {
		actorOf: async () => ({
			userId: USER,
			displayName: "Test",
			department: state.actorDepartment,
			roles: [],
		}),
	} as unknown as ClinicalActorRepository
	const records = {
		record: async (_tx: never, encounter: EncounterRow) => {
			if (state.storeFailure !== undefined) {
				throw state.storeFailure
			}
			recorded.push(encounter)
			return { patient: "p", encounter: "e" }
		},
	} as unknown as EncounterRecordService
	const configuration = {
		integer: async (key: string) => (key === CONFIGURATION_KEY.MAX_DRAFT_ACQUISITIONS ? DRAFT_LIMIT : 0),
		pageSize: async () => ({ defaultSize: PAGE_SIZE, maxSize: PAGE_SIZE }),
	} as unknown as ConfigurationService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	const database = fakeDatabase()
	const views = {
		viewOf: async (_sql: never, row: AcquisitionRow) => ({ acquisition_id: row.id, version: row.version }),
	} as unknown as AcquisitionDraftViewService
	const documentRecords = {
		recordDraft: async (_tx: never, record: DraftDocumentRecord) => {
			if (state.documentFailure !== undefined) {
				throw state.documentFailure
			}
			documents.push(record)
		},
	} as unknown as DocumentRecordService
	const scanDocuments = new ScanDocumentService(
		{ insert: async () => undefined } as unknown as DocumentRepository,
		seriesFake().repository,
		encountersOfId(),
		documentRecords,
	)
	const service = new AcquisitionDraftService(
		database,
		drafts,
		new EncounterTargetService(encounters),
		new OperatorVerificationService(database, sessions),
		new PatientLookupService(patients),
		new ViewerService(actors),
		records,
		configuration,
		audit,
		new EncounterRejectionService(database, audit),
		views,
		{ countsOf: async () => state.fileCounts } as unknown as AcquisitionFileRepository,
		scanDocuments,
		clinicalReadsFake(state.storeShows).reads,
	)
	return { service, audits, createdEncounters, createdDrafts, startedEncounters, recorded, documents }
}

describe("draft created by the action in a visit CAP-015-R30", () => {
	it("CAP-014-S02 CAP-015-S45 creates the new visit with its first draft and records both", async () => {
		const run = harness()

		const creation = await run.service.create(CURRENT, draftInput(), KEY, NOW)

		const encounterId = encounterIdOfKey(ENCOUNTER_KEY)
		expect(creation.created).toBe(true)
		expect(creation.receipt).toMatchObject({ idempotency_key: KEY, state: "draft", encounter_id: encounterId })
		expect(run.createdEncounters).toEqual([
			{
				id: encounterId,
				patientId: PATIENT,
				encounterKey: ENCOUNTER_KEY,
				date: "2026-10-07",
				departmentId: DEPARTMENT,
				studyInstanceUid: expect.stringMatching(/^2\.25\.\d+$/),
				startedAt: NOW,
			},
		])
		expect(run.createdDrafts[0]).toMatchObject({
			operatorUserId: USER,
			operatorSessionId: SESSION,
			departmentId: DEPARTMENT,
			configurationVersionId: 3,
		})
		expect(run.recorded.map((encounter) => encounter.id)).toEqual([encounterId])
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_CREATED,
				actorUserId: USER,
				actorDeviceId: DEVICE,
				sessionId: SESSION,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: expect.objectContaining({ encounter_id: encounterId, patient_identifier: "nis-5555" }),
			}),
		])
	})

	it("CAP-014-S19 a second key for the same patient and day is a second visit", async () => {
		const run = harness()
		const second = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"

		await run.service.create(CURRENT, draftInput(), KEY, NOW)
		await run.service.create(
			CURRENT,
			draftInput({ encounter_key: second }),
			"ffffffff-ffff-4fff-8fff-ffffffffffff",
			NOW,
		)

		expect(run.createdEncounters.map((encounter) => encounter.id)).toEqual([
			encounterIdOfKey(ENCOUNTER_KEY),
			encounterIdOfKey(second),
		])
	})

	it("starts a planned visit with its first record", async () => {
		const run = harness({ encounterById: encounterRow({ status: ENCOUNTER_STATUS.PLANNED, source: "worklist" }) })

		await run.service.create(CURRENT, draftInput({ encounter_key: undefined, encounter_id: ENCOUNTER }), KEY, NOW)

		expect(run.startedEncounters).toEqual([ENCOUNTER])
		expect(run.createdEncounters).toEqual([])
	})

	it("CAP-021-S19 refuses an operator session the server does not know", async () => {
		const run = harness()

		const problem = await problemOf(
			run.service.create(CURRENT, draftInput({ operator: { user_id: USER, session_id: OTHER_USER } }), KEY, NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
		expect(problem.code).toBe(ERROR_CODE.SIGN_IN_AGAIN)
		expect(run.createdDrafts).toEqual([])
	})

	it("CAP-021-R13 refuses an operator who is not the signed-in user", async () => {
		const problem = await problemOf(
			harness().service.create(
				CURRENT,
				draftInput({ operator: { user_id: OTHER_USER, session_id: SESSION } }),
				KEY,
				NOW,
			),
		)

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.OPERATOR_UNVERIFIED)
	})

	it("CAP-012-S13 refuses a configuration version the server does not know", async () => {
		const problem = await problemOf(harness({ versionExists: false }).service.create(CURRENT, draftInput(), KEY, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("CAP-015-S14 refuses the draft over the limit of the operator", async () => {
		const run = harness({ draftCount: DRAFT_LIMIT })

		const problem = await problemOf(run.service.create(CURRENT, draftInput(), KEY, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.DRAFT_LIMIT_REACHED)
		expect(run.createdEncounters).toEqual([])
	})

	it("CAP-014-R26 refuses a visit of another patient", async () => {
		const run = harness({ encounterById: encounterRow({ patient_id: OTHER_PATIENT }) })

		const problem = await problemOf(
			run.service.create(CURRENT, draftInput({ encounter_key: undefined, encounter_id: ENCOUNTER }), KEY, NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.PATIENT_MISMATCH)
	})

	it("CAP-014-S45 treats the key of a visit of another patient as a conflict, not a lookup", async () => {
		const problem = await problemOf(
			harness({ encounterByKey: encounterRow({ patient_id: OTHER_PATIENT }) }).service.create(
				CURRENT,
				draftInput(),
				KEY,
				NOW,
			),
		)

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.IDEMPOTENCY_CONFLICT)
	})

	it("CAP-014-S32 refuses a completed visit and audits the refusal", async () => {
		const run = harness({ encounterById: encounterRow({ status: ENCOUNTER_STATUS.COMPLETED }) })

		const problem = await problemOf(
			run.service.create(CURRENT, draftInput({ encounter_key: undefined, encounter_id: ENCOUNTER }), KEY, NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.ENCOUNTER_COMPLETED)
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.ENCOUNTER_ACTION_REJECTED,
				outcome: AUDIT_OUTCOME.REJECTED,
				details: expect.objectContaining({
					encounter_action: "create_draft",
					reason: ERROR_CODE.ENCOUNTER_COMPLETED,
				}),
			}),
		])
	})

	it("CAP-014-S53 refuses a visit of an earlier day and audits the refusal", async () => {
		const run = harness({ encounterById: encounterRow({ date: "2026-10-06" }) })

		const problem = await problemOf(
			run.service.create(CURRENT, draftInput({ encounter_key: undefined, encounter_id: ENCOUNTER }), KEY, NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.ENCOUNTER_NOT_TODAY)
		expect(run.createdDrafts).toEqual([])
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.ENCOUNTER_ACTION_REJECTED,
				details: expect.objectContaining({ reason: ERROR_CODE.ENCOUNTER_NOT_TODAY }),
			}),
		])
	})

	it("CAP-014-R29 refuses a cancelled visit", async () => {
		const problem = await problemOf(
			harness({ encounterById: encounterRow({ status: ENCOUNTER_STATUS.CANCELLED }) }).service.create(
				CURRENT,
				draftInput({ encounter_key: undefined, encounter_id: ENCOUNTER }),
				KEY,
				NOW,
			),
		)

		expect(problem.code).toBe(ERROR_CODE.ENCOUNTER_CANCELLED)
	})

	it("ADR-054 bod 5 refuses the draft with documentation unavailable when the store does not answer", async () => {
		const failure = new ProblemException(HttpStatus.SERVICE_UNAVAILABLE, ERROR_CODE.DOCUMENTATION_UNAVAILABLE)

		const problem = await problemOf(harness({ storeFailure: failure }).service.create(CURRENT, draftInput(), KEY, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
	})
})

describe("scanned document founded with its record CAP-021-R39", () => {
	it("writes the document of a scan into the clinical record with the draft", async () => {
		const run = harness()

		await run.service.create(CURRENT, draftInput({ kind: ACQUISITION_KIND.SCAN }), KEY, NOW)

		expect(run.documents).toMatchObject([
			{ documentId: documentIdOfDraft(KEY), acquisitionId: run.createdDrafts[0]?.id, departmentId: DEPARTMENT },
		])
	})

	it("writes no document for a wound record", async () => {
		const run = harness()

		await run.service.create(CURRENT, draftInput(), KEY, NOW)

		expect(run.documents).toEqual([])
	})

	it("ADR-054 bod 5 refuses the scan with documentation unavailable when the store refuses its document", async () => {
		const failure = new ProblemException(HttpStatus.SERVICE_UNAVAILABLE, ERROR_CODE.DOCUMENTATION_UNAVAILABLE)

		const run = harness({ documentFailure: failure })

		const problem = await problemOf(run.service.create(CURRENT, draftInput({ kind: ACQUISITION_KIND.SCAN }), KEY, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.audits).toEqual([])
	})
})

describe("repeated creation CAP-021-R29", () => {
	const existing = acquisitionRow({ idempotency_key: KEY, encounter_id: encounterIdOfKey(ENCOUNTER_KEY) })

	it("returns the first result for the same request and creates nothing", async () => {
		const run = harness({ existing })

		const creation = await run.service.create(CURRENT, draftInput(), KEY, NOW)

		expect(creation).toEqual({
			created: false,
			receipt: {
				acquisition_id: existing.id,
				idempotency_key: KEY,
				state: "draft",
				encounter_id: existing.encounter_id,
			},
		})
		expect(run.createdDrafts).toEqual([])
		expect(run.audits).toEqual([])
	})

	it("refuses the same key with another kind", async () => {
		const problem = await problemOf(
			harness({ existing }).service.create(CURRENT, draftInput({ kind: ACQUISITION_KIND.SCAN }), KEY, NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.IDEMPOTENCY_CONFLICT)
	})

	it("refuses the same key from another user", async () => {
		const foreign = { ...existing, operator_user_id: OTHER_USER }

		const problem = await problemOf(harness({ existing: foreign }).service.create(CURRENT, draftInput(), KEY, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.IDEMPOTENCY_CONFLICT)
	})
})

describe("own drafts on the home screen CAP-015-R29", () => {
	it("CAP-015-R36 tells how many files of a draft the server rejected", async () => {
		const draft = acquisitionRow()
		const counts = { acquisition_id: draft.id, held: 3, received: 2, announced: 0, rejected: 1, announced_elsewhere: 0 }

		const page = await harness({ ownDrafts: [draft], fileCounts: [counts] }).service.listOwn(CURRENT, {}, NOW)

		expect(page.items).toMatchObject([{ acquisition_id: draft.id, file_count: 2, rejected_file_count: 1 }])
	})

	it("CAP-015-R36 says a draft without counted files has nothing to take again", async () => {
		const page = await harness({ ownDrafts: [acquisitionRow()] }).service.listOwn(CURRENT, {}, NOW)

		expect(page.items).toMatchObject([{ file_count: 0, rejected_file_count: 0 }])
	})
})

describe("own draft read to continue it CAP-015-R15", () => {
	it("CAP-014-R25 returns the own draft with its version", async () => {
		const existing = acquisitionRow({ version: 4 })

		const draft = await harness({ existing }).service.getOwn(CURRENT, existing.id, NOW)

		expect(draft).toEqual({ acquisition_id: existing.id, version: 4 })
	})

	it("CAP-015-R17 answers a draft of another author as missing", async () => {
		const existing = acquisitionRow({ operator_user_id: OTHER_USER })

		const problem = await problemOf(harness({ existing }).service.getOwn(CURRENT, existing.id, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})

	it("CAP-020-R17 sends a closed record to its read only detail", async () => {
		const existing = acquisitionRow({ state: "received", closed_at: NOW, file_count: 2 })

		const problem = await problemOf(harness({ existing }).service.getOwn(CURRENT, existing.id, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_CLOSED)
	})

	it("CAP-003-R01 CAP-020-R16 answers a closed record of another user the store does not show as missing", async () => {
		const existing = acquisitionRow({ state: "received", closed_at: NOW, file_count: 2, operator_user_id: OTHER_USER })

		const problem = await problemOf(harness({ existing }).service.getOwn(CURRENT, existing.id, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})

	it("CAP-020-R16 sends a closed record of another user the store shows to its read only detail", async () => {
		const existing = acquisitionRow({ state: "received", closed_at: NOW, file_count: 2, operator_user_id: OTHER_USER })
		const problem = await problemOf(
			harness({ existing, storeShows: { wounds: [shownWound(existing.id)] } }).service.getOwn(
				CURRENT,
				existing.id,
				NOW,
			),
		)

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_CLOSED)
	})
})
