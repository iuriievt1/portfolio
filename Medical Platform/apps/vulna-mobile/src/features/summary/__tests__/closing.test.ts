import { ERROR_CODE } from "@ansora/contracts"
import { type BufferedFile, UPLOAD_STATE, type UploadState } from "@ansora/core-mobile"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { AcquisitionDraft } from "../../../api/acquisitions"
import { ApiProblemError, NoConnectionError } from "../../../api/api-error"
import cs from "../../../i18n/cs.json"
import en from "../../../i18n/en.json"
import { layeredTexts } from "../../../i18n/texts"
import type { ClinicalSteps } from "../../assessment/clinical-steps"
import {
	CLOSING,
	CLOSURE_CHECK,
	closingFailureOf,
	closureCheckOf,
	closureOf,
	MISSING_UNNAMED,
	missingStepsOf,
	missingStepsTextOf,
	NoResponseError,
	queuedClosingTextOf,
	RESPONSE_TIME_MS,
	TO_QUEUE,
	withinResponseTime,
} from "../closing"

vi.mock("@ansora/core-mobile", async () => ({
	...(await import("../../../../../../libs/core/mobile/src/storage/upload-status")),
	...(await import("../../../../../../libs/core/mobile/src/storage/transfer-buffer")),
}))

const BODY_SITE = {
	region_code: "11207009",
	laterality: "L",
	view: "anterior",
	x: 0.55,
	y: 0.62,
	body_diagram_version: "1",
} as const

const ALL_STEPS: ClinicalSteps = { woundType: true, healingPhase: true }
const LOCATION_ONLY: ClinicalSteps = { woundType: false, healingPhase: false }

