import { ACQUISITION_KIND } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { openEncryptedDatabase } from "../encrypted-database"
import {
	closureNoticeIdOf,
	fileNoticeIdOf,
	QUEUE_NOTICE,
	type QueueNotice,
	SqlQueueNoticeRecords,
} from "../queue-notice"
import { type QueuedClosure, SqlQueuedClosureRecords } from "../queued-closure"
import { SerialSqlDatabase } from "../sql-database"
import { NodeSqlDatabase } from "./node-sql-database"

const DATABASE_KEY = "ab".repeat(32)
const ACQUISITION = "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10"
const OTHER_ACQUISITION = "1c7d2e63-7a1f-4b9f-8b54-1e7b1a2a7e21"
const OPERATOR = "5f3a9e1c-2b7d-4c55-8e0a-7d1b2c3e4f50"
const OTHER_OPERATOR = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a"

async function freshDatabase(): Promise<SerialSqlDatabase> {
	return new SerialSqlDatabase(
		await openEncryptedDatabase("queue", DATABASE_KEY, "/vault/queue", async () => new NodeSqlDatabase()),
	)
}

function closure(overrides: Partial<QueuedClosure> = {}): QueuedClosure {
	return {
		acquisitionId: ACQUISITION,
		operatorUserId: OPERATOR,
		operatorPersonalNumber: "12345",
		recordKind: ACQUISITION_KIND.PHOTO,
		fileKeys: ["file-a", "file-b"],
		contentFingerprint: "fingerprint-1",
		completedAt: "2026-10-19T08:00:00.000Z",
		...overrides,
	}
}

function notice(overrides: Partial<QueueNotice> = {}): QueueNotice {
	return {
		id: fileNoticeIdOf("file-a"),
		kind: QUEUE_NOTICE.FILE_REJECTED,
		operatorUserId: OPERATOR,
		acquisitionId: ACQUISITION,
		recordKind: ACQUISITION_KIND.PHOTO,
		capturedAt: "2026-10-19T07:58:00.000Z",
		rejectionCode: "record-rejected",
		createdAt: "2026-10-19T08:01:00.000Z",
		...overrides,
	}
}

describe("queued closure of a confirmed summary CAP-019-R29", () => {
	it("CAP-019-R10 keeps the record, its files in order, the fingerprint and the moment of confirmation", async () => {
		const closures = new SqlQueuedClosureRecords(await freshDatabase())

		await closures.put(closure())

		expect(await closures.find(ACQUISITION)).toEqual(closure())
		expect(await closures.list()).toEqual([closure()])
	})

	it("replaces the closure of a summary confirmed again", async () => {
		const closures = new SqlQueuedClosureRecords(await freshDatabase())
		await closures.put(closure())

		await closures.put(closure({ fileKeys: ["file-b"], contentFingerprint: "fingerprint-2" }))

		expect(await closures.list()).toEqual([closure({ fileKeys: ["file-b"], contentFingerprint: "fingerprint-2" })])
	})

	it("forgets a sent closure and leaves the others", async () => {
		const closures = new SqlQueuedClosureRecords(await freshDatabase())
		await closures.put(closure())
		await closures.put(closure({ acquisitionId: OTHER_ACQUISITION, recordKind: ACQUISITION_KIND.SCAN }))

		await closures.remove(ACQUISITION)

		expect(await closures.find(ACQUISITION)).toBeUndefined()
		expect(await closures.list()).toEqual([
			closure({ acquisitionId: OTHER_ACQUISITION, recordKind: ACQUISITION_KIND.SCAN }),
		])
	})
})

describe("queue notices for the operator CAP-019-R25", () => {
	it("gives each operator only the notices of their own items, oldest first", async () => {
		const notices = new SqlQueueNoticeRecords(await freshDatabase())
		const later = notice({ id: fileNoticeIdOf("file-b"), createdAt: "2026-10-19T08:05:00.000Z" })
		const others = notice({ id: fileNoticeIdOf("file-c"), operatorUserId: OTHER_OPERATOR })
		await notices.put(later)
		await notices.put(notice())
		await notices.put(others)

		expect(await notices.listFor(OPERATOR)).toEqual([notice(), later])
		expect(await notices.listFor(OTHER_OPERATOR)).toEqual([others])
	})

	it("keeps one notice per file, the latest one", async () => {
		const notices = new SqlQueueNoticeRecords(await freshDatabase())
		await notices.put(notice({ kind: QUEUE_NOTICE.FILE_SLOWED, rejectionCode: null }))

		await notices.put(notice())

		expect(await notices.listFor(OPERATOR)).toEqual([notice()])
	})

	it("keeps one notice per queued closure, and the acknowledged one goes away", async () => {
		const notices = new SqlQueueNoticeRecords(await freshDatabase())
		const changed = notice({
			id: closureNoticeIdOf(ACQUISITION),
			kind: QUEUE_NOTICE.CLOSURE_CHANGED,
			capturedAt: null,
			rejectionCode: null,
		})
		await notices.put(changed)
		await notices.put({ ...changed, kind: QUEUE_NOTICE.CLOSURE_FILE_REJECTED })

		expect(await notices.listFor(OPERATOR)).toEqual([{ ...changed, kind: QUEUE_NOTICE.CLOSURE_FILE_REJECTED }])

		await notices.remove(changed.id)

		expect(await notices.listFor(OPERATOR)).toEqual([])
	})
})
