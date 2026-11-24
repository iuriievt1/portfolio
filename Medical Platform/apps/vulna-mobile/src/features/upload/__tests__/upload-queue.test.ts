import { ERROR_CODE } from "@ansora/contracts"
import type { BufferedFile, SealedCopy, UploadRequest, UploadResult } from "@ansora/core-mobile"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CodedError } from "../../../../../../libs/core/mobile/src/__tests__/coded-error"
import { HPKE_SUITE } from "../../../../../../libs/core/mobile/src/native/hpke-envelope"
import { FakeCipher } from "../../../../../../libs/core/mobile/src/storage/__tests__/fake-cipher"
import { NodeSqlDatabase } from "../../../../../../libs/core/mobile/src/storage/__tests__/node-sql-database"
import { openEncryptedDatabase } from "../../../../../../libs/core/mobile/src/storage/encrypted-database"
import { EncryptedFileStore } from "../../../../../../libs/core/mobile/src/storage/encrypted-file-store"
import { SqlQueueNoticeRecords } from "../../../../../../libs/core/mobile/src/storage/queue-notice"
import { SqlQueuedClosureRecords } from "../../../../../../libs/core/mobile/src/storage/queued-closure"
import { SerialSqlDatabase } from "../../../../../../libs/core/mobile/src/storage/sql-database"
import { SqlStoredFileRecords } from "../../../../../../libs/core/mobile/src/storage/sql-stored-file-records"
import {
	FILE_EDIT,
	SqlBufferedFileRecords,
	SqlSealedCopyRecords,
	TransferBuffer,
} from "../../../../../../libs/core/mobile/src/storage/transfer-buffer"
import type { AcquisitionDraft } from "../../../api/acquisitions"

const ACQUISITION = "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10"
const OPERATOR = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
const OTHER_USER = "6e7f8a9b-0c1d-4e2f-8a3b-4c5d6e7f8a9b"
const SEALED_SHA256 = "ab".repeat(32)
const UNAUTHORIZED = 401
const TOO_MANY_REQUESTS = 429
const RETRY_AFTER_SECONDS = 30
const MILLISECONDS_PER_SECOND = 1000
const HALF_OF_RETRY_AFTER_MS = (RETRY_AFTER_SECONDS * MILLISECONDS_PER_SECOND) / 2
const DATABASE_KEY = "ab".repeat(32)
const CREATED = 201
const CONFLICT = 409
const UNAVAILABLE = 503
const UNPROCESSABLE = 422
const FIRST_RETRY_MS = 2000

type ServerStatus = "announced" | "received" | "rejected"

interface Announcement {
	token: string
	fileKey: string
	sha256: string
	operatorUserId: string | undefined
}

interface Grant {
	id: string
	permission: string
}

interface QueueReportCall {
	token: string
	report: { waiting: number; failed: number; oldest_acquired_at: string | null }
}

const world = vi.hoisted(() => ({
	cipher: undefined as unknown as FakeCipher,
	buffer: undefined as unknown as TransferBuffer,
	closures: undefined as unknown as SqlQueuedClosureRecords,
	notices: undefined as unknown as SqlQueueNoticeRecords,
	listeners: new Map<string, (result: UploadResult) => void>(),
	requests: [] as UploadRequest[],
	pending: [] as string[],
	results: [] as UploadResult[],
	serverStatus: new Map<string, ServerStatus>(),
	announcements: [] as Announcement[],
	replacedKeys: [] as (string | undefined)[],
	announceFailure: undefined as Error | undefined,
	sealFailure: undefined as Error | undefined,
	sessionUserId: undefined as string | undefined,
	replacements: [] as string[],
	replaceFailure: undefined as Error | undefined,
	draft: undefined as unknown as AcquisitionDraft,
	sealed: 0,
	announcesFiles: false,
	grants: [] as Grant[],
	receivedOnServer: new Map<string, string[]>(),
	queueStateTokens: [] as string[],
	queueStatePageSize: Number.POSITIVE_INFINITY,
	queueReports: [] as QueueReportCall[],
	closedRecords: [] as string[],
}))

