import { randomUUID } from "node:crypto"
import type postgres from "@veevoy/postgres"
import { storedObject } from "../../clinical-record-upload/__tests__/sql-fixtures"

type Transaction = postgres.TransactionSql

const HARDWARE_ID_PREFIX = "tHg7xQ2kP9a"
const DRAFT_FILE_COUNT = 5
export const PATIENT_RESOURCE_ID = "patient-resource-sql"
export const PATIENT_ID_VALUE = "7001011234"
export const PATIENT_ID_SYSTEM = "rc"

export interface ClosedPhotoFixture {
	acquisitionId: string
	findingId: string
	hardwareId: string
	deliveryId: string
	seriesInstanceUid: string
	imageIds: string[]
	imageObjectIds: string[]
}

export interface ClosedScanFixture {
	acquisitionId: string
	documentId: string
	deliveryId: string
}

interface Visit {
	patientId: string
	userId: string
	encounterId: string
	deviceId: string
	hardwareId: string
}

function uidOf(seed: string): string {
	return `2.25.${BigInt(`0x${seed.replaceAll("-", "")}`)}`
}

// CAP-014-R06, CAP-021-R13
async function visitOf(tx: Transaction): Promise<Visit> {
	const deviceId = randomUUID()
	const visit = {
		patientId: randomUUID(),
		userId: randomUUID(),
		encounterId: randomUUID(),
		deviceId,
		hardwareId: `${HARDWARE_ID_PREFIX}${deviceId.replaceAll("-", "")}`,
	}
	await tx`INSERT INTO patient_cache (id, origin) VALUES (${visit.patientId}, 'created_in_app')`
	await tx`
		INSERT INTO patient_identifier (id, patient_id, system, value, source)
		VALUES (${randomUUID()}, ${visit.patientId}, ${PATIENT_ID_SYSTEM}, ${`${PATIENT_ID_VALUE}-${visit.patientId.slice(0, 4)}`},
			'created_in_app')
	`
	await tx`INSERT INTO app_user (id, given_name, family_name) VALUES (${visit.userId}, 'Petra', 'Svobodová')`
	await tx`
		INSERT INTO device (id, state, public_key_jwk, hw_id, model, os_version, platform, secure_hardware,
			managed_configuration)
		VALUES (${visit.deviceId}, 'approved', '{}'::jsonb, ${visit.hardwareId},
			'Pixel 9a', '16', 'android', 'strongbox', true)
	`
	await encounterOf(tx, visit)
	await tx`
		INSERT INTO fhir_resource_link (resource_type, local_kind, local_id, resource_id)
		VALUES ('Patient', 'patient', ${visit.patientId}, ${PATIENT_RESOURCE_ID})
	`
	return visit
}

async function encounterOf(tx: Transaction, visit: Visit): Promise<void> {
	await tx`
		INSERT INTO encounter (id, patient_id, source, encounter_key, status, date, started_at, study_instance_uid)
		VALUES (${visit.encounterId}, ${visit.patientId}, 'created_in_app', ${`sql-${visit.encounterId}`}, 'in_progress',
			'2026-11-06', '2026-11-06T08:00:00Z', ${uidOf(visit.encounterId)})
	`
}

async function draftOf(tx: Transaction, visit: Visit, kind: string): Promise<string> {
	const acquisitionId = randomUUID()
	await tx`
		INSERT INTO acquisition (id, idempotency_key, patient_id, encounter_id, kind, state, operator_user_id,
			configuration_version_id, started_at)
		VALUES (${acquisitionId}, ${randomUUID()}, ${visit.patientId}, ${visit.encounterId}, ${kind}, 'draft',
			${visit.userId}, (SELECT max(id) FROM configuration_version), '2026-11-06T08:10:00Z')
	`
	return acquisitionId
}

async function closed(tx: Transaction, acquisitionId: string, visit: Visit, fileCount: number): Promise<string> {
	await tx`
		UPDATE acquisition SET state = 'received', closed_at = now(), file_count = ${fileCount},
			closing_device_id = ${visit.deviceId}
		WHERE id = ${acquisitionId}
	`
	const deliveryId = randomUUID()
	await tx`
		INSERT INTO delivery (id, acquisition_id, target, state)
		VALUES (${deliveryId}, ${acquisitionId}, 'pacs', 'waiting_for_assembly')
	`
	return deliveryId
}

