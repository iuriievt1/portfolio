import type { SqlDatabase } from "./sql-database"

const CREATE_STORED_FILE = `
CREATE TABLE stored_file (
	id TEXT PRIMARY KEY,
	path TEXT NOT NULL,
	wrapped_key TEXT NOT NULL,
	created_at TEXT NOT NULL
)`

// CAP-009-R17
const CREATE_BUFFERED_FILE = `
CREATE TABLE buffered_file (
	file_key TEXT PRIMARY KEY,
	acquisition_id TEXT NOT NULL,
	operator_user_id TEXT NOT NULL,
	position INTEGER NOT NULL,
	content_file_id TEXT NOT NULL REFERENCES stored_file (id),
	thumbnail_file_id TEXT NOT NULL REFERENCES stored_file (id),
	width INTEGER NOT NULL,
	height INTEGER NOT NULL,
	captured_at TEXT NOT NULL
)`

const INDEX_BUFFERED_FILE = "CREATE INDEX buffered_file_acquisition ON buffered_file (acquisition_id, position)"

// CAP-015-S04
const NUMBER_BUFFERED_FILES = `
CREATE TEMP TABLE numbered_file AS
SELECT file_key, ROW_NUMBER() OVER (PARTITION BY acquisition_id ORDER BY position, rowid) AS position
FROM buffered_file`
const RENUMBER_BUFFERED_FILES = `
UPDATE buffered_file
SET position = (SELECT numbered_file.position FROM numbered_file WHERE numbered_file.file_key = buffered_file.file_key)`
const DROP_NUMBERED_FILES = "DROP TABLE numbered_file"
const DROP_INDEX_BUFFERED_FILE = "DROP INDEX buffered_file_acquisition"
const UNIQUE_INDEX_BUFFERED_FILE =
	"CREATE UNIQUE INDEX buffered_file_position ON buffered_file (acquisition_id, position)"

// CAP-015-R35, CAP-018-R11
const ADD_FILE_KIND = "ALTER TABLE buffered_file ADD COLUMN file_kind TEXT NOT NULL DEFAULT 'image'"
const ADD_ORIGINAL_FILE = "ALTER TABLE buffered_file ADD COLUMN original_file_id TEXT REFERENCES stored_file (id)"
const ADD_CORNERS = "ALTER TABLE buffered_file ADD COLUMN corners TEXT"
// CAP-019-R24, CAP-015-R34, CAP-015-R36
const ADD_UPLOAD_STATE = "ALTER TABLE buffered_file ADD COLUMN upload_state TEXT NOT NULL DEFAULT 'waiting'"
const ADD_SENT_CONTENT = "ALTER TABLE buffered_file ADD COLUMN sent_content_file_id TEXT"
const ADD_RECEIVED_CONTENT = "ALTER TABLE buffered_file ADD COLUMN received_content_file_id TEXT"
const ADD_CONTENT_EDIT = "ALTER TABLE buffered_file ADD COLUMN content_edit TEXT"
const ADD_REJECTION_CODE = "ALTER TABLE buffered_file ADD COLUMN rejection_code TEXT"
// CAP-009-R13
const CREATE_SEALED_COPY = `
CREATE TABLE sealed_copy (
	path TEXT PRIMARY KEY,
	file_key TEXT NOT NULL,
	created_at TEXT NOT NULL
)`
const INDEX_SEALED_COPY = "CREATE INDEX sealed_copy_file ON sealed_copy (file_key)"
// CAP-015-R34, CAP-021-R32, E115
const ADD_EDIT_FAILURE = "ALTER TABLE buffered_file ADD COLUMN edit_failed_content_file_id TEXT"
// CAP-019-R10, CAP-019-R29
const CREATE_QUEUED_CLOSURE = `
CREATE TABLE queued_closure (
	acquisition_id TEXT PRIMARY KEY,
	operator_user_id TEXT NOT NULL,
	operator_personal_number TEXT,
	record_kind TEXT NOT NULL,
	file_keys TEXT NOT NULL,
	content_fingerprint TEXT NOT NULL,
	completed_at TEXT NOT NULL
)`
// CAP-019-R25, CAP-019-R18
const CREATE_QUEUE_NOTICE = `
CREATE TABLE queue_notice (
	id TEXT PRIMARY KEY,
	kind TEXT NOT NULL,
	operator_user_id TEXT NOT NULL,
	acquisition_id TEXT NOT NULL,
	record_kind TEXT NOT NULL,
	captured_at TEXT,
	rejection_code TEXT,
	created_at TEXT NOT NULL
)`
const INDEX_QUEUE_NOTICE = "CREATE INDEX queue_notice_operator ON queue_notice (operator_user_id, created_at)"
// CAP-015-R36, CAP-019-R14, CAP-019-S12, Q-076
const ADD_REMOVED_FROM_RECORD = "ALTER TABLE buffered_file ADD COLUMN removed_from_record_at TEXT"
const ADD_REPLACED_FILE = "ALTER TABLE buffered_file ADD COLUMN replaces_file_key TEXT"
// CAP-009-S05, Q-076
const CREATE_STORAGE_LOSS = `
CREATE TABLE storage_loss (
	lost_at TEXT PRIMARY KEY
)`
const CREATE_STORAGE_LOSS_ACKNOWLEDGEMENT = `
CREATE TABLE storage_loss_acknowledgement (
	lost_at TEXT NOT NULL REFERENCES storage_loss (lost_at),
	user_id TEXT NOT NULL,
	PRIMARY KEY (lost_at, user_id)
)`

