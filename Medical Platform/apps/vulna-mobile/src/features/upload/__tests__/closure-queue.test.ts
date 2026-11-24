import { ERROR_CODE } from "@ansora/contracts"
import type { BufferedFile, QueuedClosure, TransferBuffer } from "@ansora/core-mobile"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NodeSqlDatabase } from "../../../../../../libs/core/mobile/src/storage/__tests__/node-sql-database"
import { openEncryptedDatabase } from "../../../../../../libs/core/mobile/src/storage/encrypted-database"
import { SqlQueueNoticeRecords } from "../../../../../../libs/core/mobile/src/storage/queue-notice"
import { SqlQueuedClosureRecords } from "../../../../../../libs/core/mobile/src/storage/queued-closure"
import { SerialSqlDatabase } from "../../../../../../libs/core/mobile/src/storage/sql-database"
import type { AcquisitionClosure, AcquisitionDraft } from "../../../api/acquisitions"

const ACQUISITION = "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10"
const OPERATOR = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
const OTHER_USER = "6e7f8a9b-0c1d-4e2f-8a3b-4c5d6e7f8a9b"
const SESSION = "7f8a9b0c-1d2e-4f3a-8b4c-5d6e7f8a9b0c"
const DATABASE_KEY = "ab".repeat(32)
const CONFIRMED_AT = "2026-10-19T09:00:00.000Z"
const CONFLICT = 409
const NOT_FOUND = 404
const UNPROCESSABLE = 422
const UNAUTHORIZED = 401
const UNAVAILABLE = 503
const FIRST_RETRY_MS = 2000

interface Closing {
	token: string
	draft: Pick<AcquisitionDraft, "acquisition_id" | "version">
	closure: AcquisitionClosure
}

const world = vi.hoisted(() => ({
	closures: undefined as unknown as SqlQueuedClosureRecords,
	notices: undefined as unknown as SqlQueueNoticeRecords,
	local: [] as BufferedFile[],
	fresh: undefined as unknown as AcquisitionDraft,
	refreshFailure: undefined as Error | undefined,
	closeFailure: undefined as Error | undefined,
	closings: [] as Closing[],
	refreshes: 0,
	sessionUserId: undefined as string | undefined,
	answerGate: Promise.resolve(),
}))

vi.mock("@ansora/core-mobile", async () => ({
	...(await import("../../../../../../libs/core/mobile/src/storage/upload-status")),
	...(await import("../../../../../../libs/core/mobile/src/storage/transfer-buffer")),
	...(await import("../../../../../../libs/core/mobile/src/storage/queue-notice")),
	...(await import("../../../../../../libs/core/mobile/src/session/session-caller")),
	...(await import("../../../../../../libs/core/mobile/src/native/error-codes")),
	...(await import("../../../../../../libs/core/mobile/src/storage/encrypted-file-store")),
	cryptoAndKeys: () => ({ sha256Text: async (text: string) => `sha256(${text})` }),
}))
vi.mock("../transfer-store", () => ({
	queuedClosures: async () => world.closures,
	queueNotices: async () => world.notices,
}))
vi.mock("../../session/session-store", () => ({
	currentSession: () =>
		world.sessionUserId === undefined ? undefined : { user: { id: world.sessionUserId }, session_id: SESSION },
}))
vi.mock("../../session/session-actions", async () => {
	const { NoSessionError } = await import("../../../../../../libs/core/mobile/src/session/session-caller")
	return {
		sessionCaller: {
			call: <T>(work: (sessionToken: string) => Promise<T>) => {
				if (world.sessionUserId === undefined) {
					throw new NoSessionError()
				}
				return work("session-token")
			},
		},
	}
})
vi.mock("../../../api/acquisitions", () => ({
	acquisitionApi: {
		getAcquisitionDraft: async () => {
			world.refreshes += 1
			await world.answerGate
			if (world.refreshFailure !== undefined) {
				throw world.refreshFailure
			}
			return world.fresh
		},
		closeAcquisition: async (token: string, closed: Closing["draft"], closure: AcquisitionClosure) => {
			if (world.closeFailure !== undefined) {
				throw world.closeFailure
			}
			world.closings.push({ token, draft: closed, closure })
			return {}
		},
	},
}))

