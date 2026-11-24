import { ACQUISITION_KIND, AUDIT_EVENT_TYPE, ERROR_CODE, MISSING_STEP } from "@ansora/contracts"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import {
	acquisitionRow,
	CURRENT,
	DEPARTMENT,
	DEVICE,
	ENCOUNTER,
	foundPatient,
	NOW,
	OTHER_USER,
	PATIENT,
	problemOf,
	USER,
} from "../../encounter/__tests__/encounter-fixtures"
import type { UserSession } from "../../login/types/login.types"
import { auditSubjectOf } from "../../registry/utils/patient-view"
import { FILE_STATUS } from "../constants/acquisition-file.constants"
import type { ClosureRequest } from "../types/acquisition-file.types"
import {
	CLOSING_DEVICE_MODEL,
	DRAFT_ID,
	detailsOf,
	FILE_A,
	FILE_B,
	FILE_C,
	fileHarness,
	OTHER_DEVICE,
} from "./acquisition-file-fixtures"

const VERSION = 5
const FINDING = "f4000000-0000-4000-8000-000000000001"
const COMPLETED_AT = new Date("2026-10-07T07:59:50Z")
const QUEUED_SESSION = "34343434-3434-4434-8434-343434343434"
const MOVED_PATIENT = "77777777-7777-4777-8777-777777777777"

function closureOf(overrides: Partial<ClosureRequest> = {}): ClosureRequest {
	return {
		acquisitionId: DRAFT_ID,
		version: VERSION,
		fileCount: 2,
		completedAt: COMPLETED_AT,
		operator: { userId: USER, sessionId: CURRENT.session.id },
		...overrides,
	}
}

function photoDraft() {
	return acquisitionRow({ version: VERSION, finding_id: FINDING })
}

function sessionOf(overrides: Partial<UserSession> = {}): UserSession {
	return {
		id: QUEUED_SESSION,
		userId: USER,
		deviceId: DEVICE,
		tokenExpiresAt: new Date("2026-10-07T08:30:00Z"),
		startedAt: new Date("2026-10-07T07:00:00Z"),
		sessionEnd: new Date("2026-10-07T15:00:00Z"),
		endedAt: new Date("2026-10-07T07:59:55Z"),
		...overrides,
	}
}

