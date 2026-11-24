import { randomUUID } from "node:crypto"
import { CONFIGURATION_KEY } from "@ansora/contracts"
import type { BinaryStorePort, DurableBinaryRemovalPort } from "@ansora/core-server"
import { SOP_CLASS } from "@ansora/vulna-domain"
import type postgres from "@veevoy/postgres"
import { afterAll, describe, expect, it } from "vitest"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import type { ConfigurationService } from "../../../libs/configuration/configuration.service"
import type { DatabaseService } from "../../../libs/database/database.service"
import { closedPhoto, closedScan, draftOfFinding } from "../../assembly/__tests__/assembly-sql-fixtures"
import { administrator, asWorker, storedObject } from "../../clinical-record-upload/__tests__/sql-fixtures"
import { RetentionRepository } from "../repositories/retention.repository"
import type { BinaryRemovalService } from "../services/binary-removal.service"
import { BufferCleanupService } from "../services/buffer-cleanup.service"
import { StoreRetentionService } from "../services/store-retention.service"

type Transaction = postgres.TransactionSql

const PACS = "pacs"
const SECOND_TARGET = "pacs-retention-test"
const JPEG_BASELINE = "1.2.840.10008.1.2.4.50"
const EXPLICIT_LITTLE_ENDIAN = "1.2.840.10008.1.2.1"
const IMPLICIT_LITTLE_ENDIAN = "1.2.840.10008.1.2"
const ORIGINAL_DAYS = 30
const PAST_RETENTION_DAYS = 31
const WITHIN_RETENTION_DAYS = 29
const SHORTENED_DAYS = 1
const LONG_AGO_DAYS = 400
const UNCONFIRMED = null

interface Periods {
	originalDays: number
	thumbnailDays: number | null
	viewingCopyDays: number | null
}

const DEFAULT_PERIODS: Periods = { originalDays: ORIGINAL_DAYS, thumbnailDays: null, viewingCopyDays: null }

interface DeliveredPhoto {
	acquisitionId: string
	deliveryId: string
	imageId: string
	original: string
	thumbnail: string
	viewingCopy: string
	dicomFile: string
}

interface PhotoState {
	anchoredDaysAgo: number | typeof UNCONFIRMED
	isUploaded: boolean
	isBufferDeleted: boolean
}