vi.mock("@ansora/core-mobile", async () => ({
	...(await import("../../../../../../libs/core/mobile/src/storage/upload-status")),
	...(await import("../../../../../../libs/core/mobile/src/storage/transfer-buffer")),
	...(await import("../../../../../../libs/core/mobile/src/storage/queue-notice")),
	...(await import("../../../../../../libs/core/mobile/src/native/hpke-envelope")),
	...(await import("../../../../../../libs/core/mobile/src/native/upload-stage")),
	...(await import("../../../../../../libs/core/mobile/src/native/error-codes")),
	...(await import("../../../../../../libs/core/mobile/src/storage/encrypted-file-store")),
	backgroundQueue: () => ({
		announcesFiles: world.announcesFiles,
		grant: async (id: string, permission: string) => {
			world.grants.push({ id, permission })
		},
		addListener: (name: string, listener: (result: UploadResult) => void) => world.listeners.set(name, listener),
		upload: async (request: UploadRequest) => {
			for (const file of request.files) {
				if (!world.cipher.files.has(file.path)) {
					throw new Error(`The file to upload is not readable at ${file.path}`)
				}
			}
			world.requests.push(request)
			world.pending.push(request.id)
		},
		pending: async () => [...world.pending],
		takeResults: async () => world.results.splice(0),
	}),
	cryptoAndKeys: () => ({
		sha256Text: async (text: string) => `sha256(${text})`,
		sealForServer: async (): Promise<SealedCopy> => {
			if (world.sealFailure !== undefined) {
				throw world.sealFailure
			}
			world.sealed += 1
			const copy = world.cipher.sealedByModule(`sealed-${world.sealed}`)
			return { path: copy.path, enc: "enc", suite: HPKE_SUITE, serverKeyVersion: "1", sha256: SEALED_SHA256 }
		},
	}),
}))
vi.mock("../transfer-store", () => ({
	QUEUE: "queue",
	transferBuffer: async () => world.buffer,
	queuedClosures: async () => world.closures,
	queueNotices: async () => world.notices,
}))
vi.mock("../upload-announcement", () => ({
	uploadHeadersOf: (fileKey: string) => ({ "Idempotency-Key": fileKey }),
	permittedUploadHeadersOf: (fileKey: string, permission: string) => ({
		Authorization: `Bearer ${permission}`,
		"Idempotency-Key": fileKey,
	}),
	uploadAnnouncementOf: (file: {
		acquisitionId: string
		fileKey: string
		operatorUserId: string
		announcement: object
	}) => ({
		url: `https://vulna.example/api/v1/acquisitions/${file.acquisitionId}/files`,
		body: JSON.stringify(file.announcement),
		headers: { "Idempotency-Key": file.fileKey, "X-Vulna-Operator-Id": file.operatorUserId },
		verificationUrl: "https://vulna.example/api/v1/device/verification",
		verificationHeaders: {},
	}),
}))
vi.mock("../../session/session-store", () => ({
	currentSession: () => (world.sessionUserId === undefined ? undefined : { user: { id: world.sessionUserId } }),
}))
vi.mock("../../session/session-actions", () => ({
	sessionCaller: { call: <T>(work: (sessionToken: string) => Promise<T>) => work("session-token") },
}))
vi.mock("../../device/device-events", () => ({ recordDeviceEvents: vi.fn(), sendPendingDeviceEvents: vi.fn() }))
vi.mock("../local-copy-retention", () => ({ localCopyRetentionSeconds: async () => undefined }))
vi.mock("../../device/device-caller", () => ({
	deviceCaller: { call: <T>(work: (deviceToken: string) => Promise<T>) => work("device-token") },
}))
vi.mock("../../../api/device", () => ({ deviceApi: { verifyDevice: async () => ({ state: "approved" }) } }))
vi.mock("../../session/effective-configuration-store", () => ({
	effectiveConfiguration: () => ({ server_hpke_key: { server_key_version: "1", public_key: "server-key" } }),
}))
vi.mock("../../../api/client", () => ({
	apiUrlOf: (path: string) => `https://vulna.example/api/v1${path}`,
}))
vi.mock("../../../api/acquisition-files", () => ({
	uploadPathOf: (acquisitionId: string, collection: string) => `/acquisitions/${acquisitionId}/${collection}`,
	acquisitionFileApi: {
		announceAcquisitionFile: async (
			token: string,
			_acquisitionId: string,
			fileKey: string,
			announcement: { sha256: string; replaces_file_key?: string },
			operatorUserId: string | undefined,
		) => {
			world.announcements.push({ token, fileKey, sha256: announcement.sha256, operatorUserId })
			world.replacedKeys.push(announcement.replaces_file_key)
			if (world.announceFailure !== undefined) {
				throw world.announceFailure
			}
			return {
				file: { file_key: fileKey, sequence: 1, status: world.serverStatus.get(fileKey) ?? "announced" },
				upload_permission: `permission-${fileKey}-${world.announcements.length}`,
				upload_permission_expires_at: "2026-10-15T08:00:00Z",
			}
		},
		replaceAcquisitionFile: async (_token: string, _draft: AcquisitionDraft, fileKey: string) => {
			if (world.replaceFailure !== undefined) {
				throw world.replaceFailure
			}
			world.replacements.push(fileKey)
			return { file_key: fileKey, sequence: 1, status: "received" }
		},
	},
}))
vi.mock("../../../api/queue", () => ({
	queueApi: {
		getQueueState: async (token: string, _limit: number, cursor: string | undefined) => {
			world.queueStateTokens.push(token)
			const items = [...world.receivedOnServer].map(([acquisitionId, fileKeys]) => ({
				idempotency_key: acquisitionId,
				acquisition_id: acquisitionId,
				state: "draft",
				received_file_keys: fileKeys,
			}))
			const start = cursor === undefined ? 0 : Number(cursor)
			const end = start + world.queueStatePageSize
			return { items: items.slice(start, end), next_cursor: end < items.length ? String(end) : null }
		},
		reportQueueState: async (token: string, report: QueueReportCall["report"]) => {
			world.queueReports.push({ token, report })
		},
	},
}))
vi.mock("../../../api/acquisitions", () => ({
	acquisitionApi: {
		getAcquisitionDraft: async () => world.draft,
		closeAcquisition: async (_token: string, closed: AcquisitionDraft) => {
			world.closedRecords.push(closed.acquisition_id)
			return {}
		},
	},
}))
vi.mock("../../capture/draft-update", () => ({
	knownDraft: async () => world.draft,
	refreshDraft: async () => world.draft,
}))