describe("record closed by confirming its summary CAP-014-R14", () => {
	it("CAP-021-R25 closes a complete record, numbers its files 1 to N and audits the closure", async () => {
		const run = fileHarness(photoDraft())
		run.files.received(FILE_A, { sequence: 4 })
		run.files.received(FILE_B, { sequence: 7 })

		const receipt = await run.closures.close(CURRENT, closureOf(), NOW)

		expect(receipt).toEqual({
			acquisition_id: DRAFT_ID,
			idempotency_key: photoDraft().idempotency_key,
			state: "received",
			encounter_id: photoDraft().encounter_id,
			finding_id: FINDING,
		})
		expect(run.drafts.draft).toMatchObject({
			state: ACQUISITION_STATE.RECEIVED,
			closed_at: COMPLETED_AT,
			file_count: 2,
			version: VERSION + 1,
		})
		expect([FILE_A, FILE_B].map((key) => run.files.byKey(key)?.sequence)).toEqual([1, 2])
		expect(run.audits[0]?.eventType).toBe(AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_CLOSED)
		expect(detailsOf(run.audits[0])).toMatchObject({ acquisition_id: DRAFT_ID, file_count: 2 })
	})

	it("CAP-021-R13 keeps the session that closed the record and the device the closure came from", async () => {
		const run = fileHarness(photoDraft(), { operatorSession: sessionOf() })
		run.files.received(FILE_A)
		run.files.received(FILE_B)

		await run.closures.close(CURRENT, closureOf({ operator: { userId: USER, sessionId: QUEUED_SESSION } }), NOW)

		expect(run.drafts.closings).toEqual([
			{ closedAt: COMPLETED_AT, fileCount: 2, closingSessionId: QUEUED_SESSION, closingDeviceId: DEVICE },
		])
		expect(detailsOf(run.audits[0])).toMatchObject({ closing_session_id: QUEUED_SESSION })
	})

	it("CAP-014-R07 audits the patient of the record locked for the closure", async () => {
		const run = fileHarness(photoDraft())
		run.files.received(FILE_A)
		run.files.received(FILE_B)
		run.transactions.beforeNextTransaction(() => {
			run.drafts.rows.set(DRAFT_ID, { ...run.drafts.draft, patient_id: MOVED_PATIENT })
		})

		await run.closures.close(CURRENT, closureOf(), NOW)

		expect(detailsOf(run.audits[0]).patient_identifier).toBe(auditSubjectOf(foundPatient(MOVED_PATIENT)))
	})

	it("CAP-021-R25 leaves the record a draft when its closure fails inside the transaction", async () => {
		const run = fileHarness(photoDraft())
		run.files.received(FILE_A, { sequence: 4 })
		run.files.received(FILE_B, { sequence: 7 })
		run.auditLog.failing = true

		await expect(run.closures.close(CURRENT, closureOf(), NOW)).rejects.toThrow(/audit/)

		expect(run.drafts.draft).toMatchObject({ state: ACQUISITION_STATE.DRAFT, version: VERSION })
		expect([FILE_A, FILE_B].map((key) => run.files.byKey(key)?.sequence)).toEqual([4, 7])
		expect(run.drafts.closings).toEqual([])
	})

	it("CAP-021-R29 answers a repeated closure with the same receipt even over the version it raised", async () => {
		const closed = acquisitionRow({
			version: VERSION + 1,
			finding_id: FINDING,
			state: ACQUISITION_STATE.RECEIVED,
			closed_at: COMPLETED_AT,
			file_count: 2,
		})
		const run = fileHarness(closed)

		const receipt = await run.closures.close(CURRENT, closureOf(), NOW)

		expect(receipt.state).toBe("received")
		expect(run.audits).toEqual([])
	})

	it("CAP-021-S18 CAP-015-S51 refuses a record whose announced file has not arrived", async () => {
		const run = fileHarness(photoDraft())
		run.files.received(FILE_A)
		run.files.add({ file_key: FILE_B, status: FILE_STATUS.ANNOUNCED })

		const problem = await problemOf(run.closures.close(CURRENT, closureOf(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_INCOMPLETE)
		expect(problem.extensions).toEqual({ missing_file_keys: [FILE_B] })
		expect(run.drafts.draft.state).toBe(ACQUISITION_STATE.DRAFT)
	})

	it("CAP-015-R36 refuses a record with a rejected file", async () => {
		const run = fileHarness(photoDraft())
		run.files.received(FILE_A)
		run.files.add({ file_key: FILE_C, status: FILE_STATUS.REJECTED })

		const problem = await problemOf(run.closures.close(CURRENT, closureOf(), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_INCOMPLETE)
		expect(problem.extensions).toEqual({ missing_file_keys: [FILE_C] })
	})

	it("CAP-015-S48 refuses a photo record without finding and names what is missing", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION }), { hasBodySite: false, hasAssessment: false })
		run.files.received(FILE_A)
		run.files.received(FILE_B)

		const problem = await problemOf(run.closures.close(CURRENT, closureOf(), NOW))

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(problem.extensions).toEqual({
			missing_steps: [MISSING_STEP.FINDING, MISSING_STEP.BODY_SITE, MISSING_STEP.HEALING_PHASE],
		})
	})

	it("CAP-017-R02 refuses a finding without wound type", async () => {
		const run = fileHarness(photoDraft(), { woundTypeCode: null })
		run.files.received(FILE_A)
		run.files.received(FILE_B)

		const problem = await problemOf(run.closures.close(CURRENT, closureOf(), NOW))

		expect(problem.extensions).toEqual({ missing_steps: [MISSING_STEP.WOUND_TYPE] })
	})

	it("CAP-017-S16 closes a wound record without the wound type and healing phase the instance switched off", async () => {
		const run = fileHarness(photoDraft(), {
			woundTypeCode: null,
			hasAssessment: false,
			clinicalSteps: { woundType: false, healingPhase: false },
		})
		run.files.received(FILE_A)
		run.files.received(FILE_B)

		const receipt = await run.closures.close(CURRENT, closureOf(), NOW)

		expect(receipt.state).toBe("received")
		expect(run.closing.woundRecords[0]).toMatchObject({
			woundTypeCode: undefined,
			healingPhaseCode: undefined,
			description: null,
		})
	})

	it("CAP-018-R15 refuses a scan without document title", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION, kind: ACQUISITION_KIND.SCAN }))
		run.files.received(FILE_A, { kind: ACQUISITION_KIND.SCAN })

		const problem = await problemOf(run.closures.close(CURRENT, closureOf({ fileCount: 1 }), NOW))

		expect(problem.extensions).toEqual({ missing_steps: [MISSING_STEP.DOCUMENT_TITLE] })
	})

	it("closes a scan with its document title", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION, kind: ACQUISITION_KIND.SCAN }), {
			document: {
				id: "d1000000-0000-4000-8000-000000000001",
				acquisition_id: DRAFT_ID,
				title_code: null,
				title_text: "Propouštěcí zpráva",
				title_code_list_version: null,
			},
		})
		run.files.received(FILE_A, { kind: ACQUISITION_KIND.SCAN })

		const receipt = await run.closures.close(CURRENT, closureOf({ fileCount: 1 }), NOW)

		expect(receipt.state).toBe("received")
	})

	it("CAP-021-S10 refuses a closure without file count and leaves the record a draft", async () => {
		const run = fileHarness(photoDraft())
		run.files.received(FILE_A)

		const problem = await problemOf(run.closures.close(CURRENT, closureOf({ fileCount: undefined }), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.drafts.draft.state).toBe(ACQUISITION_STATE.DRAFT)
		expect(run.closing.deliveries).toEqual([])
	})

	it("CAP-021-R25 refuses a file count that differs from the files the server holds", async () => {
		const run = fileHarness(photoDraft())
		run.files.received(FILE_A)

		const problem = await problemOf(run.closures.close(CURRENT, closureOf({ fileCount: 2 }), NOW))

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("CAP-015-S52 refuses a closure over another version", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION + 1, finding_id: FINDING }))
		run.files.received(FILE_A)
		run.files.received(FILE_B)

		const problem = await problemOf(run.closures.close(CURRENT, closureOf(), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_VERSION_CONFLICT)
	})

	it("CAP-021-S14 refuses a closure by another user", async () => {
		const run = fileHarness(photoDraft())

		const problem = await problemOf(
			run.closures.close(CURRENT, closureOf({ operator: { userId: OTHER_USER, sessionId: QUEUED_SESSION } }), NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.OPERATOR_UNVERIFIED)
		expect(run.closing.deliveries).toEqual([])
	})

	it("CAP-019-R29 accepts a queued confirmation from the session that ran when it was confirmed", async () => {
		const run = fileHarness(photoDraft(), { operatorSession: sessionOf() })
		run.files.received(FILE_A)
		run.files.received(FILE_B)

		const receipt = await run.closures.close(
			CURRENT,
			closureOf({ operator: { userId: USER, sessionId: QUEUED_SESSION } }),
			NOW,
		)

		expect(receipt.state).toBe("received")
	})

	it("CAP-021-S19 asks to sign in again when the server does not know the closing session", async () => {
		const run = fileHarness(photoDraft(), { operatorSession: undefined })
		run.files.received(FILE_A)
		run.files.received(FILE_B)

		const problem = await problemOf(
			run.closures.close(CURRENT, closureOf({ operator: { userId: USER, sessionId: QUEUED_SESSION } }), NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.UNAUTHORIZED)
		expect(problem.code).toBe(ERROR_CODE.SIGN_IN_AGAIN)
		expect(run.drafts.draft.state).toBe(ACQUISITION_STATE.DRAFT)
	})

	it("CAP-021-S14 refuses a known session of another device", async () => {
		const run = fileHarness(photoDraft(), { operatorSession: sessionOf({ deviceId: OTHER_DEVICE }) })

		const problem = await problemOf(
			run.closures.close(CURRENT, closureOf({ operator: { userId: USER, sessionId: QUEUED_SESSION } }), NOW),
		)

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.OPERATOR_UNVERIFIED)
		expect(run.closing.deliveries).toEqual([])
	})

	it("CAP-021-R13 refuses a session that did not run when the summary was confirmed", async () => {
		const run = fileHarness(photoDraft(), { operatorSession: sessionOf({ endedAt: new Date("2026-10-07T07:30:00Z") }) })

		const problem = await problemOf(
			run.closures.close(CURRENT, closureOf({ operator: { userId: USER, sessionId: QUEUED_SESSION } }), NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.OPERATOR_UNVERIFIED)
	})

	it("answers a discarded record as missing", async () => {
		const run = fileHarness(photoDraft())
		run.drafts.rows.clear()

		const problem = await problemOf(run.closures.close(CURRENT, closureOf(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})
})

const DOCUMENT = "d1000000-0000-4000-8000-000000000001"
const OTHER_RECORD = "a2000000-0000-4000-8000-000000000002"

function closedPhotoHarness(clinical: Parameters<typeof fileHarness>[1] = {}) {
	const run = fileHarness(photoDraft(), clinical)
	run.files.received(FILE_A)
	run.files.received(FILE_B)
	return run
}

// CAP-021-R11, CAP-021-R25, CAP-021-R27, CAP-021-R31, ADR-005, ADR-054
describe("closed record written into the clinical record and queued for assembly", () => {
	it("CAP-021-S21 writes the first record of a new wound with its series, author and closing device", async () => {
		const run = closedPhotoHarness()

		await run.closures.close(CURRENT, closureOf(), NOW)

		expect(run.closing.lockedEncounters).toEqual([ENCOUNTER])
		expect(run.closing.woundRecords).toEqual([
			{
				acquisitionId: DRAFT_ID,
				patientId: PATIENT,
				departmentId: photoDraft().department_id,
				operatorUserId: USER,
				station: { deviceId: DEVICE, model: CLOSING_DEVICE_MODEL },
				startedAt: photoDraft().started_at,
				closedAt: COMPLETED_AT,
				encounter: {
					id: ENCOUNTER,
					studyInstanceUid: "2.25.1",
					startedAt: NOW,
					departmentId: DEPARTMENT,
				},
				series: { seriesInstanceUid: "2.25.1", number: 1 },
				findingId: FINDING,
				isFirstRecordOfFinding: true,
				site: {
					regionCode: "181553006",
					laterality: "R",
					view: "anterior",
					x: 0.375,
					y: 0.755,
					bodyDiagramVersion: "1",
				},
				woundTypeCode: "leg-ulcer",
				healingPhaseCode: "granulating",
				description: "Bez známek infekce",
			},
		])
	})

	it("ADR-050 tells a later record of a known wound from its first record", async () => {
		const run = closedPhotoHarness({ originAcquisitionId: OTHER_RECORD })

		await run.closures.close(CURRENT, closureOf(), NOW)

		expect(run.closing.woundRecords[0]?.isFirstRecordOfFinding).toBe(false)
	})

	it("CAP-021-S08 queues the closed record for assembly exactly once", async () => {
		const run = closedPhotoHarness()

		await run.closures.close(CURRENT, closureOf(), NOW)
		await run.closures.close(CURRENT, closureOf(), NOW)

		expect(run.closing.enqueued).toEqual([DRAFT_ID])
		expect(run.closing.storeWrites).toBe(1)
	})

	it("CAP-021-S01 creates the delivery for the PACS together with the closure, once", async () => {
		const run = closedPhotoHarness()

		await run.closures.close(CURRENT, closureOf(), NOW)
		await run.closures.close(CURRENT, closureOf(), NOW)

		expect(run.closing.deliveries).toEqual([DRAFT_ID])
	})

	it("CAP-021-R36 CAP-021-R40 queues the viewing copy and upload of each held photo once, and none of a removed one", async () => {
		const run = fileHarness(photoDraft())
		const first = run.files.received(FILE_A)
		const second = run.files.received(FILE_B)
		run.files.received(FILE_C, { status: FILE_STATUS.REMOVED })

		await run.closures.close(CURRENT, closureOf(), NOW)
		await run.closures.close(CURRENT, closureOf(), NOW)

		expect(run.closing.queuedUploads).toEqual([{ kind: ACQUISITION_KIND.PHOTO, fileIds: [first.id, second.id] }])
	})

	it("ADR-054 refuses the closure as documentation unavailable and leaves the record a draft", async () => {
		const run = closedPhotoHarness()
		run.closing.isStoreUnavailable = true

		const problem = await problemOf(run.closures.close(CURRENT, closureOf(), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.drafts.draft).toMatchObject({ state: ACQUISITION_STATE.DRAFT, version: VERSION })
		expect(run.closing.deliveries).toEqual([])
		expect(run.closing.enqueued).toEqual([])
		expect(run.closing.queuedUploads).toEqual([])
		expect(run.closing.series.size).toBe(0)
		expect(run.audits).toEqual([])
	})

	it("ADR-050 fails loudly when the device the record was closed on is not registered", async () => {
		const run = closedPhotoHarness()
		run.closing.isDeviceRegistered = false

		await expect(run.closures.close(CURRENT, closureOf(), NOW)).rejects.toThrow(`the device ${DEVICE}`)

		expect(run.closing.storeWrites).toBe(0)
		expect(run.drafts.draft.state).toBe(ACQUISITION_STATE.DRAFT)
	})

	it("writes the clinical record before the audit, so a failed audit undoes the queued assembly too", async () => {
		const run = closedPhotoHarness()
		run.auditLog.failing = true

		await expect(run.closures.close(CURRENT, closureOf(), NOW)).rejects.toThrow(/audit/)

		expect(run.closing.storeWrites).toBe(1)
		expect(run.closing.deliveries).toEqual([])
		expect(run.closing.enqueued).toEqual([])
		expect(run.closing.queuedUploads).toEqual([])
		expect(run.closing.woundRecords).toEqual([])
		expect(run.drafts.draft.state).toBe(ACQUISITION_STATE.DRAFT)
	})

	it("CAP-021-R22 writes nothing into the clinical record for a record it refuses", async () => {
		const run = closedPhotoHarness({ woundTypeCode: null })

		await problemOf(run.closures.close(CURRENT, closureOf(), NOW))

		expect(run.closing.storeWrites).toBe(0)
		expect(run.closing.lockedEncounters).toEqual([])
	})

	it("CAP-021-S35 writes a scanned document with its title and page count into its own series", async () => {
		const run = fileHarness(acquisitionRow({ version: VERSION, kind: ACQUISITION_KIND.SCAN }), {
			document: {
				id: DOCUMENT,
				acquisition_id: DRAFT_ID,
				title_code: "discharge-report",
				title_text: null,
				title_code_list_version: 1,
			},
		})
		const page = run.files.received(FILE_A, { kind: ACQUISITION_KIND.SCAN })

		await run.closures.close(CURRENT, closureOf({ fileCount: 1 }), NOW)

		expect(run.closing.scanRecords).toEqual([
			expect.objectContaining({
				acquisitionId: DRAFT_ID,
				documentId: DOCUMENT,
				titleCode: "discharge-report",
				titleText: null,
				pageCount: 1,
			}),
		])
		expect([...run.closing.series.keys()]).toEqual([`${ENCOUNTER}:${DOCUMENT}`])
		expect(run.closing.deliveries).toEqual([DRAFT_ID])
		expect(run.closing.enqueued).toEqual([DRAFT_ID])
		expect(run.closing.queuedUploads).toEqual([{ kind: ACQUISITION_KIND.SCAN, fileIds: [page.id] }])
	})
})
