import { createHash, randomUUID } from "node:crypto"
import type { QueueDatabase } from "@ansora/core-server"
import postgres from "@veevoy/postgres"
import type { DatabaseService } from "../../../libs/database/database.service"

const DATABASE_URL_VARIABLE = "WORKER_SQL_TEST_DATABASE_URL"
// ADR-005 ř. 37, NAB-464
const WORKER_ROLE = "vulna_worker"
export const ENCOUNTER_RESOURCE_ID = "encounter-resource-1"

export interface StoredObject {
	id: string
	sizeBytes: number
	sha256: string
}

export interface RecordedPhoto {
	acquisitionId: string
	encounterId: string
	imageId: string
	original: StoredObject
	thumbnail: StoredObject
}

export interface RecordedPage {
	documentId: string
	pageId: string
	original: StoredObject
	thumbnail: StoredObject
}

export interface QueueTaskRow {
	id: string
	state: string
	attempts: number
	unknown_outcomes: number
	locked_by: string | null
	run_after: Date
	locked_until: Date | null
}

interface NewTask {
	kind: string
	objectKind: string
	objectId: string
	state: string
	runAfterSeconds: number
	lockedBy?: string
	lockedUntilSeconds?: number
}

type Transaction = postgres.TransactionSql

class RolledBack extends Error {}

function requiredDatabaseUrl(): string {
	const url = process.env[DATABASE_URL_VARIABLE]
	if (url === undefined || url === "") {
		throw new Error(`the SQL test of the worker needs ${DATABASE_URL_VARIABLE}`)
	}
	return url
}

export const administrator = postgres(requiredDatabaseUrl(), { max: 1, onnotice: () => undefined })

export function workerSessions(count: number): postgres.Sql {
	return postgres(requiredDatabaseUrl(), { max: count, onnotice: () => undefined })
}

export function databaseOf(tx: Transaction): DatabaseService & QueueDatabase {
	return { sql: tx as unknown as postgres.Sql } as DatabaseService & QueueDatabase
}

export async function becomeWorker(tx: Transaction): Promise<void> {
	await tx`SET LOCAL ROLE ${tx(WORKER_ROLE)}`
	const [row] = await tx<{ role: string }[]>`SELECT current_user AS role`
	if (row?.role !== WORKER_ROLE) {
		throw new Error(`the SQL test runs as ${row?.role}, not as ${WORKER_ROLE}`)
	}
}

// ADR-021
export async function rolledBack(work: (tx: Transaction) => Promise<void>): Promise<void> {
	try {
		await administrator.begin(async (tx) => {
			await work(tx)
			throw new RolledBack()
		})
	} catch (error) {
		if (!(error instanceof RolledBack)) {
			throw error
		}
	}
}

// datovy-model.md 4, ADR-021
export async function asWorker<Fixture>(
	arrange: (tx: Transaction) => Promise<Fixture>,
	act: (tx: Transaction, fixture: Fixture) => Promise<void>,
): Promise<void> {
	await rolledBack(async (tx) => {
		await tx`DELETE FROM administrator_alert WHERE queue_task_id IS NOT NULL`
		await tx`DELETE FROM queue_task`
		const fixture = await arrange(tx)
		await becomeWorker(tx)
		await act(tx, fixture)
	})
}

export async function storedObject(tx: Transaction, name: string): Promise<StoredObject> {
	const bytes = Buffer.from(`bytes of ${name}`)
	const object = { id: randomUUID(), sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }
	await tx`INSERT INTO binary_object (id, size_bytes, sha256) VALUES (${object.id}, ${object.sizeBytes}, ${object.sha256})`
	return object
}