function uid(): string {
	return `2.25.${BigInt(`0x${randomUUID().replaceAll("-", "")}`)}`
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

async function uploaded(tx: Transaction, objectIds: readonly string[]): Promise<void> {
	await tx`
		UPDATE binary_object SET clinical_record_binary_id = 'binary-' || id, clinical_record_uploaded_at = now()
		WHERE id IN ${tx([...objectIds])}
	`
}

async function bufferDeleted(tx: Transaction, objectIds: readonly string[]): Promise<void> {
	await tx`UPDATE binary_object SET buffer_deleted_at = now() WHERE id IN ${tx([...objectIds])}`
}

// CAP-026-R03, CAP-026-R15
async function deliveredArtifact(
	tx: Transaction,
	source: { kind: string; id: string; acquisitionId: string; deliveryId: string; target: string },
	transferSyntaxes: readonly string[],
	anchoredDaysAgo: number | typeof UNCONFIRMED,
): Promise<string[]> {
	const artifactId = randomUUID()
	const sopClass = source.kind === "image" ? SOP_CLASS.VL_PHOTOGRAPHIC_IMAGE : SOP_CLASS.ENCAPSULATED_PDF
	await tx`
		INSERT INTO artifact (id, acquisition_id, sop_class_uid, sop_instance_uid, source_kind, source_id, target)
		VALUES (${artifactId}, ${source.acquisitionId}, ${sopClass}, ${uid()}, ${source.kind}, ${source.id}, ${source.target})
	`
	const variants: string[] = []
	for (const transferSyntax of transferSyntaxes) {
		const object = await storedObject(tx, `variant ${transferSyntax} of ${artifactId}`)
		await tx`
			INSERT INTO artifact_variant (artifact_id, transfer_syntax, dataset_sha256, binary_object_id)
			VALUES (${artifactId}, ${transferSyntax}, ${"a".repeat(64)}, ${object.id})
		`
		variants.push(object.id)
	}
	if (anchoredDaysAgo === UNCONFIRMED) {
		await tx`
			INSERT INTO delivery_instance (id, delivery_id, artifact_id, state)
			VALUES (${randomUUID()}, ${source.deliveryId}, ${artifactId}, 'waiting')
		`
		return variants
	}
	await tx`
		INSERT INTO delivery_instance (id, delivery_id, artifact_id, state, retention_anchor, accepted_transfer_syntax)
		VALUES (${randomUUID()}, ${source.deliveryId}, ${artifactId}, 'confirmed',
			now() - make_interval(days => ${anchoredDaysAgo}), ${transferSyntaxes[0] ?? null})
	`
	return variants
}

async function deliveredPhoto(tx: Transaction, state: Partial<PhotoState> = {}): Promise<DeliveredPhoto> {
	const { anchoredDaysAgo = PAST_RETENTION_DAYS, isUploaded = true, isBufferDeleted = false } = state
	const photo = await closedPhoto(tx, 1)
	const imageId = photo.imageIds[0] as string
	const original = photo.imageObjectIds[0] as string
	const thumbnail = (await storedObject(tx, "thumbnail")).id
	const viewingCopy = (await storedObject(tx, "viewing copy")).id
	await tx`INSERT INTO thumbnail (image_id, binary_object_id) VALUES (${imageId}, ${thumbnail})`
	await tx`UPDATE image SET viewing_copy_binary_object_id = ${viewingCopy} WHERE id = ${imageId}`
	await tx`UPDATE delivery SET state = 'assembled' WHERE id = ${photo.deliveryId}`
	const files = [original, thumbnail, viewingCopy]
	if (isUploaded) {
		await uploaded(tx, files)
	}
	if (isBufferDeleted) {
		await bufferDeleted(tx, files)
	}
	const source = {
		kind: "image",
		id: imageId,
		acquisitionId: photo.acquisitionId,
		deliveryId: photo.deliveryId,
		target: PACS,
	}
	const [dicomFile] = await deliveredArtifact(tx, source, [JPEG_BASELINE], anchoredDaysAgo)
	return {
		acquisitionId: photo.acquisitionId,
		deliveryId: photo.deliveryId,
		imageId,
		original,
		thumbnail,
		viewingCopy,
		dicomFile: dicomFile as string,
	}
}

async function bufferDeletedAt(tx: Transaction, objectId: string): Promise<Date | null | undefined> {
	const [row] = await tx<{ buffer_deleted_at: Date | null }[]>`
		SELECT buffer_deleted_at FROM binary_object WHERE id = ${objectId}
	`
	return row?.buffer_deleted_at
}

async function retentionDueAt(tx: Transaction, objectId: string): Promise<Date | null | undefined> {
	const [row] = await tx<{ retention_due_at: Date | null }[]>`
		SELECT retention_due_at FROM binary_object WHERE id = ${objectId}
	`
	return row?.retention_due_at
}

async function detached(tx: Transaction, objectIds: readonly string[]): Promise<void> {
	await tx`UPDATE binary_object SET clinical_record_detached_at = now() WHERE id IN ${tx([...objectIds])}`
}

async function auditEventsOf(tx: Transaction, eventType: string): Promise<Record<string, unknown>[]> {
	const rows = await tx<{ details: Record<string, unknown> }[]>`
		SELECT details FROM audit WHERE event_type = ${eventType} ORDER BY sequence
	`
	return rows.map((row) => row.details)
}

async function writeTasksOf(tx: Transaction, objectId: string): Promise<string[]> {
	const rows = await tx<{ object_kind: string }[]>`
		SELECT object_kind FROM queue_task
		WHERE kind = 'clinical_record_write' AND object_id = ${objectId} AND state = 'waiting'
	`
	return rows.map((row) => row.object_kind)
}

function bufferCleanupOf(tx: Transaction, deletedKeys: string[]): BufferCleanupService {
	const database = serviceDatabaseOf(tx)
	const binaryStore = {
		delete: async (key: string) => {
			deletedKeys.push(key)
		},
	} as unknown as BinaryStorePort
	return new BufferCleanupService(database, new RetentionRepository(database), new AuditRepository(), binaryStore)
}

function storeRetentionOf(
	tx: Transaction,
	periods: Periods,
	removal: DurableBinaryRemovalPort | undefined,
): StoreRetentionService {
	const database = serviceDatabaseOf(tx)
	const values = new Map<string, unknown>([
		[CONFIGURATION_KEY.RETENTION_FULL_IMAGES_DAYS, periods.originalDays],
		[CONFIGURATION_KEY.RETENTION_THUMBNAILS_DAYS, periods.thumbnailDays],
		[CONFIGURATION_KEY.VIEWING_COPY_RETENTION_DAYS, periods.viewingCopyDays],
	])
	const configuration = { effectiveValues: async () => values } as unknown as ConfigurationService
	const removals = { current: async () => removal } as unknown as BinaryRemovalService
	return new StoreRetentionService(
		database,
		configuration,
		new RetentionRepository(database),
		new AuditRepository(),
		removals,
	)
}

function removalInto(removed: string[]): DurableBinaryRemovalPort {
	return {
		removeWithVersions: async (binaryId: string) => {
			removed.push(binaryId)
		},
	}
}

afterAll(async () => {
	await administrator.end()
})

describe("buffer cleanup under the worker role CAP-026-R18", () => {
	it("CAP-026-S16 deletes the buffer copies once the upload and the delivery in every target are confirmed", async () => {
		await asWorker(
			async (tx) => await deliveredPhoto(tx),
			async (tx, photo) => {
				const deletedKeys: string[] = []

				expect(await bufferCleanupOf(tx, deletedKeys).run(new Date())).toBe(4)

				const files = [photo.original, photo.thumbnail, photo.viewingCopy, photo.dicomFile]
				expect([...deletedKeys].sort()).toEqual([...files].sort())
				for (const objectId of files) {
					expect(await bufferDeletedAt(tx, objectId)).toBeInstanceOf(Date)
				}
				const events = await auditEventsOf(tx, "buffer-copy-deletion")
				expect(events.map((event) => event.rendition).sort()).toEqual(
					["dicom_file", "original", "thumbnail", "viewing_copy"].sort(),
				)
				expect(events.every((event) => typeof event.retention_anchor === "string")).toBe(true)
			},
		)
	})

	it("CAP-026-S15 B14 keeps the buffer copy of a file the store has not confirmed, however old it is", async () => {
		await asWorker(
			async (tx) => await deliveredPhoto(tx, { isUploaded: false, anchoredDaysAgo: LONG_AGO_DAYS }),
			async (tx, photo) => {
				const deletedKeys: string[] = []

				await bufferCleanupOf(tx, deletedKeys).run(new Date())

				expect(deletedKeys).toEqual([photo.dicomFile])
				expect(await bufferDeletedAt(tx, photo.original)).toBeNull()
			},
		)
	})

	it("CAP-026-S15 B14 keeps every buffer copy while the delivery waits for the PACS", async () => {
		await asWorker(
			async (tx) => await deliveredPhoto(tx, { anchoredDaysAgo: UNCONFIRMED }),
			async (tx, photo) => {
				const deletedKeys: string[] = []

				expect(await bufferCleanupOf(tx, deletedKeys).run(new Date())).toBe(0)
				expect(deletedKeys).toEqual([])
				expect(await bufferDeletedAt(tx, photo.original)).toBeNull()
			},
		)
	})

	it("CAP-026-S09 deletes the DICOM files of every transfer syntax once the instance is confirmed", async () => {
		await asWorker(
			async (tx) => {
				const scan = await closedScan(tx, 1)
				await tx`UPDATE delivery SET state = 'assembled' WHERE id = ${scan.deliveryId}`
				const source = {
					kind: "document",
					id: scan.documentId,
					acquisitionId: scan.acquisitionId,
					deliveryId: scan.deliveryId,
					target: PACS,
				}
				return await deliveredArtifact(
					tx,
					source,
					[EXPLICIT_LITTLE_ENDIAN, IMPLICIT_LITTLE_ENDIAN],
					PAST_RETENTION_DAYS,
				)
			},
			async (tx, variants) => {
				const deletedKeys: string[] = []

				await bufferCleanupOf(tx, deletedKeys).run(new Date())

				expect([...deletedKeys].sort()).toEqual([...variants].sort())
			},
		)
	})

	it("CAP-026-S11 never touches the buffer copies of a draft", async () => {
		await asWorker(
			async (tx) => {
				const draftId = await draftOfFinding(tx, await closedPhoto(tx, 1))
				const object = await storedObject(tx, "draft image")
				await tx`
					INSERT INTO image (id, acquisition_id, file_key, sequence, status, binary_object_id, received_at)
					VALUES (${randomUUID()}, ${draftId}, ${randomUUID()}, 1, 'received', ${object.id}, now())
				`
				await uploaded(tx, [object.id])
				return object
			},
			async (tx) => {
				const deletedKeys: string[] = []

				expect(await bufferCleanupOf(tx, deletedKeys).run(new Date())).toBe(0)
				expect(deletedKeys).toEqual([])
			},
		)
	})
})

describe("retention in the clinical record under the worker role CAP-026-R19, CAP-026-R20", () => {
	it("CAP-026-S01 CAP-026-S17 removes the original after the retention while the thumbnail and the copy stay", async () => {
		await asWorker(
			async (tx) => await deliveredPhoto(tx, { isBufferDeleted: true }),
			async (tx, photo) => {
				const removed: string[] = []
				const retention = storeRetentionOf(tx, DEFAULT_PERIODS, removalInto(removed))

				expect(await retention.run(new Date())).toEqual({ requestedCount: 1, removedCount: 0 })
				expect(await retentionDueAt(tx, photo.original)).toBeInstanceOf(Date)
				expect(await retentionDueAt(tx, photo.thumbnail)).toBeNull()
				expect(await writeTasksOf(tx, photo.imageId)).toEqual(["image"])
				expect(removed).toEqual([])

				await detached(tx, [photo.original])
				expect(await retention.run(new Date())).toEqual({ requestedCount: 0, removedCount: 1 })

				expect(removed).toEqual([`binary-${photo.original}`])
				const [image] = await tx<{ binary_object_id: string | null; original_deleted_at: Date | null }[]>`
					SELECT binary_object_id, original_deleted_at FROM image WHERE id = ${photo.imageId}
				`
				expect(image?.binary_object_id).toBeNull()
				expect(image?.original_deleted_at).toBeInstanceOf(Date)
				const objects = await tx<{ id: string }[]>`
					SELECT id FROM binary_object WHERE id IN ${tx([photo.original, photo.thumbnail, photo.viewingCopy])}
				`
				expect(objects.map((object) => object.id).sort()).toEqual([photo.thumbnail, photo.viewingCopy].sort())
				const [event] = await auditEventsOf(tx, "retention-deletion")
				expect(event).toMatchObject({
					rendition: "original",
					file_id: photo.imageId,
					clinical_record_binary_id: `binary-${photo.original}`,
					identity: "retention",
				})
			},
		)
	})

	it("CAP-026-S20 removes the thumbnail and the viewing copy only after their own periods", async () => {
		await asWorker(
			async (tx) => await deliveredPhoto(tx, { isBufferDeleted: true }),
			async (tx, photo) => {
				const removed: string[] = []
				const periods = { originalDays: LONG_AGO_DAYS, thumbnailDays: ORIGINAL_DAYS, viewingCopyDays: ORIGINAL_DAYS }
				const retention = storeRetentionOf(tx, periods, removalInto(removed))

				await retention.run(new Date())
				await detached(tx, [photo.thumbnail, photo.viewingCopy])
				await retention.run(new Date())

				const thumbnails = await tx`SELECT 1 FROM thumbnail WHERE image_id = ${photo.imageId}`
				expect(thumbnails).toHaveLength(0)
				const [image] = await tx<{ binary_object_id: string | null; viewing_copy_binary_object_id: string | null }[]>`
					SELECT binary_object_id, viewing_copy_binary_object_id FROM image WHERE id = ${photo.imageId}
				`
				expect(image).toEqual({ binary_object_id: photo.original, viewing_copy_binary_object_id: null })
				expect(await retentionDueAt(tx, photo.original)).toBeNull()
			},
		)
	})

	it("CAP-026-R04 keeps the original within its retention", async () => {
		await asWorker(
			async (tx) => await deliveredPhoto(tx, { isBufferDeleted: true, anchoredDaysAgo: WITHIN_RETENTION_DAYS }),
			async (tx) => {
				expect(await storeRetentionOf(tx, DEFAULT_PERIODS, removalInto([])).run(new Date())).toEqual({
					requestedCount: 0,
					removedCount: 0,
				})
			},
		)
	})

	it("CAP-026-R19 asks the API to detach nothing while the retention credential is missing", async () => {
		await asWorker(
			async (tx) => await deliveredPhoto(tx, { isBufferDeleted: true }),
			async (tx, photo) => {
				expect(await storeRetentionOf(tx, DEFAULT_PERIODS, undefined).run(new Date())).toEqual({
					requestedCount: 0,
					removedCount: 0,
				})
				expect(await retentionDueAt(tx, photo.original)).toBeNull()
				expect(await writeTasksOf(tx, photo.imageId)).toEqual([])
			},
		)
	})

	it("CAP-026-S18 CAP-012-S25 B14 removes nothing of a record the PACS never confirmed, even closed by the administrator and with a shortened period", async () => {
		await asWorker(
			async (tx) => {
				const photo = await deliveredPhoto(tx, { anchoredDaysAgo: UNCONFIRMED })
				await tx`
					UPDATE delivery_instance SET state = 'closed_by_administrator', closed_from_state = 'permanently_failed',
						closed_at = now(), closure_reason = 'not_required',
						closed_by_user_id = (SELECT operator_user_id FROM acquisition WHERE id = ${photo.acquisitionId})
					WHERE delivery_id = ${photo.deliveryId}
				`
				await tx`UPDATE acquisition SET closed_at = now() - make_interval(days => ${LONG_AGO_DAYS}) WHERE id = ${photo.acquisitionId}`
				return photo
			},
			async (tx, photo) => {
				const removed: string[] = []
				const deletedKeys: string[] = []
				const periods = { originalDays: SHORTENED_DAYS, thumbnailDays: SHORTENED_DAYS, viewingCopyDays: SHORTENED_DAYS }

				expect(await bufferCleanupOf(tx, deletedKeys).run(new Date())).toBe(0)
				expect(deletedKeys).toEqual([])
				expect(await storeRetentionOf(tx, periods, removalInto(removed)).run(new Date())).toEqual({
					requestedCount: 0,
					removedCount: 0,
				})
				expect(removed).toEqual([])
				for (const objectId of [photo.original, photo.thumbnail, photo.viewingCopy]) {
					expect(await bufferDeletedAt(tx, objectId)).toBeNull()
					expect(await retentionDueAt(tx, objectId)).toBeNull()
				}
			},
		)
	})

	it("CAP-026-S10 B14 removes nothing while another target has not confirmed the instance", async () => {
		await asWorker(
			async (tx) => {
				const photo = await deliveredPhoto(tx, { isBufferDeleted: false })
				await tx`INSERT INTO delivery_target (code) VALUES (${SECOND_TARGET}) ON CONFLICT DO NOTHING`
				const secondDeliveryId = randomUUID()
				await tx`
					INSERT INTO delivery (id, acquisition_id, target, state)
					VALUES (${secondDeliveryId}, ${photo.acquisitionId}, ${SECOND_TARGET}, 'assembled')
				`
				const source = {
					kind: "image",
					id: photo.imageId,
					acquisitionId: photo.acquisitionId,
					deliveryId: secondDeliveryId,
					target: SECOND_TARGET,
				}
				await deliveredArtifact(tx, source, [JPEG_BASELINE], UNCONFIRMED)
				return photo
			},
			async (tx, photo) => {
				const deletedKeys: string[] = []

				await bufferCleanupOf(tx, deletedKeys).run(new Date())

				expect(deletedKeys).toEqual([photo.dicomFile])
				expect(await bufferDeletedAt(tx, photo.original)).toBeNull()
			},
		)
	})

	it("CAP-026-S10 B14 removes nothing while another target waits for its assembly", async () => {
		await asWorker(
			async (tx) => {
				const photo = await deliveredPhoto(tx)
				await tx`INSERT INTO delivery_target (code) VALUES (${SECOND_TARGET}) ON CONFLICT DO NOTHING`
				await tx`
					INSERT INTO delivery (id, acquisition_id, target, state)
					VALUES (${randomUUID()}, ${photo.acquisitionId}, ${SECOND_TARGET}, 'waiting_for_assembly')
				`
				return photo
			},
			async (tx, photo) => {
				const deletedKeys: string[] = []

				await bufferCleanupOf(tx, deletedKeys).run(new Date())

				expect(deletedKeys).toEqual([photo.dicomFile])
			},
		)
	})

	it("CAP-026-S21 CAP-026-R20 keeps the PDF of an undelivered document and removes it after the retention of a delivered one", async () => {
		await asWorker(
			async (tx) => {
				const documents = []
				for (const anchoredDaysAgo of [UNCONFIRMED, PAST_RETENTION_DAYS]) {
					const scan = await closedScan(tx, 1)
					const pdf = (await storedObject(tx, "output pdf")).id
					await tx`UPDATE document SET output_pdf_binary_object_id = ${pdf} WHERE id = ${scan.documentId}`
					await tx`UPDATE delivery SET state = 'assembled' WHERE id = ${scan.deliveryId}`
					await uploaded(tx, [pdf])
					await bufferDeleted(tx, [pdf])
					const source = {
						kind: "document",
						id: scan.documentId,
						acquisitionId: scan.acquisitionId,
						deliveryId: scan.deliveryId,
						target: PACS,
					}
					await deliveredArtifact(tx, source, [EXPLICIT_LITTLE_ENDIAN], anchoredDaysAgo)
					documents.push({ documentId: scan.documentId, pdf })
				}
				return documents
			},
			async (tx, [undelivered, delivered]) => {
				if (undelivered === undefined || delivered === undefined) {
					throw new Error("the fixture made no documents")
				}
				const removed: string[] = []
				const retention = storeRetentionOf(tx, DEFAULT_PERIODS, removalInto(removed))

				await retention.run(new Date())
				expect(await retentionDueAt(tx, undelivered.pdf)).toBeNull()
				expect(await writeTasksOf(tx, delivered.documentId)).toEqual(["document"])
				await detached(tx, [delivered.pdf])
				await retention.run(new Date())

				expect(removed).toEqual([`binary-${delivered.pdf}`])
				const documents = await tx<
					{ id: string; output_pdf_binary_object_id: string | null; output_pdf_deleted_at: Date | null }[]
				>`
					SELECT id, output_pdf_binary_object_id, output_pdf_deleted_at FROM document
					WHERE id IN ${tx([undelivered.documentId, delivered.documentId])}
				`
				const byId = new Map(documents.map((document) => [document.id, document]))
				expect(byId.get(undelivered.documentId)).toMatchObject({ output_pdf_binary_object_id: undelivered.pdf })
				expect(byId.get(delivered.documentId)).toMatchObject({ output_pdf_binary_object_id: null })
				expect(byId.get(delivered.documentId)?.output_pdf_deleted_at).toBeInstanceOf(Date)
			},
		)
	})

	it("CAP-026-R19 keeps every row when the store cannot remove the Binary, and removes it on the next run", async () => {
		await asWorker(
			async (tx) => {
				const photo = await deliveredPhoto(tx, { isBufferDeleted: true })
				await tx`UPDATE binary_object SET retention_due_at = now() WHERE id = ${photo.original}`
				await detached(tx, [photo.original])
				return photo
			},
			async (tx, photo) => {
				const unavailable: DurableBinaryRemovalPort = {
					removeWithVersions: async () => {
						throw new Error("the store is down")
					},
				}

				expect(await storeRetentionOf(tx, DEFAULT_PERIODS, unavailable).run(new Date())).toEqual({
					requestedCount: 0,
					removedCount: 0,
				})
				const [image] = await tx<{ binary_object_id: string | null }[]>`
					SELECT binary_object_id FROM image WHERE id = ${photo.imageId}
				`
				expect(image?.binary_object_id).toBe(photo.original)

				expect(await storeRetentionOf(tx, DEFAULT_PERIODS, removalInto([])).run(new Date())).toEqual({
					requestedCount: 0,
					removedCount: 1,
				})
			},
		)
	})

	it("datovy-model.md 4 the schema refuses a retention mark on a file still in the buffer or not in the store", async () => {
		await asWorker(
			async (tx) => await deliveredPhoto(tx, { isUploaded: false }),
			async (tx, photo) => {
				await expect(
					tx.savepoint(async (savepoint) => {
						await savepoint`UPDATE binary_object SET retention_due_at = now() WHERE id = ${photo.original}`
					}),
				).rejects.toMatchObject({ constraint_name: "binary_object_retention_due_check" })
			},
		)
	})
})
