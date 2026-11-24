import { randomUUID } from "node:crypto"
import { ACQUISITION_KIND, ADMINISTRATION_ERROR_CODE, ENCOUNTER_STATUS } from "@ansora/contracts"
import { PERMISSION } from "@ansora/core-server"
import { ACQUISITION_STATE, ENCOUNTER_SOURCE, uidOfUuid } from "@ansora/vulna-domain"
import postgres from "@veevoy/postgres"
import { afterAll, describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import { FILE_STATUS } from "../../acquisition/constants/acquisition-file.constants"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import { BINARY_OBJECT_REFERENCES } from "../constants/orphaned-object.constants"
import { OrphanedObjectRepository } from "../repositories/orphaned-object.repository"
import { OrphanedObjectService } from "../services/orphaned-object.service"

type Transaction = postgres.TransactionSql

const DATABASE_URL_VARIABLE = "API_SQL_TEST_DATABASE_URL"
// ADR-021, datovy-model.md 9
const API_ROLE = "vulna_api"
const ORPHAN_ALERT_KIND = "orphaned_objects_set_aside"
const DELETION_EVENT = "orphaned-object-deletion"
const REASON = "Zbytek po přerušeném nahrávání"
const PAGE_SIZE = 2
const FIRST_BY_ID = "10000000-0000-4000-8000-000000000001"
const MIDDLE_BY_ID = "80000000-0000-4000-8000-000000000001"
const LAST_BY_ID = "f0000000-0000-4000-8000-000000000001"
const MAX_PAGE_SIZE = 200

class RolledBack extends Error {}

interface Deletion {
	service: OrphanedObjectService
	discarded: string[]
}

function requiredDatabaseUrl(): string {
	const url = process.env[DATABASE_URL_VARIABLE]
	if (url === undefined || url === "") {
		throw new Error(`the SQL test of the API needs ${DATABASE_URL_VARIABLE}`)
	}
	return url
}

const owner = postgres(requiredDatabaseUrl(), { max: 1, onnotice: () => undefined })

afterAll(async () => {
	await owner.end()
})

function serviceDatabaseOf(tx: Transaction): DatabaseService {
	const sql = new Proxy(tx, {
		get(target, property) {
			if (property === "begin") {
				return (work: (savepoint: Transaction) => Promise<unknown>) => target.savepoint(work)
			}
			return Reflect.get(target, property)
		},
	})
	return { sql } as unknown as DatabaseService
}

async function becomeApi(tx: Transaction): Promise<void> {
	await tx`SET LOCAL ROLE ${tx(API_ROLE)}`
	const [row] = await tx<{ role: string }[]>`SELECT current_user AS role`
	if (row?.role !== API_ROLE) {
		throw new Error(`the SQL test runs as ${row?.role}, not as ${API_ROLE}`)
	}
}

// ADR-021
async function asApi<Fixture>(
	arrange: (tx: Transaction) => Promise<Fixture>,
	act: (tx: Transaction, fixture: Fixture) => Promise<void>,
): Promise<void> {
	try {
		await owner.begin(async (tx) => {
			await tx`DELETE FROM administrator_alert WHERE kind = ${ORPHAN_ALERT_KIND}`
			await tx`
				UPDATE binary_object SET set_aside_at = NULL
				WHERE set_aside_at IS NOT NULL
			`
			const fixture = await arrange(tx)
			await becomeApi(tx)
			await act(tx, fixture)
			throw new RolledBack()
		})
	} catch (error) {
		if (!(error instanceof RolledBack)) {
			throw error
		}
	}
}

function deletionOf(tx: Transaction): Deletion {
	const database = serviceDatabaseOf(tx)
	const discarded: string[] = []
	const configuration = {
		pageSize: async () => ({ defaultSize: PAGE_SIZE, maxSize: MAX_PAGE_SIZE }),
	} as unknown as ConfigurationService
	const binaries = {
		discardBytes: async (ids: readonly string[]) => {
			discarded.push(...ids)
		},
	} as unknown as BinaryObjectService
	const service = new OrphanedObjectService(
		database,
		configuration,
		new OrphanedObjectRepository(database),
		new AdministratorAlertRepository(database),
		new AuditRepository(),
		binaries,
	)
	return { service, discarded }
}

const ADMINISTRATOR: AdministrationSession = {
	sessionId: randomUUID(),
	userId: randomUUID(),
	permissions: [PERMISSION.ADMINISTRATION_ACCESS, PERMISSION.MONITORING_MANAGE],
}

async function administratorUser(tx: Transaction): Promise<void> {
	await tx`
		INSERT INTO app_user (id, given_name, family_name) VALUES (${ADMINISTRATOR.userId}, 'Petr', 'Svoboda')
		ON CONFLICT (id) DO NOTHING
	`
}

async function setAsideObject(tx: Transaction, createdHoursAgo: number, id = randomUUID()): Promise<string> {
	await tx`
		INSERT INTO binary_object (id, created_at, size_bytes, sha256, set_aside_at)
		VALUES (${id}, now() - make_interval(hours => ${createdHoursAgo}), 2048, ${"e".repeat(64)}, now())
	`
	return id
}

async function keptObject(tx: Transaction): Promise<string> {
	const id = randomUUID()
	await tx`
		INSERT INTO binary_object (id, created_at, size_bytes, sha256)
		VALUES (${id}, now() - make_interval(days => 3), 1024, ${"f".repeat(64)})
	`
	return id
}

// datovy-model.md 2, datovy-model.md 4 „Pořízení“
async function referencedByDraft(tx: Transaction, objectId: string): Promise<void> {
	const patientId = randomUUID()
	const encounterId = randomUUID()
	const userId = randomUUID()
	const acquisitionId = randomUUID()
	await tx`INSERT INTO patient_cache (id) VALUES (${patientId})`
	await tx`INSERT INTO app_user (id, given_name, family_name) VALUES (${userId}, 'Test', 'Sestra')`
	await tx`
		INSERT INTO encounter (id, patient_id, source, encounter_key, status, date, study_instance_uid)
		VALUES (${encounterId}, ${patientId}, ${ENCOUNTER_SOURCE.CREATED_IN_APP}, ${`sql-test-${encounterId}`},
			${ENCOUNTER_STATUS.IN_PROGRESS}, current_date, ${uidOfUuid(encounterId)})
	`
	await tx`
		INSERT INTO acquisition (id, idempotency_key, patient_id, encounter_id, kind, state, operator_user_id,
			configuration_version_id, started_at)
		VALUES (${acquisitionId}, ${randomUUID()}, ${patientId}, ${encounterId}, ${ACQUISITION_KIND.SCAN},
			${ACQUISITION_STATE.DRAFT}, ${userId}, (SELECT max(id) FROM configuration_version), now())
	`
	await tx`INSERT INTO document (id, acquisition_id, title_text) VALUES (${randomUUID()}, ${acquisitionId}, 'Zpráva')`
	await tx`
		INSERT INTO document_page (id, document_id, file_key, sequence, status, binary_object_id, received_at, sha256)
		VALUES (${randomUUID()}, (SELECT id FROM document WHERE acquisition_id = ${acquisitionId}), ${randomUUID()}, 1,
			${FILE_STATUS.RECEIVED}, ${objectId}, now(), ${"e".repeat(64)})
	`
}

async function orphanAlert(tx: Transaction): Promise<string> {
	const id = randomUUID()
	await tx`
		INSERT INTO administrator_alert (id, kind, message, set_aside_object_count)
		VALUES (${id}, ${ORPHAN_ALERT_KIND}, 'Úklidová úloha odložila 2 osiřelé objekty.', 2)
	`
	return id
}

async function isResolved(tx: Transaction, alertId: string): Promise<boolean> {
	const [row] = await tx<
		{ resolved_at: Date | null }[]
	>`SELECT resolved_at FROM administrator_alert WHERE id = ${alertId}`
	return row?.resolved_at instanceof Date
}

async function exists(tx: Transaction, objectId: string): Promise<boolean> {
	const rows = await tx`SELECT 1 FROM binary_object WHERE id = ${objectId}`
	return rows.length > 0
}

async function problemOf(pending: Promise<unknown>): Promise<ProblemException> {
	const error = await pending.catch((caught: unknown) => caught)
	if (!(error instanceof ProblemException)) {
		throw new Error(`the deletion did not fail with a problem: ${String(error)}`)
	}
	return error
}

describe("set-aside orphaned objects in the SQL of the API CAP-026-R14", () => {
	it("CAP-026-S07 lists the set-aside objects nothing refers to, the oldest first, page by page", async () => {
		await asApi(
			async (tx) => {
				const newest = await setAsideObject(tx, 1, FIRST_BY_ID)
				const oldest = await setAsideObject(tx, 30, LAST_BY_ID)
				const middle = await setAsideObject(tx, 10, MIDDLE_BY_ID)
				const referenced = await setAsideObject(tx, 20)
				await referencedByDraft(tx, referenced)
				await keptObject(tx)
				return { oldest, middle, newest }
			},
			async (tx, { oldest, middle, newest }) => {
				const { service } = deletionOf(tx)

				const first = await service.list({})
				const second = await service.list({ cursor: first.next_cursor ?? undefined })

				expect(first.items?.map((item) => item.id)).toEqual([oldest, middle])
				expect(second.items?.map((item) => item.id)).toEqual([newest])
				expect(second.next_cursor).toBeNull()
				expect(first.items?.[0]).toEqual({
					id: oldest,
					size_bytes: 2048,
					sha256: "e".repeat(64),
					created_at: expect.any(String),
					set_aside_at: expect.any(String),
				})
			},
		)
	})

	it("CAP-026-S08 deletes the object with the consent of the administrator and audits it", async () => {
		await asApi(
			async (tx) => {
				await administratorUser(tx)
				const deleted = await setAsideObject(tx, 30)
				const remaining = await setAsideObject(tx, 30)
				const alertId = await orphanAlert(tx)
				return { deleted, remaining, alertId }
			},
			async (tx, { deleted, remaining, alertId }) => {
				const { service, discarded } = deletionOf(tx)

				await service.delete(deleted, { reason: REASON }, ADMINISTRATOR)

				expect(await exists(tx, deleted)).toBe(false)
				expect(await exists(tx, remaining)).toBe(true)
				expect(discarded).toEqual([deleted])
				expect(await isResolved(tx, alertId)).toBe(false)
				const events = await tx<{ actor_user_id: string; object_id: string; details: Record<string, unknown> }[]>`
					SELECT actor_user_id, object_id, details FROM audit WHERE event_type = ${DELETION_EVENT}
				`
				expect(events).toEqual([
					{
						actor_user_id: ADMINISTRATOR.userId,
						object_id: deleted,
						details: { binary_object_id: deleted, reason: REASON, administrator_user_id: ADMINISTRATOR.userId },
					},
				])
			},
		)
	})

	it("CAP-026-R14 ends the alert once the administrator deleted the last set-aside object", async () => {
		await asApi(
			async (tx) => {
				await administratorUser(tx)
				return { objectId: await setAsideObject(tx, 30), alertId: await orphanAlert(tx) }
			},
			async (tx, { objectId, alertId }) => {
				await deletionOf(tx).service.delete(objectId, { reason: REASON }, ADMINISTRATOR)

				expect(await isResolved(tx, alertId)).toBe(true)
			},
		)
	})

	it.each([
		["the cleanup has not set aside", false],
		["a record refers to again", true],
	])("CAP-026-R14 refuses to delete an object %s and deletes nothing", async (_situation, isReferenced) => {
		await asApi(
			async (tx) => {
				await administratorUser(tx)
				if (!isReferenced) {
					return await keptObject(tx)
				}
				const objectId = await setAsideObject(tx, 30)
				await referencedByDraft(tx, objectId)
				return objectId
			},
			async (tx, objectId) => {
				const { service, discarded } = deletionOf(tx)

				const problem = await problemOf(service.delete(objectId, { reason: REASON }, ADMINISTRATOR))

				expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.ORPHANED_OBJECT_NOT_SET_ASIDE)
				expect(await exists(tx, objectId)).toBe(true)
				expect(discarded).toEqual([])
			},
		)
	})

	it("CAP-026-R14 answers not found for an object that does not exist", async () => {
		await asApi(
			async (tx) => {
				await administratorUser(tx)
			},
			async (tx) => {
				const { service, discarded } = deletionOf(tx)

				const problem = await problemOf(service.delete(randomUUID(), { reason: REASON }, ADMINISTRATOR))

				expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.NOT_FOUND)
				expect(discarded).toEqual([])
			},
		)
	})

	it("datovy-model.md 4 the API knows every column that refers to a binary object", async () => {
		await asApi(
			async () => undefined,
			async (tx) => {
				const columns = await tx<{ table_name: string; column_name: string }[]>`
					SELECT source.relname AS table_name, attribute.attname AS column_name
					FROM pg_constraint fk
					JOIN pg_class source ON source.oid = fk.conrelid
					JOIN pg_attribute attribute ON attribute.attrelid = fk.conrelid AND attribute.attnum = ANY (fk.conkey)
					WHERE fk.contype = 'f' AND fk.confrelid = 'binary_object'::regclass
				`
				const known = BINARY_OBJECT_REFERENCES.map((reference) => `${reference.table}.${reference.column}`).sort()
				expect(columns.map((column) => `${column.table_name}.${column.column_name}`).sort()).toEqual(known)
			},
		)
	})
})