export async function closedRecord(
	tx: Transaction,
	kind: string,
): Promise<{ acquisitionId: string; encounterId: string }> {
	const patientId = randomUUID()
	const userId = randomUUID()
	const encounterId = randomUUID()
	const acquisitionId = randomUUID()
	await tx`INSERT INTO patient_cache (id) VALUES (${patientId})`
	await tx`INSERT INTO app_user (id, given_name, family_name) VALUES (${userId}, 'Test', 'Worker')`
	await tx`
		INSERT INTO encounter (id, patient_id, source, encounter_key, status, date, study_instance_uid)
		VALUES (${encounterId}, ${patientId}, 'created_in_app', ${`sql-test-${encounterId}`}, 'in_progress', current_date,
			${`2.25.${BigInt(`0x${encounterId.replaceAll("-", "")}`)}`})
	`
	await tx`
		INSERT INTO acquisition (id, idempotency_key, patient_id, encounter_id, kind, state, operator_user_id,
			configuration_version_id, started_at, closed_at, file_count)
		VALUES (${acquisitionId}, ${randomUUID()}, ${patientId}, ${encounterId}, ${kind}, 'received', ${userId},
			(SELECT max(id) FROM configuration_version), now(), now(), 1)
	`
	await tx`
		INSERT INTO fhir_resource_link (resource_type, local_kind, local_id, resource_id)
		VALUES ('Encounter', 'encounter', ${encounterId}, ${ENCOUNTER_RESOURCE_ID})
	`
	return { acquisitionId, encounterId }
}

// CAP-021-R36, CAP-021-R40
export async function recordedPhoto(tx: Transaction): Promise<RecordedPhoto> {
	const record = await closedRecord(tx, "photo")
	const original = await storedObject(tx, "original")
	const thumbnail = await storedObject(tx, "thumbnail")
	const imageId = randomUUID()
	await tx`
		INSERT INTO image (id, acquisition_id, file_key, sequence, status, binary_object_id, received_at)
		VALUES (${imageId}, ${record.acquisitionId}, ${randomUUID()}, 1, 'received', ${original.id}, now())
	`
	await tx`INSERT INTO thumbnail (image_id, binary_object_id) VALUES (${imageId}, ${thumbnail.id})`
	return { ...record, imageId, original, thumbnail }
}

// CAP-021-R36, CAP-021-R39
export async function recordedPage(tx: Transaction): Promise<RecordedPage> {
	const record = await closedRecord(tx, "scan")
	const original = await storedObject(tx, "page")
	const thumbnail = await storedObject(tx, "page thumbnail")
	const documentId = randomUUID()
	const pageId = randomUUID()
	await tx`INSERT INTO document (id, acquisition_id) VALUES (${documentId}, ${record.acquisitionId})`
	await tx`
		INSERT INTO document_page (id, document_id, file_key, sequence, status, binary_object_id, received_at,
			thumbnail_binary_object_id)
		VALUES (${pageId}, ${documentId}, ${randomUUID()}, 1, 'received', ${original.id}, now(), ${thumbnail.id})
	`
	return { documentId, pageId, original, thumbnail }
}

export async function queuedTask(tx: Transaction, task: NewTask): Promise<string> {
	const id = randomUUID()
	const lockedUntil =
		task.lockedUntilSeconds === undefined ? null : tx`now() + make_interval(secs => ${task.lockedUntilSeconds})`
	await tx`
		INSERT INTO queue_task (id, kind, object_kind, object_id, state, run_after, locked_by, locked_until)
		VALUES (${id}, ${task.kind}, ${task.objectKind}, ${task.objectId}, ${task.state},
			now() + make_interval(secs => ${task.runAfterSeconds}), ${task.lockedBy ?? null}, ${lockedUntil})
	`
	return id
}

export async function taskRow(tx: Transaction, id: string): Promise<QueueTaskRow | undefined> {
	const [row] = await tx<QueueTaskRow[]>`
		SELECT id, state, attempts, unknown_outcomes, locked_by, run_after, locked_until FROM queue_task WHERE id = ${id}
	`
	return row
}

export async function openTasksOf(tx: Transaction, objectId: string): Promise<number> {
	const [row] = await tx<{ count: number }[]>`
		SELECT count(*)::int AS count FROM queue_task WHERE object_id = ${objectId} AND state IN ('waiting', 'running')
	`
	return row?.count ?? 0
}

export async function transactionTime(tx: Transaction): Promise<Date> {
	const [row] = await tx<{ now: Date }[]>`SELECT now() AS now`
	if (row === undefined) {
		throw new Error("the database answered no time")
	}
	return row.now
}