function draft(): AcquisitionDraft {
	return {
		acquisition_id: ACQUISITION,
		idempotency_key: "5f3a9e1c-2b7d-4c55-8e0a-7d1b2c3e4f50",
		state: "draft",
		kind: "photo",
		patient: { patient_id: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a" } as AcquisitionDraft["patient"],
		operator_user_id: OPERATOR,
		started_at: "2026-10-08T09:00:00Z",
		updated_at: "2026-10-08T09:05:00Z",
		version: 3,
		files: [],
	}
}

async function freshWorld(): Promise<void> {
	const opened = await openEncryptedDatabase("queue", DATABASE_KEY, "/vault/queue", async () => new NodeSqlDatabase())
	const db = new SerialSqlDatabase(opened)
	world.cipher = new FakeCipher()
	world.buffer = new TransferBuffer(
		new EncryptedFileStore("queue", world.cipher, new SqlStoredFileRecords(db)),
		new SqlBufferedFileRecords(db),
		new SqlSealedCopyRecords(db),
	)
	world.closures = new SqlQueuedClosureRecords(db)
	world.notices = new SqlQueueNoticeRecords(db)
	world.listeners.clear()
	world.requests = []
	world.pending = []
	world.results = []
	world.serverStatus.clear()
	world.announcements = []
	world.replacedKeys = []
	world.announceFailure = undefined
	world.sealFailure = undefined
	world.sessionUserId = OPERATOR
	world.replacements = []
	world.replaceFailure = undefined
	world.draft = draft()
	world.sealed = 0
	world.announcesFiles = false
	world.grants = []
	world.receivedOnServer.clear()
	world.queueStateTokens = []
	world.queueStatePageSize = Number.POSITIVE_INFINITY
	world.queueReports = []
	world.closedRecords = []
}

async function photo(fileKey: string): Promise<BufferedFile> {
	return await world.buffer.addPhoto(
		{ fileKey, acquisitionId: ACQUISITION, operatorUserId: OPERATOR },
		{
			image: world.cipher.sealedByModule(fileKey),
			thumbnail: world.cipher.sealedByModule(`${fileKey}-thumbnail`),
			width: 1,
			height: 1,
		},
	)
}

async function startedQueue() {
	const queue = await import("../upload-queue")
	queue.startUploadQueue()
	return queue
}

function answer(fileKey: string, status: number, code?: string): UploadResult {
	world.pending = world.pending.filter((pending) => pending !== fileKey)
	const body = code === undefined ? null : JSON.stringify({ code })
	return { id: fileKey, stage: "upload", status, body, failure: null, code: null }
}

function receipt(fileKey: string, status: ServerStatus): UploadResult {
	world.pending = world.pending.filter((pending) => pending !== fileKey)
	const body = JSON.stringify({ file: { file_key: fileKey, sequence: 1, status } })
	return { id: fileKey, stage: "announcement", status: CREATED, body, failure: null, code: null }
}

function finish(fileKey: string, status: number, code?: string): void {
	world.listeners.get("uploadFinished")?.(answer(fileKey, status, code))
}

async function stateOf(fileKey: string) {
	return await world.buffer.find(fileKey)
}

function sealedCopiesLeft(): string[] {
	return [...world.cipher.files.keys()].filter((path) => path.includes("sealed"))
}

beforeEach(async () => {
	vi.resetModules()
	await freshWorld()
})

afterEach(() => {
	vi.useRealTimers()
})

describe("upload queue", () => {
	it("CAP-019-R24 CAP-009-R13 sends a waiting file and takes it as received only on the answer of the server", async () => {
		await photo("a")
		await startedQueue()

		await vi.waitFor(() => expect(world.requests.map((request) => request.id)).toEqual(["a"]))
		expect((await stateOf("a"))?.uploadState).toBe("uploading")
		finish("a", CREATED)

		await vi.waitFor(async () => expect((await stateOf("a"))?.uploadState).toBe("received"))
		expect(sealedCopiesLeft()).toEqual([])
	})

	it("CAP-019-R13 CAP-019-R18 sends a file again after the server was busy", async () => {
		vi.useFakeTimers()
		await photo("a")
		await startedQueue()
		await vi.waitFor(() => expect(world.requests).toHaveLength(1))

		finish("a", UNAVAILABLE)
		await vi.waitFor(async () => expect((await stateOf("a"))?.uploadState).toBe("waiting"))
		await vi.advanceTimersByTimeAsync(FIRST_RETRY_MS)

		await vi.waitFor(() => expect(world.requests).toHaveLength(2))
	})

	it("CAP-019-R14 CAP-019-S18 keeps a refused file as failed with its code and never sends it again", async () => {
		vi.useFakeTimers()
		await photo("a")
		await startedQueue()
		await vi.waitFor(() => expect(world.requests).toHaveLength(1))

		finish("a", CONFLICT, ERROR_CODE.ACQUISITION_ALREADY_DECIDED)
		await vi.waitFor(async () =>
			expect(await stateOf("a")).toMatchObject({
				uploadState: "rejected",
				rejectionCode: "acquisition-already-decided",
			}),
		)
		await vi.advanceTimersByTimeAsync(FIRST_RETRY_MS * 100)

		expect(world.requests).toHaveLength(1)
	})

	it("NAB-503 CAP-007-R11 stops the queue on a revoked device without marking the file failed", async () => {
		await photo("a")
		await photo("b")
		await startedQueue()
		await vi.waitFor(() => expect(world.requests).toHaveLength(2))

		finish("a", 403, ERROR_CODE.DEVICE_REVOKED)

		await vi.waitFor(async () => expect((await stateOf("a"))?.uploadState).toBe("waiting"))
		await photo("c")
		const queue = await import("../upload-queue")
		queue.pumpUploads()
		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(world.requests).toHaveLength(2)
	})

	it("CAP-019-R24 takes over a result the app missed while it was asleep", async () => {
		await photo("a")
		const queue = await startedQueue()
		await vi.waitFor(() => expect(world.requests).toHaveLength(1))

		world.results.push(answer("a", CREATED))
		queue.catchUpUploads()

		await vi.waitFor(async () => expect((await stateOf("a"))?.uploadState).toBe("received"))
	})

	it("CAP-009-R13 ignores a stale result of an earlier attempt", async () => {
		await photo("a")
		await startedQueue()
		await vi.waitFor(() => expect(world.requests).toHaveLength(1))
		finish("a", CREATED)
		await vi.waitFor(async () => expect((await stateOf("a"))?.uploadState).toBe("received"))

		finish("a", UNAVAILABLE)
		await new Promise((resolve) => setTimeout(resolve, 50))

		expect((await stateOf("a"))?.uploadState).toBe("received")
		expect(world.requests).toHaveLength(1)
	})

	it("CAP-015-R35 takes over the answer of the server to an announcement of a file it already has", async () => {
		await photo("a")
		world.serverStatus.set("a", "received")

		await startedQueue()

		await vi.waitFor(async () => expect((await stateOf("a"))?.uploadState).toBe("received"))
		expect(world.requests).toEqual([])
	})

	it("CAP-015-S56 sends the edit of a received file as a replacement", async () => {
		const sent = await photo("a")
		await world.buffer.markReceived("a", sent.contentFileId)
		await world.buffer.replacePhoto("a", turned(), FILE_EDIT.ROTATION)

		await startedQueue()

		await vi.waitFor(() => expect(world.replacements).toEqual(["a"]))
		await vi.waitFor(async () => expect((await stateOf("a"))?.receivedContentFileId).toBe("/vault/queue/a-turned"))
		expect(sealedCopiesLeft()).toEqual([])
	})

	it("CAP-015-R34 E115 keeps a received file received when the server refuses its edit", async () => {
		const sent = await photo("a")
		await world.buffer.markReceived("a", sent.contentFileId)
		await world.buffer.replacePhoto("a", turned(), FILE_EDIT.ROTATION)
		const { ApiProblemError } = await import("../../../api/api-error")
		world.replaceFailure = new ApiProblemError(422, ERROR_CODE.RECORD_REJECTED)

		await startedQueue()

		await vi.waitFor(async () =>
			expect(await stateOf("a")).toMatchObject({
				uploadState: "received",
				rejectionCode: "record-rejected",
				editFailedContentFileId: "/vault/queue/a-turned",
			}),
		)
	})

	it("ADR-014 announces the fingerprint of the sealed file and hands the upload over with its permission", async () => {
		await photo("a")
		await startedQueue()

		await vi.waitFor(() => expect(world.requests).toHaveLength(1))
		expect(world.announcements).toEqual([
			{ token: "session-token", fileKey: "a", sha256: SEALED_SHA256, operatorUserId: undefined },
		])
		expect(world.requests[0]?.headers).toEqual({ Authorization: "Bearer permission-a-1", "Idempotency-Key": "a" })
	})

	it("CAP-009-R13 discards the sealed copies as soon as the system has the upload", async () => {
		await photo("a")
		await startedQueue()

		await vi.waitFor(() => expect(world.requests).toHaveLength(1))

		await vi.waitFor(() => expect(sealedCopiesLeft()).toEqual([]))
		expect((await stateOf("a"))?.uploadState).toBe("uploading")
	})

	it("CAP-019-S05 sends the file of a signed out operator under the device token", async () => {
		world.sessionUserId = undefined
		await photo("a")

		await startedQueue()

		await vi.waitFor(() => expect(world.requests).toHaveLength(1))
		expect(world.announcements[0]).toMatchObject({ token: "device-token", operatorUserId: OPERATOR })
	})

	it("CAP-002-R13 CAP-019-R04 keeps sending the files of the previous user after another user signed in", async () => {
		world.sessionUserId = OTHER_USER
		await photo("a")

		await startedQueue()

		await vi.waitFor(() => expect(world.requests).toHaveLength(1))
		expect(world.announcements[0]).toMatchObject({ token: "device-token", operatorUserId: OPERATOR })
	})

	it("CAP-015-R34 keeps the edit of a file until its operator signs in", async () => {
		const sent = await photo("a")
		await world.buffer.markReceived("a", sent.contentFileId)
		await world.buffer.replacePhoto("a", turned(), FILE_EDIT.ROTATION)
		world.sessionUserId = OTHER_USER

		await startedQueue()
		await new Promise((resolve) => setTimeout(resolve, 50))

		expect(world.replacements).toEqual([])
	})

	it("ADR-014 announces the file again after the server refused an expired permission", async () => {
		vi.useFakeTimers()
		await photo("a")
		await startedQueue()
		await vi.waitFor(() => expect(world.requests).toHaveLength(1))

		finish("a", UNAUTHORIZED, ERROR_CODE.SIGN_IN_AGAIN)
		await vi.waitFor(async () => expect((await stateOf("a"))?.uploadState).toBe("waiting"))
		await vi.advanceTimersByTimeAsync(FIRST_RETRY_MS)

		await vi.waitFor(() => expect(world.requests).toHaveLength(2))
		expect(world.requests[1]?.headers.Authorization).toBe("Bearer permission-a-2")
	})

	it("CAP-019-R13 RFC 9110 pauses the whole queue for the time the server asked", async () => {
		vi.useFakeTimers()
		const { ApiProblemError } = await import("../../../api/api-error")
		world.announceFailure = new ApiProblemError(TOO_MANY_REQUESTS, ERROR_CODE.RETRY, RETRY_AFTER_SECONDS)
		await photo("a")
		await photo("b")
		await startedQueue()
		await vi.waitFor(() => expect(world.announcements).toHaveLength(1))

		world.announceFailure = undefined
		await vi.advanceTimersByTimeAsync(HALF_OF_RETRY_AFTER_MS)
		expect(world.announcements).toHaveLength(1)
		await vi.advanceTimersByTimeAsync(HALF_OF_RETRY_AFTER_MS)

		await vi.waitFor(() => expect(world.requests.map((request) => request.id)).toEqual(["a", "b"]))
	})

	it("CAP-009-R13 seals a file once across the retries of its announcement", async () => {
		vi.useFakeTimers()
		const { ApiProblemError } = await import("../../../api/api-error")
		world.announceFailure = new ApiProblemError(UNAVAILABLE, ERROR_CODE.RETRY)
		await photo("a")
		await startedQueue()
		await vi.waitFor(() => expect(world.announcements).toHaveLength(1))
		const sealedOnce = world.sealed

		world.announceFailure = undefined
		await vi.advanceTimersByTimeAsync(FIRST_RETRY_MS)

		await vi.waitFor(() => expect(world.requests).toHaveLength(1))
		expect(world.announcements).toHaveLength(2)
		expect(world.sealed).toBe(sealedOnce)
		expect(sealedCopiesLeft()).toEqual([])
	})

	it("CAP-009-R13 CAP-019-R14 discards the kept seal when the server refuses the file for good", async () => {
		const { ApiProblemError } = await import("../../../api/api-error")
		world.announceFailure = new ApiProblemError(UNPROCESSABLE, ERROR_CODE.RECORD_REJECTED)
		await photo("a")

		await startedQueue()

		await vi.waitFor(async () => expect((await stateOf("a"))?.uploadState).toBe("rejected"))
		expect(sealedCopiesLeft()).toEqual([])
	})

	it("CAP-015-R35 CAP-019-R24 takes over receipts and the order the server leads", async () => {
		await photo("a")
		await photo("b")
		world.pending = []
		const queue = await import("../upload-queue")

		const local = await queue.reconcileFiles(ACQUISITION, [
			{ file_key: "a", sequence: 2, status: "received" },
			{ file_key: "b", sequence: 1, status: "received" },
		])

		expect(local.map((file) => [file.fileKey, file.uploadState])).toEqual([
			["b", "received"],
			["a", "received"],
		])
	})

	it("CAP-015-R18 CAP-021-R32 forgets a received file that was removed from the record on another device", async () => {
		await photo("a")
		await photo("b")
		world.pending = []
		const queue = await import("../upload-queue")
		await queue.reconcileFiles(ACQUISITION, [
			{ file_key: "a", sequence: 1, status: "received" },
			{ file_key: "b", sequence: 2, status: "received" },
		])

		const local = await queue.reconcileFiles(ACQUISITION, [{ file_key: "a", sequence: 1, status: "received" }])

		expect(local.map((file) => file.fileKey)).toEqual(["a"])
		expect(await stateOf("b")).toBeUndefined()
	})
})

describe("upload queue whose system announces files in the background", () => {
	beforeEach(() => {
		world.announcesFiles = true
	})

	it("ADR-014 CAP-019-R32 hands a file over before announcing it and grants the permission of the session", async () => {
		const { SESSION_ANNOUNCEMENT_GRACE_MS } = await import("../upload-queue")
		await photo("a")

		await startedQueue()

		await vi.waitFor(() => expect(world.grants).toEqual([{ id: "a", permission: "permission-a-1" }]))
		expect(world.requests).toHaveLength(1)
		expect(world.requests[0]).toMatchObject({
			headers: { "Idempotency-Key": "a" },
			delayMs: SESSION_ANNOUNCEMENT_GRACE_MS,
			announcement: {
				body: JSON.stringify({ file_kind: "image", sha256: SEALED_SHA256 }),
				headers: { "Idempotency-Key": "a", "X-Vulna-Operator-Id": OPERATOR },
			},
		})
		expect(world.announcements).toEqual([
			{ token: "session-token", fileKey: "a", sha256: SEALED_SHA256, operatorUserId: undefined },
		])
		expect((await stateOf("a"))?.uploadState).toBe("uploading")
		expect(sealedCopiesLeft()).toEqual([])
	})

	it("CAP-019-S05 CAP-002-R09 leaves the file of a signed out operator to the system at once", async () => {
		world.sessionUserId = undefined
		await photo("a")

		await startedQueue()

		await vi.waitFor(() => expect(world.requests).toHaveLength(1))
		expect(world.requests[0]?.delayMs).toBe(0)
		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(world.announcements).toEqual([])
		expect(world.grants).toEqual([])
	})

	it("CAP-019-R32 NAB-205 keeps the file with the system when the session cannot announce it", async () => {
		const { ApiProblemError } = await import("../../../api/api-error")
		world.announceFailure = new ApiProblemError(UNAVAILABLE, ERROR_CODE.RETRY)
		await photo("a")

		await startedQueue()

		await vi.waitFor(() => expect(world.announcements).toHaveLength(1))
		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(world.requests).toHaveLength(1)
		expect(world.grants).toEqual([])
		expect((await stateOf("a"))?.uploadState).toBe("uploading")
	})

	it("CAP-019-R13 NAB-412 keeps handing files over while the server asks to wait", async () => {
		const { ApiProblemError } = await import("../../../api/api-error")
		world.announceFailure = new ApiProblemError(TOO_MANY_REQUESTS, ERROR_CODE.RETRY, RETRY_AFTER_SECONDS)
		await photo("a")
		await photo("b")

		await startedQueue()

		await vi.waitFor(() => expect(world.requests.map((request) => request.id)).toEqual(["a", "b"]))
		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(world.announcements.map((announcement) => announcement.fileKey)).toEqual(["a"])
	})

	it("CAP-015-R35 takes over the receipt the system got for a file the server already has", async () => {
		world.sessionUserId = undefined
		await photo("a")
		const queue = await startedQueue()
		await vi.waitFor(() => expect(world.requests).toHaveLength(1))

		world.results.push(receipt("a", "received"))
		queue.catchUpUploads()

		await vi.waitFor(async () => expect((await stateOf("a"))?.uploadState).toBe("received"))
	})

	it("CAP-015-R36 CAP-019-R14 takes over the receipt of a file the server refused", async () => {
		world.sessionUserId = undefined
		await photo("a")
		await startedQueue()
		await vi.waitFor(() => expect(world.requests).toHaveLength(1))

		world.listeners.get("uploadFinished")?.(receipt("a", "rejected"))

		await vi.waitFor(async () => expect((await stateOf("a"))?.uploadState).toBe("rejected"))
	})
})

function turned() {
	return {
		image: world.cipher.sealedByModule("a-turned"),
		thumbnail: world.cipher.sealedByModule("a-turned-thumbnail"),
		width: 1,
		height: 1,
	}
}

describe("state of the queue on the device CAP-019-R08", () => {
	it("CAP-019-R12 CAP-019-R24 CAP-019-R30 takes a file the server already has as received instead of sending it again", async () => {
		await photo("a")
		await photo("b")
		world.receivedOnServer.set(ACQUISITION, ["a"])

		await startedQueue()

		await vi.waitFor(() => expect(world.requests.map((request) => request.id)).toEqual(["b"]))
		expect((await stateOf("a"))?.uploadState).toBe("received")
		expect(world.queueStateTokens).toEqual(["session-token"])
	})

	it("CAP-019-R24 CAP-019-R30 reads further pages of the queue state while a file still waits for the server", async () => {
		await photo("a")
		world.receivedOnServer.set("4d3c2b1a-0f9e-4d8c-8b7a-6f5e4d3c2b1a", ["x"])
		world.receivedOnServer.set(ACQUISITION, ["a"])
		world.queueStatePageSize = 1

		await startedQueue()

		await vi.waitFor(async () => expect((await stateOf("a"))?.uploadState).toBe("received"))
		expect(world.queueStateTokens).toEqual(["session-token", "session-token"])
	})

	it("CAP-019-R08 reports the waiting files and the oldest of them before sending the queue", async () => {
		await photo("a")

		await startedQueue()

		await vi.waitFor(() => expect(world.queueReports).toHaveLength(1))
		const [call] = world.queueReports
		expect(call?.report).toMatchObject({ waiting: 1, failed: 0 })
		expect(call?.report.oldest_acquired_at).toBe((await stateOf("a"))?.capturedAt)
	})

	it("CAP-007-S08 reports an empty queue too, without asking the server about records", async () => {
		await startedQueue()

		await vi.waitFor(() =>
			expect(world.queueReports).toEqual([
				{
					token: "session-token",
					report: expect.objectContaining({ waiting: 0, failed: 0, oldest_acquired_at: null }),
				},
			]),
		)
		expect(world.queueStateTokens).toEqual([])
	})

	it("CAP-002-R09 CAP-019-S05 reports under the device token after the session ended", async () => {
		world.sessionUserId = undefined
		await photo("a")

		await startedQueue()

		await vi.waitFor(() => expect(world.queueReports.map((call) => call.token)).toEqual(["device-token"]))
		expect(world.queueStateTokens).toEqual(["device-token"])
	})
})

describe("upload queue and the operator CAP-019-R25", () => {
	it("CAP-019-S10 notes a file the server refused for its operator", async () => {
		await photo("a")
		await startedQueue()
		await vi.waitFor(() => expect(world.requests).toHaveLength(1))

		finish("a", UNPROCESSABLE, ERROR_CODE.RECORD_REJECTED)

		await vi.waitFor(async () =>
			expect(await world.notices.listFor(OPERATOR)).toMatchObject([
				{ id: "file:a", kind: "file_rejected", rejectionCode: ERROR_CODE.RECORD_REJECTED },
			]),
		)
	})

	it("CAP-019-R18 notes a slowed upload once and forgets it when the server receives the file", async () => {
		vi.useFakeTimers()
		await photo("a")
		await startedQueue()
		for (const [attempt, delay] of [2000, 5000, 10_000, 30_000].entries()) {
			await vi.waitFor(() => expect(world.requests).toHaveLength(attempt + 1))
			finish("a", UNAVAILABLE)
			await vi.waitFor(async () => expect((await stateOf("a"))?.uploadState).toBe("waiting"))
			await vi.advanceTimersByTimeAsync(delay)
		}
		expect(await world.notices.listFor(OPERATOR)).toEqual([])

		await vi.waitFor(() => expect(world.requests).toHaveLength(5))
		finish("a", UNAVAILABLE)
		await vi.waitFor(async () =>
			expect(await world.notices.listFor(OPERATOR)).toMatchObject([{ id: "file:a", kind: "file_slowed" }]),
		)
		await vi.advanceTimersByTimeAsync(60_000)
		await vi.waitFor(() => expect(world.requests).toHaveLength(6))
		finish("a", CREATED)

		await vi.waitFor(async () => expect(await world.notices.listFor(OPERATOR)).toEqual([]))
	})

	it("CAP-009-S05 Q-076 keeps a file it cannot read, never sends it and tells its operator", async () => {
		vi.useFakeTimers()
		world.sealFailure = new CodedError("file-key-invalid")
		await photo("a")
		await startedQueue()

		await vi.waitFor(async () => expect((await stateOf("a"))?.uploadState).toBe("unreadable"))
		expect(await world.notices.listFor(OPERATOR)).toMatchObject([{ id: "file:a", kind: "file_unreadable" }])
		world.sealFailure = undefined
		await vi.advanceTimersByTimeAsync(FIRST_RETRY_MS * 100)
		expect(world.requests).toEqual([])
		expect(world.cipher.files.has("/vault/queue/a")).toBe(true)
	})

	it("CAP-009-S05 CAP-019-R29 Q-076 drops the closure of a record whose file cannot be read and tells why", async () => {
		world.sealFailure = new CodedError("file-unavailable")
		await world.closures.put({
			acquisitionId: ACQUISITION,
			operatorUserId: OPERATOR,
			operatorPersonalNumber: "12345",
			recordKind: "photo",
			fileKeys: ["a"],
			contentFingerprint: "content-1",
			completedAt: "2026-10-19T09:00:00.000Z",
		})
		await photo("a")
		await startedQueue()

		await vi.waitFor(async () =>
			expect(await world.notices.listFor(OPERATOR)).toMatchObject([
				{ id: `closure:${ACQUISITION}`, kind: "closure_file_unreadable" },
			]),
		)
		expect(await world.closures.list()).toEqual([])
	})

	it("CAP-015-R34 E115 Q-076 keeps the server version of a received file whose edit cannot be read", async () => {
		const sent = await photo("a")
		await world.buffer.markReceived("a", sent.contentFileId)
		await world.buffer.replacePhoto("a", turned(), FILE_EDIT.ROTATION)
		world.sealFailure = new CodedError("file-key-invalid")

		await startedQueue()

		await vi.waitFor(async () =>
			expect(await stateOf("a")).toMatchObject({
				uploadState: "received",
				editFailedContentFileId: "/vault/queue/a-turned",
			}),
		)
		expect(world.replacements).toEqual([])
	})

	it("CAP-015-R36 CAP-019-S12 announces the new photo as the replacement of the rejected one", async () => {
		await photo("a")
		await world.buffer.markRejected("a", ERROR_CODE.RECORD_REJECTED)
		await world.buffer.addPhoto(
			{ fileKey: "n", acquisitionId: ACQUISITION, operatorUserId: OPERATOR },
			{
				image: world.cipher.sealedByModule("n"),
				thumbnail: world.cipher.sealedByModule("n-thumbnail"),
				width: 1,
				height: 1,
			},
			"a",
		)

		await startedQueue()

		await vi.waitFor(() => expect(world.announcements.map((announcement) => announcement.fileKey)).toEqual(["n"]))
		expect(world.replacedKeys).toEqual(["a"])
	})

	it("CAP-019-S20 CAP-019-R29 closes a record whose summary waited for its last file", async () => {
		const { contentFingerprintOf } = await import("../../summary/confirmed-content")
		world.draft = { ...draft(), files: [{ file_key: "a", sequence: 1, status: "received" }] }
		await world.closures.put({
			acquisitionId: ACQUISITION,
			operatorUserId: OPERATOR,
			operatorPersonalNumber: "12345",
			recordKind: "photo",
			fileKeys: ["a"],
			contentFingerprint: await contentFingerprintOf(world.draft),
			completedAt: "2026-10-19T09:00:00.000Z",
		})
		await photo("a")
		await startedQueue()
		await vi.waitFor(() => expect(world.requests).toHaveLength(1))
		expect(world.closedRecords).toEqual([])

		finish("a", CREATED)

		await vi.waitFor(() => expect(world.closedRecords).toEqual([ACQUISITION]))
		expect(await world.closures.list()).toEqual([])
	})
})