function draft(change: Partial<AcquisitionDraft> = {}): AcquisitionDraft {
	return {
		acquisition_id: "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10",
		idempotency_key: "5f3a9e1c-2b7d-4c55-8e0a-7d1b2c3e4f50",
		state: "draft",
		kind: "photo",
		patient: { patient_id: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a" } as AcquisitionDraft["patient"],
		finding_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
		wound_type_code: "leg-ulcer",
		body_site: BODY_SITE,
		assessment: { healing_phase_code: "granulating", code_list_version: "7" },
		operator_user_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
		started_at: "2026-10-08T09:00:00Z",
		updated_at: "2026-10-08T09:05:00Z",
		version: 3,
		files: [],
		...change,
	}
}

describe("missingStepsOf", () => {
	it("CAP-015-S48 offers the summary of a complete wound record", () => {
		expect(missingStepsOf({ draft: draft(), fileCount: 3, isNewWound: true, steps: ALL_STEPS })).toEqual([])
	})

	it("CAP-015-R31 E107 names what a wound record still lacks", () => {
		const bare = draft({ finding_id: null, body_site: undefined, wound_type_code: null, assessment: undefined })

		expect(missingStepsOf({ draft: bare, fileCount: 0, isNewWound: true, steps: ALL_STEPS })).toEqual([
			"images",
			"body_site",
			"wound_type",
			"healing_phase",
		])
	})

	it("CAP-017-S16 asks only for the images and the place when the instance switched the clinical steps off", () => {
		const bare = draft({ finding_id: null, body_site: undefined, wound_type_code: null, assessment: undefined })
		const noted = draft({ wound_type_code: null, assessment: { description: "Klidné okraje" } })

		expect(missingStepsOf({ draft: bare, fileCount: 0, isNewWound: true, steps: LOCATION_ONLY })).toEqual([
			"images",
			"body_site",
		])
		expect(missingStepsOf({ draft: noted, fileCount: 1, isNewWound: true, steps: LOCATION_ONLY })).toEqual([])
	})

	it("CAP-017-R03 asks for the healing phase of a record that carries only a note", () => {
		const noted = draft({ assessment: { description: "Klidné okraje" } })

		expect(missingStepsOf({ draft: noted, fileCount: 1, isNewWound: false, steps: ALL_STEPS })).toEqual([
			"healing_phase",
		])
	})

	it("CAP-016-S02 does not ask for a wound type of an existing wound", () => {
		expect(
			missingStepsOf({ draft: draft({ wound_type_code: null }), fileCount: 1, isNewWound: false, steps: ALL_STEPS }),
		).toEqual([])
	})

	it("CAP-018-R15 asks a document for its title and pages", () => {
		const scan = draft({ kind: "scan", finding_id: null, body_site: undefined, assessment: undefined })

		expect(missingStepsOf({ draft: scan, fileCount: 0, isNewWound: false, steps: ALL_STEPS })).toEqual([
			"pages",
			"document_title",
		])
		expect(
			missingStepsOf({
				draft: { ...scan, document_title: { code: "medical-report" } },
				fileCount: 2,
				isNewWound: false,
				steps: ALL_STEPS,
			}),
		).toEqual([])
	})
})

describe("closureOf", () => {
	it("CAP-021-R25 CAP-021-R13 closes as many files as the operator confirmed, in the session of the operator", () => {
		expect(closureOf(2, { userId: "user", sessionId: "session" }, new Date("2026-10-08T09:30:00.000Z"))).toEqual({
			file_count: 2,
			completed_at: "2026-10-08T09:30:00.000Z",
			operator: { user_id: "user", session_id: "session" },
		})
	})
})

describe("closureCheckOf", () => {
	const confirmed = { fileKeys: ["a", "b"], contentFingerprint: "content-1" }

	function local(fileKey: string, uploadState: UploadState, rejectionCode: string | null = null): BufferedFile {
		return {
			fileKey,
			acquisitionId: "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10",
			operatorUserId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
			position: fileKey === "a" ? 1 : 2,
			kind: "image",
			contentFileId: `${fileKey}-content`,
			thumbnailFileId: `${fileKey}-thumbnail`,
			originalFileId: null,
			corners: null,
			width: 1,
			height: 1,
			capturedAt: "2026-10-08T09:01:00.000Z",
			uploadState,
			sentContentFileId: `${fileKey}-content`,
			receivedContentFileId: uploadState === UPLOAD_STATE.RECEIVED ? `${fileKey}-content` : null,
			contentEdit: null,
			rejectionCode,
			editFailedContentFileId: null,
			replacesFileKey: null,
		}
	}

	const uploaded = draft({
		version: 9,
		files: [
			{ file_key: "a", sequence: 1, status: "received" },
			{ file_key: "b", sequence: 2, status: "received" },
		],
	})
	const ownReceived = [local("a", UPLOAD_STATE.RECEIVED), local("b", UPLOAD_STATE.RECEIVED)]

	it("CAP-019-R29 CAP-019-S20 closes once the own uploads finished, whatever version they raised", () => {
		expect(closureCheckOf(confirmed, uploaded, "content-1", ownReceived)).toBe(CLOSURE_CHECK.READY)
	})

	it("CAP-019-R29 waits while an own file of the record is still on its way", () => {
		const announced = draft({
			files: [
				{ file_key: "a", sequence: 1, status: "received" },
				{ file_key: "b", sequence: 2, status: "announced" },
			],
		})

		expect(
			closureCheckOf(confirmed, announced, "content-1", [
				local("a", UPLOAD_STATE.RECEIVED),
				local("b", UPLOAD_STATE.UPLOADING),
			]),
		).toBe(CLOSURE_CHECK.WAIT)
	})

	it("CAP-021-R32 E115 notices a description changed on another device", () => {
		expect(closureCheckOf(confirmed, uploaded, "content-2", ownReceived)).toBe(CLOSURE_CHECK.CHANGED)
	})

	it("CAP-018-S10 E115 notices an order changed on another device", () => {
		const moved = draft({
			files: [
				{ file_key: "a", sequence: 2, status: "received" },
				{ file_key: "b", sequence: 1, status: "received" },
			],
		})

		expect(closureCheckOf(confirmed, moved, "content-1", ownReceived)).toBe(CLOSURE_CHECK.CHANGED)
	})

	it("CAP-015-R36 CAP-019-R29 E112 does not close a record with a file the server rejected", () => {
		const rejected = [local("a", UPLOAD_STATE.RECEIVED), local("b", UPLOAD_STATE.REJECTED, ERROR_CODE.RECORD_REJECTED)]

		expect(closureCheckOf(confirmed, uploaded, "content-1", rejected)).toBe(CLOSURE_CHECK.REJECTED)
	})

	it("CAP-015-S51 E111 does not close a record that waits for a file of another device", () => {
		const elsewhere = draft({
			files: [
				{ file_key: "a", sequence: 1, status: "received" },
				{ file_key: "b", sequence: 2, status: "received" },
				{ file_key: "c", sequence: 3, status: "announced", pending_on_other_device: true },
			],
		})

		expect(closureCheckOf(confirmed, elsewhere, "content-1", ownReceived)).toBe(CLOSURE_CHECK.ON_OTHER_DEVICE)
	})

	it("CAP-009-S05 Q-076 does not close a record with a file this device cannot read or lost", () => {
		const unreadable = [local("a", UPLOAD_STATE.RECEIVED), local("b", UPLOAD_STATE.UNREADABLE)]
		const lost = draft({
			files: [
				{ file_key: "a", sequence: 1, status: "received" },
				{ file_key: "b", sequence: 2, status: "announced", pending_on_other_device: false },
			],
		})

		expect(closureCheckOf(confirmed, lost, "content-1", unreadable)).toBe(CLOSURE_CHECK.UNREADABLE)
		expect(closureCheckOf(confirmed, lost, "content-1", [local("a", UPLOAD_STATE.RECEIVED)])).toBe(
			CLOSURE_CHECK.UNREADABLE,
		)
	})

	it("CAP-015-R35 CAP-018-R14 closes a record whose file came from another device", () => {
		expect(closureCheckOf(confirmed, uploaded, "content-1", [local("a", UPLOAD_STATE.RECEIVED)])).toBe(
			CLOSURE_CHECK.READY,
		)
	})
})

describe("closingFailureOf", () => {
	it("CAP-021-R29 CAP-021-R32 E115 tells a closed record from a record changed elsewhere", () => {
		expect(closingFailureOf(new ApiProblemError(409, ERROR_CODE.ACQUISITION_CLOSED))).toEqual({ kind: CLOSING.CLOSED })
		expect(closingFailureOf(new ApiProblemError(409, ERROR_CODE.ACQUISITION_VERSION_CONFLICT))).toEqual({
			kind: CLOSING.CHANGED,
		})
		expect(closingFailureOf(new ApiProblemError(404, ERROR_CODE.RESOURCE_NOT_FOUND))).toEqual({
			kind: CLOSING.CHANGED,
		})
	})

	it("CAP-021-R25 E115 takes a record the server finds incomplete after the check as changed", () => {
		expect(closingFailureOf(new ApiProblemError(422, ERROR_CODE.ACQUISITION_INCOMPLETE))).toEqual({
			kind: CLOSING.CHANGED,
		})
	})

	it("E107 CAP-021-R22 names the steps the server misses", () => {
		const missing = new ApiProblemError(422, ERROR_CODE.RECORD_REJECTED, undefined, ["healing_phase", "a-later-step"])

		expect(closingFailureOf(missing)).toEqual({ kind: CLOSING.MISSING, steps: ["healing_phase"] })
		expect(closingFailureOf(new ApiProblemError(422, ERROR_CODE.RECORD_REJECTED, undefined, ["a-later-step"]))).toEqual(
			{ kind: CLOSING.MISSING, steps: ["summary"] },
		)
		expect(closingFailureOf(new ApiProblemError(422, ERROR_CODE.RECORD_REJECTED))).toBe(MISSING_UNNAMED)
	})

	it("E70 CAP-019-R02 CAP-019-R29 Figma 05 H queues the confirmation without a connection and gives up on a silent server", () => {
		expect(closingFailureOf(new NoConnectionError(new Error("unexpected end of stream")))).toBe(TO_QUEUE)
		expect(closingFailureOf(new Error("the device could not read the record"))).toEqual({ kind: CLOSING.NO_RESPONSE })
		expect(closingFailureOf(new NoResponseError())).toEqual({ kind: CLOSING.NO_RESPONSE })
		expect(closingFailureOf(new ApiProblemError(500, ERROR_CODE.RETRY))).toEqual({ kind: CLOSING.NO_RESPONSE })
	})

	it("E129 ADR-054 tells an unavailable clinical record apart from a lost connection", () => {
		expect(closingFailureOf(new ApiProblemError(503, ERROR_CODE.DOCUMENTATION_UNAVAILABLE))).toEqual({
			kind: CLOSING.DOCUMENTATION_UNAVAILABLE,
		})
	})

	it("CAP-002-R17 leaves the closing to the next sign-in when the session ended", () => {
		expect(closingFailureOf(new ApiProblemError(401, ERROR_CODE.SIGN_IN_AGAIN))).toEqual({ kind: CLOSING.IDLE })
	})
})

describe("waiting for the server", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("Figma 05 H.3 stops waiting for an answer after the response time", async () => {
		vi.useFakeTimers()
		const silent = withinResponseTime(new Promise<never>(() => undefined))

		await expect(withinResponseTime(Promise.resolve("draft"))).resolves.toBe("draft")
		vi.advanceTimersByTime(RESPONSE_TIME_MS + 1)
		await expect(silent).rejects.toBeInstanceOf(NoResponseError)
	})
})

describe("closing texts", () => {
	it("CAP-019-R29 E93 says how many files the record still waits for", () => {
		expect(queuedClosingTextOf(2, cs)).toBe(
			"Souhrn jste potvrdili. Záznam se uzavře sám, jakmile server přijme zbývající soubory (2). Mezitím můžete pracovat dál.",
		)
	})

	it("CAP-019-R02 E70 says that a confirmation without a connection waits for it", () => {
		expect(queuedClosingTextOf(0, cs)).toBe("Souhrn jste potvrdili. Záznam se uzavře sám, jakmile bude spojení.")
	})

	it("CAP-015-R23 says the same in another language without code", () => {
		const english = layeredTexts("cs", ["en"])
		expect(queuedClosingTextOf(1, english)).toBe(
			"You confirmed the summary. The record closes by itself once the server receives the remaining files (1). You can keep working in the meantime.",
		)
		expect(en.capture.closing.queued.body).toContain("{n}")
	})

	it("E107 lists what is missing in words", () => {
		expect(missingStepsTextOf(["body_site", "healing_phase"], cs)).toBe(
			"Chybí: poloha rány · fáze hojení. Doplňte je a souhrn potvrdíte.",
		)
	})
})
