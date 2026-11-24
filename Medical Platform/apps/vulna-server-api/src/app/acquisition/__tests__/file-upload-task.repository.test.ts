import { ACQUISITION_KIND } from "@ansora/contracts"
import { JOB_KIND, JOB_OBJECT_KIND, JOB_STATE } from "@ansora/core-server"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import { FileUploadTaskRepository } from "../repositories/file-upload-task.repository"

const FILE_A = "f0000000-0000-4000-8000-00000000000a"
const FILE_B = "f0000000-0000-4000-8000-00000000000b"
const TASK_COLUMNS = ["id", "kind", "object_kind", "object_id", "state"]
const OPEN_TASK_CONFLICT = "ON CONFLICT (kind, object_kind, object_id) WHERE state IN ('waiting', 'running') DO NOTHING"

interface QueuedTaskRow {
	id: string
	kind: string
	object_kind: string
	object_id: string
	state: string
}

interface RowsHelper {
	rows: readonly QueuedTaskRow[]
	columns: unknown[]
}

interface RecordedQuery {
	text: string
	values: unknown[]
}

function isTemplate(value: unknown): value is TemplateStringsArray {
	return Array.isArray(value) && Object.hasOwn(value, "raw")
}

function recordingTransaction() {
	const queries: RecordedQuery[] = []
	const tx = (first: unknown, ...rest: unknown[]): Promise<unknown[]> | RowsHelper => {
		if (!isTemplate(first)) {
			return { rows: first as readonly QueuedTaskRow[], columns: rest }
		}
		queries.push({ text: first.join("?").replace(/\s+/g, " ").trim(), values: rest })
		return Promise.resolve([])
	}
	return { tx: tx as unknown as postgres.TransactionSql, queries }
}

function insertedOf(queries: readonly RecordedQuery[]): RowsHelper {
	const [insert] = queries
	if (insert === undefined) {
		throw new Error("no task was inserted")
	}
	return insert.values[0] as RowsHelper
}

function withoutIds(rows: readonly QueuedTaskRow[]): Omit<QueuedTaskRow, "id">[] {
	return rows.map(({ id: _id, ...row }) => row)
}

// datovy-model.md 4, ADR-016
describe("upload tasks of a closed record", () => {
	it("CAP-021-R36 CAP-021-R40 queues the viewing copy before the upload of every photo, file by file", async () => {
		const run = recordingTransaction()

		await new FileUploadTaskRepository().enqueue(run.tx, ACQUISITION_KIND.PHOTO, [FILE_A, FILE_B])

		const inserted = insertedOf(run.queries)
		expect(run.queries).toHaveLength(1)
		expect(inserted.columns).toEqual(TASK_COLUMNS)
		expect(withoutIds(inserted.rows)).toEqual([
			{
				kind: JOB_KIND.CLINICAL_RECORD_VIEWING_COPY,
				object_kind: JOB_OBJECT_KIND.IMAGE,
				object_id: FILE_A,
				state: JOB_STATE.WAITING,
			},
			{
				kind: JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD,
				object_kind: JOB_OBJECT_KIND.IMAGE,
				object_id: FILE_A,
				state: JOB_STATE.WAITING,
			},
			{
				kind: JOB_KIND.CLINICAL_RECORD_VIEWING_COPY,
				object_kind: JOB_OBJECT_KIND.IMAGE,
				object_id: FILE_B,
				state: JOB_STATE.WAITING,
			},
			{
				kind: JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD,
				object_kind: JOB_OBJECT_KIND.IMAGE,
				object_id: FILE_B,
				state: JOB_STATE.WAITING,
			},
		])
		expect(new Set(inserted.rows.map((row) => row.id)).size).toBe(inserted.rows.length)
	})

	it("CAP-021-R40 queues the pages of a scanned document as document pages", async () => {
		const run = recordingTransaction()

		await new FileUploadTaskRepository().enqueue(run.tx, ACQUISITION_KIND.SCAN, [FILE_A])

		expect(withoutIds(insertedOf(run.queries).rows)).toEqual([
			{
				kind: JOB_KIND.CLINICAL_RECORD_VIEWING_COPY,
				object_kind: JOB_OBJECT_KIND.DOCUMENT_PAGE,
				object_id: FILE_A,
				state: JOB_STATE.WAITING,
			},
			{
				kind: JOB_KIND.CLINICAL_RECORD_BINARY_UPLOAD,
				object_kind: JOB_OBJECT_KIND.DOCUMENT_PAGE,
				object_id: FILE_A,
				state: JOB_STATE.WAITING,
			},
		])
	})

	it("CAP-021-R36 leaves the open task of the same file and job in place", async () => {
		const run = recordingTransaction()

		await new FileUploadTaskRepository().enqueue(run.tx, ACQUISITION_KIND.PHOTO, [FILE_A])

		expect(run.queries[0]?.text).toContain(OPEN_TASK_CONFLICT)
	})

	it("queues nothing for a record without files", async () => {
		const run = recordingTransaction()

		await new FileUploadTaskRepository().enqueue(run.tx, ACQUISITION_KIND.PHOTO, [])

		expect(run.queries).toEqual([])
	})
})