function draft(change: Partial<AcquisitionDraft> = {}): AcquisitionDraft {
	return {
		acquisition_id: ACQUISITION,
		idempotency_key: "5f3a9e1c-2b7d-4c55-8e0a-7d1b2c3e4f50",
		state: "draft",
		kind: "photo",
		patient: { patient_id: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a" } as AcquisitionDraft["patient"],
		finding_id: "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f",
		assessment: { healing_phase_code: "granulating", code_list_version: "7" },
		operator_user_id: OPERATOR,
		started_at: "2026-10-19T08:50:00Z",
		updated_at: "2026-10-19T09:05:00Z",
		version: 9,
		files: [
			{ file_key: "a", sequence: 1, status: "received" },
			{ file_key: "b", sequence: 2, status: "received" },
		],
		...change,
	}
}

function local(fileKey: string, uploadState: BufferedFile["uploadState"]): BufferedFile {
	return {
		fileKey,
		acquisitionId: ACQUISITION,
		operatorUserId: OPERATOR,
		position: fileKey === "a" ? 1 : 2,
		kind: "image",
		contentFileId: `${fileKey}-content`,
		thumbnailFileId: `${fileKey}-thumbnail`,
		originalFileId: null,
		corners: null,
		width: 1,
		height: 1,
		capturedAt: "2026-10-19T08:58:00.000Z",
		uploadState,
		sentContentFileId: `${fileKey}-content`,
		receivedContentFileId: uploadState === "received" ? `${fileKey}-content` : null,
		contentEdit: null,
		rejectionCode: null,
		editFailedContentFileId: null,
		replacesFileKey: null,
	}
}

const buffer = { photos: async () => world.local } as unknown as TransferBuffer

async function problem(status: number, code: string): Promise<Error> {
	const { ApiProblemError } = await import("../../../api/api-error")
	return new ApiProblemError(status, code)
}

async function queuedClosureOf(confirmed: AcquisitionDraft): Promise<QueuedClosure> {
	const { contentFingerprintOf } = await import("../../summary/confirmed-content")
	return {
		acquisitionId: ACQUISITION,
		operatorUserId: OPERATOR,
		operatorPersonalNumber: "12345",
		recordKind: "photo",
		fileKeys: ["a", "b"],
		contentFingerprint: await contentFingerprintOf(confirmed),
		completedAt: CONFIRMED_AT,
	}
}

async function queue(confirmed: AcquisitionDraft = draft()) {
	const closures = await import("../closure-queue")
	await closures.queueClosure(await queuedClosureOf(confirmed))
	return closures
}

beforeEach(async () => {
	vi.resetModules()
	const db = new SerialSqlDatabase(
		await openEncryptedDatabase("queue", DATABASE_KEY, "/vault/queue", async () => new NodeSqlDatabase()),
	)
	world.closures = new SqlQueuedClosureRecords(db)
	world.notices = new SqlQueueNoticeRecords(db)
	world.local = [local("a", "received"), local("b", "received")]
	world.fresh = draft()
	world.refreshFailure = undefined
	world.closeFailure = undefined
	world.closings = []
	world.refreshes = 0
	world.sessionUserId = OPERATOR
	world.answerGate = Promise.resolve()
})

afterEach(() => {
	vi.useRealTimers()
})

describe("queued closure of a confirmed summary CAP-019-R29", () => {
	it("CAP-019-S20 CAP-021-R13 closes the record in the session of its operator once its own files are received", async () => {
		const closures = await queue()
		const settled = vi.fn()
		closures.onQueuedClosureSettled(settled)

		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(world.closings).toEqual([
			{
				token: "session-token",
				draft: world.fresh,
				closure: { file_count: 2, completed_at: CONFIRMED_AT, operator: { user_id: OPERATOR, session_id: SESSION } },
			},
		])
		expect(await world.closures.list()).toEqual([])
		expect(settled).toHaveBeenCalledTimes(1)
		expect(await world.notices.listFor(OPERATOR)).toEqual([])
	})

	it("CAP-019-R29 waits without asking the server while an own file of the record is still uploading", async () => {
		const closures = await queue()
		world.local = [local("a", "received"), local("b", "uploading")]

		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(world.refreshes).toBe(0)
		expect(world.closings).toEqual([])
		expect(await world.closures.list()).toHaveLength(1)
	})

	it("CAP-019-S21 CAP-002-R09 leaves the closure to the next sign-in of its operator", async () => {
		const closures = await queue()
		world.sessionUserId = OTHER_USER
		await closures.sendQueuedClosures(buffer, vi.fn())
		world.sessionUserId = undefined
		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(world.closings).toEqual([])
		expect(await world.closures.list()).toHaveLength(1)

		world.sessionUserId = OPERATOR
		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(world.closings).toHaveLength(1)
	})

	it("CAP-019-S21 keeps the closure for the next sign-in when the session ends on the way", async () => {
		const closures = await queue()
		world.closeFailure = await problem(UNAUTHORIZED, ERROR_CODE.SIGN_IN_AGAIN)

		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(await world.closures.list()).toHaveLength(1)
		expect(await world.notices.listFor(OPERATOR)).toEqual([])
	})

	it("CAP-021-R32 CAP-019-S20 takes the own uploads after the confirmation as no change of the record", async () => {
		const closures = await queue(draft({ version: 4, files: [{ file_key: "a", sequence: 1, status: "received" }] }))

		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(world.closings.map((closing) => closing.draft.version)).toEqual([9])
	})

	it("CAP-021-R32 CAP-019-R29 E114 does not close a record changed on another device and tells its operator", async () => {
		const closures = await queue()
		world.fresh = draft({ assessment: { healing_phase_code: "epithelial", code_list_version: "7" } })

		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(world.closings).toEqual([])
		expect(await world.closures.list()).toEqual([])
		expect(await world.notices.listFor(OPERATOR)).toMatchObject([
			{ kind: "closure_changed", acquisitionId: ACQUISITION },
		])
	})

	it("CAP-009-S05 Q-076 E114 does not close a record with a file this device cannot read and tells its operator", async () => {
		const closures = await queue()
		world.local = [local("a", "received"), local("b", "unreadable")]
		world.fresh = draft({
			files: [
				{ file_key: "a", sequence: 1, status: "received" },
				{ file_key: "b", sequence: 2, status: "announced", pending_on_other_device: false },
			],
		})

		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(world.closings).toEqual([])
		expect(await world.closures.list()).toEqual([])
		expect(await world.notices.listFor(OPERATOR)).toMatchObject([
			{ kind: "closure_file_unreadable", acquisitionId: ACQUISITION },
		])
	})

	it("CAP-021-R32 E114 takes a version conflict of the closing as a change made elsewhere", async () => {
		const closures = await queue()
		world.closeFailure = await problem(CONFLICT, ERROR_CODE.ACQUISITION_VERSION_CONFLICT)

		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(await world.closures.list()).toEqual([])
		expect(await world.notices.listFor(OPERATOR)).toMatchObject([{ kind: "closure_changed" }])
	})

	it("CAP-021-R29 forgets the closure of a record that is already closed", async () => {
		const closures = await queue()
		world.fresh = draft({ state: "received" })

		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(world.closings).toEqual([])
		expect(await world.closures.list()).toEqual([])
		expect(await world.notices.listFor(OPERATOR)).toEqual([])
	})

	it("CAP-019-R20 CAP-019-R14 tells the operator about the closure of a record the server no longer has", async () => {
		const closures = await queue()
		world.refreshFailure = await problem(NOT_FOUND, ERROR_CODE.RESOURCE_NOT_FOUND)

		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(await world.closures.list()).toEqual([])
		expect(await world.notices.listFor(OPERATOR)).toMatchObject([{ kind: "closure_refused" }])
	})

	it("CAP-021-R25 tries the closure again when the server still misses a file of the record", async () => {
		const closures = await queue()
		world.closeFailure = await problem(UNPROCESSABLE, ERROR_CODE.ACQUISITION_INCOMPLETE)

		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(await world.closures.list()).toHaveLength(1)
		expect(await world.notices.listFor(OPERATOR)).toEqual([])
	})

	it("CAP-019-R29 E114 withdraws the queued closure of a record whose file failed and tells who waits for it", async () => {
		const closures = await queue()
		const settled = vi.fn()
		closures.onQueuedClosureSettled(settled)

		const withdrawn = await closures.withdrawQueuedClosure(ACQUISITION)

		expect(withdrawn).toMatchObject({ acquisitionId: ACQUISITION })
		expect(await world.closures.list()).toEqual([])
		expect(settled).toHaveBeenCalledTimes(1)
		expect(await closures.withdrawQueuedClosure(ACQUISITION)).toBeUndefined()
	})

	it("CAP-019-R29 sends the closure once when two sends overlap", async () => {
		const closures = await queue()

		await Promise.all([closures.sendQueuedClosures(buffer, vi.fn()), closures.sendQueuedClosures(buffer, vi.fn())])

		expect(world.closings).toHaveLength(1)
		expect(await world.closures.list()).toEqual([])
	})

	it("CAP-019-R13 E129 tries the closure again later while the clinical record is unavailable", async () => {
		vi.useFakeTimers()
		const closures = await queue()
		world.closeFailure = await problem(UNAVAILABLE, ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		const wake = vi.fn()

		await closures.sendQueuedClosures(buffer, wake)
		await closures.sendQueuedClosures(buffer, wake)

		expect(world.refreshes).toBe(1)
		expect(await world.closures.list()).toHaveLength(1)
		await vi.advanceTimersByTimeAsync(FIRST_RETRY_MS)
		expect(wake).toHaveBeenCalledTimes(1)

		world.closeFailure = undefined
		await closures.sendQueuedClosures(buffer, wake)
		expect(world.closings).toHaveLength(1)
	})

	it("CAP-019-R14 E114 tells the operator when the server refuses the closure for good", async () => {
		const closures = await queue()
		world.closeFailure = await problem(UNPROCESSABLE, ERROR_CODE.RECORD_REJECTED)

		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(await world.closures.list()).toEqual([])
		expect(await world.notices.listFor(OPERATOR)).toMatchObject([{ kind: "closure_refused" }])
	})

	it("CAP-019-R29 keeps a summary confirmed again while the earlier confirmation was being checked", async () => {
		const closures = await queue()
		world.fresh = draft({ wound_type_code: "burn" })
		let answer: () => void = () => undefined
		world.answerGate = new Promise((release) => {
			answer = release
		})
		const sending = closures.sendQueuedClosures(buffer, vi.fn())
		await vi.waitFor(() => expect(world.refreshes).toBe(1))
		const confirmedAgain = { ...(await queuedClosureOf(world.fresh)), completedAt: "2026-10-19T09:20:00.000Z" }
		await closures.queueClosure(confirmedAgain)

		answer()
		await sending

		expect(world.closings).toEqual([])
		expect(await world.closures.list()).toEqual([confirmedAgain])
		expect(await world.notices.listFor(OPERATOR)).toEqual([])
	})

	it("CAP-019-R29 a change made on this device after the confirmation voids the closure without a notice", async () => {
		const closures = await queue()

		await closures.cancelQueuedClosure(ACQUISITION)
		await closures.cancelQueuedClosure(ACQUISITION)
		await closures.sendQueuedClosures(buffer, vi.fn())

		expect(await world.closures.list()).toEqual([])
		expect(world.refreshes).toBe(0)
		expect(await world.notices.listFor(OPERATOR)).toEqual([])
	})

	it("CAP-019-R29 a summary confirmed again replaces the earlier closure and its notice", async () => {
		const closures = await queue()
		world.fresh = draft({ wound_type_code: "burn" })
		await closures.sendQueuedClosures(buffer, vi.fn())
		expect(await world.notices.listFor(OPERATOR)).toHaveLength(1)

		await closures.queueClosure(await queuedClosureOf(world.fresh))

		expect(await world.notices.listFor(OPERATOR)).toEqual([])
		expect(await closures.queuedClosureIdsOf(OPERATOR)).toEqual(new Set([ACQUISITION]))
		expect(await closures.queuedClosureIdsOf(OTHER_USER)).toEqual(new Set())
	})
})
