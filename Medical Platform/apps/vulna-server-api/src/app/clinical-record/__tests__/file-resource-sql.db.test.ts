import { createHash, randomUUID } from "node:crypto"
import { ACQUISITION_KIND, DELIVERY_STATE, ENCOUNTER_STATUS } from "@ansora/contracts"
import { JOB_OBJECT_KIND } from "@ansora/core-server"
import { ACQUISITION_STATE, ENCOUNTER_SOURCE, SOP_CLASS, uidOfUuid } from "@ansora/vulna-domain"
import postgres from "@veevoy/postgres"
import { afterAll, describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import { FILE_STATUS } from "../../acquisition/constants/acquisition-file.constants"
import { StoredFileRepository } from "../../image/repositories/stored-file.repository"
import { ARTIFACT_SOURCE_KIND } from "../constants/clinical-record.constants"
import { FileResourceRepository } from "../repositories/file-resource.repository"

type Transaction = postgres.TransactionSql

const DATABASE_URL_VARIABLE = "API_SQL_TEST_DATABASE_URL"
// ADR-021, datovy-model.md 9
const API_ROLE = "vulna_api"
const PACS = "pacs"
const FILE_SHA256 = "f".repeat(64)

class RolledBack extends Error {}

interface DeliveredImage {
	imageId: string
	original: string
	viewingCopy: string
	sopInstanceUid: string
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

function databaseOf(tx: Transaction): DatabaseService {
	return { sql: tx } as unknown as DatabaseService
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

async function storedObject(tx: Transaction): Promise<string> {
	const id = randomUUID()
	const bytes = Buffer.from(`bytes of ${id}`)
	await tx`
		INSERT INTO binary_object (id, size_bytes, sha256, clinical_record_binary_id, clinical_record_uploaded_at,
			buffer_deleted_at)
		VALUES (${id}, ${bytes.length}, ${createHash("sha256").update(bytes).digest("hex")}, ${`binary-${id}`}, now(), now())
	`
	return id
}

// datovy-model.md 4 „Pořízení“, „Artefakt“, „Doručení“, datovy-model.md 13.1
async function deliveredImage(tx: Transaction): Promise<DeliveredImage> {
	const patientId = randomUUID()
	const encounterId = randomUUID()
	const userId = randomUUID()
	const acquisitionId = randomUUID()
	const findingId = randomUUID()
	await tx`INSERT INTO patient_cache (id) VALUES (${patientId})`
	await tx`INSERT INTO app_user (id, given_name, family_name) VALUES (${userId}, 'Test', 'Sestra')`
	await tx`
		INSERT INTO encounter (id, patient_id, source, encounter_key, status, date, study_instance_uid)
		VALUES (${encounterId}, ${patientId}, ${ENCOUNTER_SOURCE.CREATED_IN_APP}, ${`sql-test-${encounterId}`},
			${ENCOUNTER_STATUS.IN_PROGRESS}, current_date, ${uidOfUuid(encounterId)})
	`
	await tx`
		INSERT INTO acquisition (id, idempotency_key, patient_id, encounter_id, kind, state, operator_user_id,
			configuration_version_id, started_at, closed_at, file_count)
		VALUES (${acquisitionId}, ${randomUUID()}, ${patientId}, ${encounterId}, ${ACQUISITION_KIND.PHOTO},
			${ACQUISITION_STATE.DELIVERED}, ${userId}, (SELECT max(id) FROM configuration_version), now(), now(), 1)
	`
	await tx`
		INSERT INTO finding (id, patient_id, finding_key, origin_acquisition_id, created_by)
		VALUES (${findingId}, ${patientId}, ${randomUUID()}, ${acquisitionId}, ${userId})
	`
	await tx`UPDATE acquisition SET finding_id = ${findingId} WHERE id = ${acquisitionId}`
	await tx`
		INSERT INTO series (id, encounter_id, finding_id, series_instance_uid, series_number)
		VALUES (${randomUUID()}, ${encounterId}, ${findingId}, ${uidOfUuid(findingId)}, 1)
	`
	const original = await storedObject(tx)
	const viewingCopy = await storedObject(tx)
	const imageId = randomUUID()
	await tx`
		INSERT INTO image (id, acquisition_id, file_key, sequence, status, binary_object_id, received_at, sha256,
			viewing_copy_binary_object_id)
		VALUES (${imageId}, ${acquisitionId}, ${randomUUID()}, 1, ${FILE_STATUS.RECEIVED}, ${original}, now(),
			${FILE_SHA256}, ${viewingCopy})
	`
	const deliveryId = randomUUID()
	await tx`
		INSERT INTO delivery (id, acquisition_id, target, state)
		VALUES (${deliveryId}, ${acquisitionId}, ${PACS}, ${DELIVERY_STATE.ASSEMBLED})
	`
	const artifactId = randomUUID()
	const sopInstanceUid = uidOfUuid(artifactId)
	await tx`
		INSERT INTO artifact (id, acquisition_id, sop_class_uid, sop_instance_uid, source_kind, source_id, target)
		VALUES (${artifactId}, ${acquisitionId}, ${SOP_CLASS.VL_PHOTOGRAPHIC_IMAGE}, ${sopInstanceUid},
			${ARTIFACT_SOURCE_KIND.IMAGE}, ${imageId}, ${PACS})
	`
	await tx`
		INSERT INTO delivery_instance (id, delivery_id, artifact_id, state, retention_anchor)
		VALUES (${randomUUID()}, ${deliveryId}, ${artifactId}, 'confirmed', now())
	`
	return { imageId, original, viewingCopy, sopInstanceUid }
}

// datovy-model.md 4 „Binární objekt“
async function removedOriginal(tx: Transaction, image: DeliveredImage): Promise<void> {
	await tx`UPDATE image SET binary_object_id = NULL, original_deleted_at = now() WHERE id = ${image.imageId}`
	await tx`DELETE FROM binary_object WHERE id = ${image.original}`
}

describe("files past their retention in the SQL of the API CAP-026-R19, CAP-020-R15", () => {
	it("CAP-026-R19 reads the source of a photo whose original the retention removed, with its digest and SOP Instance UID", async () => {
		await asApi(
			async (tx) => {
				const image = await deliveredImage(tx)
				await removedOriginal(tx, image)
				return image
			},
			async (tx, image) => {
				const row = await new FileResourceRepository().find(tx, JOB_OBJECT_KIND.IMAGE, image.imageId)

				expect(row).toMatchObject({
					original: null,
					file_sha256: FILE_SHA256,
					sop_instance_uid: image.sopInstanceUid,
					viewing_copy: expect.objectContaining({ binary_object_id: image.viewingCopy, retention_due_at: null }),
				})
				expect(row?.original_deleted_at).toBeInstanceOf(Date)
			},
		)
	})

	it("CAP-020-R15 offers the viewing copy of a photo whose original the retention removed", async () => {
		await asApi(
			async (tx) => {
				const image = await deliveredImage(tx)
				await removedOriginal(tx, image)
				return image
			},
			async (tx, image) => {
				const row = await new StoredFileRepository(databaseOf(tx)).image(image.imageId)

				expect(row).toMatchObject({
					binary_object_id: null,
					viewing_copy_binary_object_id: image.viewingCopy,
					viewing_copy_clinical_record_binary_id: `binary-${image.viewingCopy}`,
				})
			},
		)
	})

	it("ADR-050 bod 14 marks as detached only the files the retention asked to detach", async () => {
		await asApi(
			async (tx) => {
				const image = await deliveredImage(tx)
				await tx`UPDATE binary_object SET retention_due_at = now() WHERE id = ${image.original}`
				return image
			},
			async (tx, image) => {
				await new FileResourceRepository().markDetached(tx, [image.original, image.viewingCopy])

				const rows = await tx<{ id: string; clinical_record_detached_at: Date | null }[]>`
					SELECT id, clinical_record_detached_at FROM binary_object WHERE id IN ${tx([image.original, image.viewingCopy])}
				`
				const detachedAt = new Map(rows.map((row) => [row.id, row.clinical_record_detached_at]))
				expect(detachedAt.get(image.original)).toBeInstanceOf(Date)
				expect(detachedAt.get(image.viewingCopy)).toBeNull()
			},
		)
	})
})