// CAP-026-R08, CAP-019-R24
const ADD_RECEIVED_AT = "ALTER TABLE buffered_file ADD COLUMN received_at TEXT"
const DATE_EARLIER_RECEIPTS =
	"UPDATE buffered_file SET received_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE upload_state = 'received'"

const MIGRATIONS: readonly (readonly string[])[] = [
	[CREATE_STORED_FILE],
	[CREATE_BUFFERED_FILE, INDEX_BUFFERED_FILE],
	[
		NUMBER_BUFFERED_FILES,
		RENUMBER_BUFFERED_FILES,
		DROP_NUMBERED_FILES,
		DROP_INDEX_BUFFERED_FILE,
		UNIQUE_INDEX_BUFFERED_FILE,
	],
	[
		ADD_FILE_KIND,
		ADD_ORIGINAL_FILE,
		ADD_CORNERS,
		ADD_UPLOAD_STATE,
		ADD_SENT_CONTENT,
		ADD_RECEIVED_CONTENT,
		ADD_CONTENT_EDIT,
		ADD_REJECTION_CODE,
		CREATE_SEALED_COPY,
		INDEX_SEALED_COPY,
	],
	[ADD_EDIT_FAILURE],
	[CREATE_QUEUED_CLOSURE, CREATE_QUEUE_NOTICE, INDEX_QUEUE_NOTICE],
	[ADD_REMOVED_FROM_RECORD, ADD_REPLACED_FILE, CREATE_STORAGE_LOSS, CREATE_STORAGE_LOSS_ACKNOWLEDGEMENT],
	[ADD_RECEIVED_AT, DATE_EARLIER_RECEIPTS],
]

export const STORAGE_SCHEMA_VERSION = MIGRATIONS.length

export async function applyStorageSchema(db: SqlDatabase): Promise<void> {
	const current = (await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version", []))?.user_version ?? 0
	for (const [index, statements] of MIGRATIONS.slice(current).entries()) {
		await applyStep(db, statements, current + index + 1)
	}
}

async function applyStep(db: SqlDatabase, statements: readonly string[], version: number): Promise<void> {
	await db.execAsync("BEGIN")
	try {
		for (const statement of statements) {
			await db.execAsync(statement)
		}
		await db.execAsync(`PRAGMA user_version = ${version}`)
		await db.execAsync("COMMIT")
	} catch (failure) {
		await db.execAsync("ROLLBACK")
		throw failure
	}
}