// CAP-021-R11, CAP-021-R25, CAP-020-R23
export async function closedPhoto(
	tx: Transaction,
	imageCount = 2,
	existing?: ClosedPhotoFixture,
	isNewEncounter = false,
): Promise<ClosedPhotoFixture> {
	const visit = existing === undefined ? await visitOf(tx) : await visitOfRecord(tx, existing.acquisitionId)
	if (isNewEncounter) {
		visit.encounterId = randomUUID()
		await encounterOf(tx, visit)
	}
	const acquisitionId = await draftOf(tx, visit, "photo")
	const findingId = existing?.findingId ?? randomUUID()
	if (existing === undefined) {
		await tx`
			INSERT INTO finding (id, patient_id, finding_key, origin_acquisition_id, created_by)
			VALUES (${findingId}, ${visit.patientId}, ${randomUUID()}, ${acquisitionId}, ${visit.userId})
		`
	}
	await tx`UPDATE acquisition SET finding_id = ${findingId} WHERE id = ${acquisitionId}`
	const seriesInstanceUid = existing === undefined || isNewEncounter ? uidOf(randomUUID()) : existing.seriesInstanceUid
	if (existing === undefined || isNewEncounter) {
		await tx`
			INSERT INTO series (id, encounter_id, finding_id, series_instance_uid, series_number)
			VALUES (${randomUUID()}, ${visit.encounterId}, ${findingId}, ${seriesInstanceUid}, 1)
		`
	}
	const imageIds: string[] = []
	const imageObjectIds: string[] = []
	for (let sequence = 1; sequence <= imageCount; sequence += 1) {
		const object = await storedObject(tx, `image ${sequence}`)
		const imageId = randomUUID()
		await tx`
			INSERT INTO image (id, acquisition_id, file_key, sequence, status, binary_object_id, received_at, edit_kind)
			VALUES (${imageId}, ${acquisitionId}, ${randomUUID()}, ${sequence}, 'received', ${object.id}, now(),
				${sequence === 1 ? "crop" : null})
		`
		imageIds.push(imageId)
		imageObjectIds.push(object.id)
	}
	const deliveryId = await closed(tx, acquisitionId, visit, imageCount)
	return {
		acquisitionId,
		findingId,
		hardwareId: visit.hardwareId,
		deliveryId,
		seriesInstanceUid,
		imageIds,
		imageObjectIds,
	}
}

async function visitOfRecord(tx: Transaction, acquisitionId: string): Promise<Visit> {
	const [row] = await tx<
		{ patient_id: string; operator_user_id: string; encounter_id: string; closing_device_id: string; hw_id: string }[]
	>`
		SELECT a.patient_id, a.operator_user_id, a.encounter_id, a.closing_device_id, device.hw_id
		FROM acquisition a JOIN device ON device.id = a.closing_device_id
		WHERE a.id = ${acquisitionId}
	`
	if (row === undefined) {
		throw new Error(`no acquisition ${acquisitionId}`)
	}
	return {
		patientId: row.patient_id,
		userId: row.operator_user_id,
		encounterId: row.encounter_id,
		deviceId: row.closing_device_id,
		hardwareId: row.hw_id,
	}
}

// CAP-021-R11, CAP-015-R33
export async function draftOfFinding(tx: Transaction, existing: ClosedPhotoFixture): Promise<string> {
	const visit = await visitOfRecord(tx, existing.acquisitionId)
	const acquisitionId = await draftOf(tx, visit, "photo")
	await tx`
		UPDATE acquisition SET finding_id = ${existing.findingId}, file_count = ${DRAFT_FILE_COUNT} WHERE id = ${acquisitionId}
	`
	return acquisitionId
}

// CAP-021-R25
export async function announcedImageOf(tx: Transaction, acquisitionId: string, sequence: number): Promise<void> {
	await tx`
		INSERT INTO image (id, acquisition_id, file_key, sequence, status)
		VALUES (${randomUUID()}, ${acquisitionId}, ${randomUUID()}, ${sequence}, 'announced')
	`
}

// CAP-018-R15, CAP-021-R39
export async function closedScan(tx: Transaction, pageCount = 2): Promise<ClosedScanFixture> {
	const visit = await visitOf(tx)
	const acquisitionId = await draftOf(tx, visit, "scan")
	const documentId = randomUUID()
	await tx`INSERT INTO document (id, acquisition_id, title_text) VALUES (${documentId}, ${acquisitionId}, 'Zpráva')`
	await tx`
		INSERT INTO series (id, encounter_id, document_id, series_instance_uid, series_number)
		VALUES (${randomUUID()}, ${visit.encounterId}, ${documentId}, ${uidOf(documentId)}, 1)
	`
	for (let sequence = 1; sequence <= pageCount; sequence += 1) {
		const object = await storedObject(tx, `page ${sequence}`)
		await tx`
			INSERT INTO document_page (id, document_id, file_key, sequence, status, binary_object_id, received_at)
			VALUES (${randomUUID()}, ${documentId}, ${randomUUID()}, ${sequence}, 'received', ${object.id}, now())
		`
	}
	const deliveryId = await closed(tx, acquisitionId, visit, pageCount)
	return { acquisitionId, documentId, deliveryId }
}
