import { createHash, randomUUID } from "node:crypto"
import { mkdir, mkdtemp, rm, stat, utimes } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import { CONFIGURATION_KEY } from "@ansora/contracts"
import { MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import { LocalBinaryStore } from "@ansora/vulna-adapter-binary-local"
import { SOP_CLASS } from "@ansora/vulna-domain"
import type postgres from "@veevoy/postgres"
import { afterAll, describe, expect, it } from "vitest"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import type { ConfigurationService } from "../../../libs/configuration/configuration.service"
import type { DatabaseService } from "../../../libs/database/database.service"
import { closedPhoto, closedScan, draftOfFinding } from "../../assembly/__tests__/assembly-sql-fixtures"
import { administrator, asWorker, storedObject } from "../../clinical-record-upload/__tests__/sql-fixtures"
import { BINARY_OBJECT_REFERENCES } from "../constants/orphan-cleanup.constants"
import { OrphanAlertRepository } from "../repositories/orphan-alert.repository"
import { OrphanedObjectRepository } from "../repositories/orphaned-object.repository"
import { OrphanCleanupService } from "../services/orphan-cleanup.service"
import { UnrecordedBinaryService } from "../services/unrecorded-binary.service"

type Transaction = postgres.TransactionSql

const DAY_SECONDS = 86_400
const AGED_DAYS = 2
const RECENT_DAYS = 0
const PACS = "pacs"
const EXPLICIT_LITTLE_ENDIAN = "1.2.840.10008.1.2.1"
const SET_ASIDE_EVENT = "orphaned-object-set-aside"
const ALERT_RAISED_EVENT = "administrator-alert-raised"
const ORPHAN_ALERT_KIND = "orphaned_objects_set_aside"

interface Cleanup {
	service: OrphanCleanupService
	store: LocalBinaryStore
	root: string
}

interface AuditRow {
	system_job: string | null
	object_id: string | null
	details: Record<string, unknown>
}

interface AlertRow {
	message: string
	set_aside_object_count: number | null
	resolved_at: Date | null
}

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

function daysAgo(days: number): Date {
	return new Date(Date.now() - days * DAY_SECONDS * MILLISECONDS_PER_SECOND)
}

async function cleanupOf(tx: Transaction, setAsideAfterSeconds = DAY_SECONDS): Promise<Cleanup> {
	const root = await mkdtemp(join(tmpdir(), "vulna-orphans-"))
	const store = new LocalBinaryStore(root)
	const database = serviceDatabaseOf(tx)
	const values = new Map<string, unknown>([[CONFIGURATION_KEY.ORPHAN_SET_ASIDE_AFTER_SECONDS, setAsideAfterSeconds]])
	const configuration = { effectiveValues: async () => values } as unknown as ConfigurationService
	const objects = new OrphanedObjectRepository(database)
	const service = new OrphanCleanupService(
		database,
		configuration,
		objects,
		new UnrecordedBinaryService(store, objects),
		new OrphanAlertRepository(),
		new AuditRepository(),
	)
	return { service, store, root }
}

async function withCleanup(tx: Transaction, act: (cleanup: Cleanup) => Promise<void>): Promise<void> {
	const cleanup = await cleanupOf(tx)
	try {
		await act(cleanup)
	} finally {
		await rm(cleanup.root, { recursive: true, force: true })
	}
}

// CAP-026-R14
async function earlierObjectsSetAside(tx: Transaction): Promise<void> {
	await tx`
		UPDATE binary_object SET set_aside_at = now()
		WHERE set_aside_at IS NULL AND buffer_deleted_at IS NULL AND clinical_record_binary_id IS NULL
	`
}

async function agedObject(tx: Transaction, name: string, days = AGED_DAYS): Promise<string> {
	const object = await storedObject(tx, name)
	await aged(tx, [object.id], days)
	return object.id
}

async function aged(tx: Transaction, objectIds: readonly string[], days = AGED_DAYS): Promise<void> {
	await tx`
		UPDATE binary_object SET created_at = now() - make_interval(days => ${days})
		WHERE id IN ${tx([...objectIds])}
	`
}

async function storedBytes(store: LocalBinaryStore, root: string, key: string, days: number): Promise<Buffer> {
	const bytes = Buffer.from(`bytes left by a failed request ${key}`)
	await store.put(key, Readable.from([bytes]))
	const storedAt = daysAgo(days)
	await utimes(join(root, key), storedAt, storedAt)
	return bytes
}

async function setAsideAtOf(tx: Transaction, objectId: string): Promise<Date | null | undefined> {
	const [row] = await tx<{ set_aside_at: Date | null }[]>`SELECT set_aside_at FROM binary_object WHERE id = ${objectId}`
	return row?.set_aside_at
}

async function auditOf(tx: Transaction, eventType: string): Promise<AuditRow[]> {
	return await tx<AuditRow[]>`
		SELECT system_job, object_id, details FROM audit WHERE event_type = ${eventType} ORDER BY sequence
	`
}

async function orphanAlertsOf(tx: Transaction): Promise<AlertRow[]> {
	return await tx<AlertRow[]>`
		SELECT message, set_aside_object_count, resolved_at FROM administrator_alert
		WHERE kind = ${ORPHAN_ALERT_KIND} ORDER BY raised_at
	`
}

async function deliveredVariant(tx: Transaction): Promise<string> {
	const photo = await closedPhoto(tx, 1)
	const artifactId = randomUUID()
	await tx`
		INSERT INTO artifact (id, acquisition_id, sop_class_uid, sop_instance_uid, source_kind, source_id, target)
		VALUES (${artifactId}, ${photo.acquisitionId}, ${SOP_CLASS.VL_PHOTOGRAPHIC_IMAGE},
			${`2.25.${BigInt(`0x${randomUUID().replaceAll("-", "")}`)}`}, 'image', ${photo.imageIds[0] as string}, ${PACS})
	`
	const variant = await storedObject(tx, "variant")
	await tx`
		INSERT INTO artifact_variant (artifact_id, transfer_syntax, dataset_sha256, binary_object_id)
		VALUES (${artifactId}, ${EXPLICIT_LITTLE_ENDIAN}, ${"a".repeat(64)}, ${variant.id})
	`
	return variant.id
}

afterAll(async () => {
	await administrator.end()
})

describe("orphan cleanup under the worker role CAP-026-R14", () => {
	it("CAP-026-S07 sets aside a stale object nothing refers to, deletes nothing and alerts the administrator once", async () => {
		await asWorker(
			async (tx) => {
				await earlierObjectsSetAside(tx)
				return await agedObject(tx, "left by a failed request")
			},
			async (tx, objectId) => {
				await withCleanup(tx, async ({ service }) => {
					expect(await service.run(new Date())).toEqual({ setAsideCount: 1 })
					expect(await service.run(new Date())).toEqual({ setAsideCount: 0 })

					expect(await setAsideAtOf(tx, objectId)).toBeInstanceOf(Date)
					const [setAside, ...repeated] = await auditOf(tx, SET_ASIDE_EVENT)
					expect(repeated).toEqual([])
					expect(setAside).toMatchObject({
						system_job: "orphan_cleanup",
						object_id: objectId,
						details: { binary_object_id: objectId, size_bytes: expect.any(Number), created_at: expect.any(String) },
					})
					const alerts = await orphanAlertsOf(tx)
					expect(alerts).toEqual([
						{
							message:
								"Úklidová úloha odložila 1 osiřelý objekt. Na objekty neodkazuje žádné pořízení ani artefakt a jsou " +
								"starší než nastavená mez. Nic se nesmazalo. Rozhodněte, zda je smazat.",
							set_aside_object_count: 1,
							resolved_at: null,
						},
					])
					expect(await auditOf(tx, ALERT_RAISED_EVENT)).toEqual([
						expect.objectContaining({
							system_job: "orphan_cleanup",
							details: expect.objectContaining({ alert_kind: ORPHAN_ALERT_KIND, set_aside_object_count: 1 }),
						}),
					])
				})
			},
		)
	})

	it("CAP-026-S06 leaves an object younger than the limit alone", async () => {
		await asWorker(
			async (tx) => {
				await earlierObjectsSetAside(tx)
				return await agedObject(tx, "being uploaded", RECENT_DAYS)
			},
			async (tx, objectId) => {
				await withCleanup(tx, async ({ service }) => {
					expect(await service.run(new Date())).toEqual({ setAsideCount: 0 })

					expect(await setAsideAtOf(tx, objectId)).toBeNull()
					expect(await orphanAlertsOf(tx)).toEqual([])
				})
			},
		)
	})

	it("CAP-026-R14 CAP-026-S11 never sets aside an object a record, a draft, a document or an artifact refers to", async () => {
		await asWorker(
			async (tx) => {
				await earlierObjectsSetAside(tx)
				const photo = await closedPhoto(tx, 1)
				const thumbnail = await storedObject(tx, "thumbnail")
				const viewingCopy = await storedObject(tx, "viewing copy")
				const imageId = photo.imageIds[0] as string
				await tx`INSERT INTO thumbnail (image_id, binary_object_id) VALUES (${imageId}, ${thumbnail.id})`
				await tx`UPDATE image SET viewing_copy_binary_object_id = ${viewingCopy.id} WHERE id = ${imageId}`
				const draftId = await draftOfFinding(tx, photo)
				const draftObject = await storedObject(tx, "draft image")
				await tx`
					INSERT INTO image (id, acquisition_id, file_key, sequence, status, binary_object_id, received_at)
					VALUES (${randomUUID()}, ${draftId}, ${randomUUID()}, 1, 'received', ${draftObject.id}, now())
				`
				const scan = await closedScan(tx, 1)
				const pageThumbnail = await storedObject(tx, "page thumbnail")
				const pageCopy = await storedObject(tx, "page viewing copy")
				const pdf = await storedObject(tx, "pdf")
				await tx`
					UPDATE document_page SET thumbnail_binary_object_id = ${pageThumbnail.id},
						viewing_copy_binary_object_id = ${pageCopy.id}
					WHERE document_id = ${scan.documentId}
				`
				await tx`UPDATE document SET output_pdf_binary_object_id = ${pdf.id} WHERE id = ${scan.documentId}`
				const variant = await deliveredVariant(tx)
				await tx`UPDATE binary_object SET created_at = now() - make_interval(days => ${AGED_DAYS})`
				const referenced = await tx<{ id: string }[]>`SELECT id FROM binary_object WHERE set_aside_at IS NULL`
				return { referenced: referenced.map((row) => row.id), variant }
			},
			async (tx, { referenced, variant }) => {
				await withCleanup(tx, async ({ service }) => {
					expect(await service.run(new Date())).toEqual({ setAsideCount: 0 })

					expect(referenced).toContain(variant)
					for (const objectId of referenced) {
						expect(await setAsideAtOf(tx, objectId)).toBeNull()
					}
					expect(await orphanAlertsOf(tx)).toEqual([])
				})
			},
		)
	})

	it("datovy-model.md 4 leaves alone an object whose bytes are in the clinical record store or no longer in the buffer", async () => {
		await asWorker(
			async (tx) => {
				await earlierObjectsSetAside(tx)
				const uploaded = await agedObject(tx, "uploaded")
				const deleted = await agedObject(tx, "buffer copy deleted")
				await tx`UPDATE binary_object SET clinical_record_binary_id = ${`binary-${uploaded}`} WHERE id = ${uploaded}`
				await tx`UPDATE binary_object SET buffer_deleted_at = now() WHERE id = ${deleted}`
				return [uploaded, deleted]
			},
			async (tx, objectIds) => {
				await withCleanup(tx, async ({ service }) => {
					expect(await service.run(new Date())).toEqual({ setAsideCount: 0 })

					for (const objectId of objectIds) {
						expect(await setAsideAtOf(tx, objectId)).toBeNull()
					}
				})
			},
		)
	})

	it("CAP-026-S07 backend.md 2.1 sets aside stale bytes the database has no row for and keeps them in the buffer", async () => {
		await asWorker(
			async (tx) => {
				await earlierObjectsSetAside(tx)
			},
			async (tx) => {
				await withCleanup(tx, async ({ service, store, root }) => {
					const key = randomUUID()
					const bytes = await storedBytes(store, root, key, AGED_DAYS)
					const storedAt = (await stat(join(root, key))).mtime

					expect(await service.run(new Date())).toEqual({ setAsideCount: 1 })
					expect(await service.run(new Date())).toEqual({ setAsideCount: 0 })

					const [row] = await tx<
						{ size_bytes: string; sha256: string; created_at: Date; set_aside_at: Date | null }[]
					>`SELECT size_bytes, sha256, created_at, set_aside_at FROM binary_object WHERE id = ${key}`
					expect(row).toEqual({
						size_bytes: String(bytes.length),
						sha256: createHash("sha256").update(bytes).digest("hex"),
						created_at: storedAt,
						set_aside_at: expect.any(Date),
					})
					expect(await store.exists(key)).toBe(true)
					expect((await auditOf(tx, SET_ASIDE_EVENT)).map((event) => event.object_id)).toEqual([key])
					expect((await orphanAlertsOf(tx)).map((alert) => alert.set_aside_object_count)).toEqual([1])
				})
			},
		)
	})

	it("CAP-026-S06 leaves alone recent bytes without a row, foreign files and directories", async () => {
		await asWorker(
			async (tx) => {
				await earlierObjectsSetAside(tx)
			},
			async (tx) => {
				await withCleanup(tx, async ({ service, store, root }) => {
					const recent = randomUUID()
					await storedBytes(store, root, recent, RECENT_DAYS)
					await storedBytes(store, root, "not-a-binary-object", AGED_DAYS)
					await mkdir(join(root, randomUUID()))

					expect(await service.run(new Date())).toEqual({ setAsideCount: 0 })

					expect(await setAsideAtOf(tx, recent)).toBeUndefined()
					expect(await orphanAlertsOf(tx)).toEqual([])
				})
			},
		)
	})

	it("CAP-026-R14 counts both kinds of orphaned objects in one alert of the run", async () => {
		await asWorker(
			async (tx) => {
				await earlierObjectsSetAside(tx)
				return [await agedObject(tx, "first"), await agedObject(tx, "second")]
			},
			async (tx) => {
				await withCleanup(tx, async ({ service, store, root }) => {
					await storedBytes(store, root, randomUUID(), AGED_DAYS)

					expect(await service.run(new Date())).toEqual({ setAsideCount: 3 })

					const [alert] = await orphanAlertsOf(tx)
					expect(alert?.set_aside_object_count).toBe(3)
					expect(alert?.message).toMatch(/^Úklidová úloha odložila 3 osiřelé objekty\. /)
				})
			},
		)
	})

	it("CAP-026-R14 sets aside after the limit in the settings, not after a fixed day", async () => {
		await asWorker(
			async (tx) => {
				await earlierObjectsSetAside(tx)
				return await agedObject(tx, "three days old", 3)
			},
			async (tx, objectId) => {
				const cleanup = await cleanupOf(tx, 4 * DAY_SECONDS)
				try {
					expect(await cleanup.service.run(new Date())).toEqual({ setAsideCount: 0 })
					expect(await setAsideAtOf(tx, objectId)).toBeNull()
				} finally {
					await rm(cleanup.root, { recursive: true, force: true })
				}
			},
		)
	})

	it("datovy-model.md 4 the schema refuses to set aside an object outside the buffer and an orphan alert without its count", async () => {
		await asWorker(
			async (tx) => await agedObject(tx, "refused"),
			async (tx, objectId) => {
				await expect(
					tx.savepoint(
						async (savepoint) =>
							await savepoint`
								UPDATE binary_object SET clinical_record_binary_id = 'binary-x', set_aside_at = now() WHERE id = ${objectId}
							`,
					),
				).rejects.toThrow(/binary_object_set_aside_check/)
				await expect(
					tx.savepoint(
						async (savepoint) =>
							await savepoint`
								INSERT INTO administrator_alert (id, kind, message)
								VALUES (${randomUUID()}, ${ORPHAN_ALERT_KIND}, 'without count')
							`,
					),
				).rejects.toThrow(/administrator_alert_set_aside_check/)
			},
		)
	})

	it("datovy-model.md 4 the cleanup knows every column that refers to a binary object", async () => {
		await asWorker(
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
