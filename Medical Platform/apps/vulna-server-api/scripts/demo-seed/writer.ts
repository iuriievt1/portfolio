import { createHash } from "node:crypto"
import { ENCOUNTER_STATUS } from "@ansora/contracts"
import { DEVICE_PLATFORM, DEVICE_STATE, SECURE_HARDWARE } from "@ansora/core-server"
import { ACQUISITION_STATE, ENCOUNTER_SOURCE } from "@ansora/vulna-domain"
import type postgres from "@veevoy/postgres"
import { FILE_STATUS } from "../../src/app/acquisition/constants/acquisition-file.constants"
import type { AcquisitionFileRepository } from "../../src/app/acquisition/repositories/acquisition-file.repository"
import { AssemblyTaskRepository } from "../../src/app/acquisition/repositories/assembly-task.repository"
import { DeliveryRepository } from "../../src/app/acquisition/repositories/delivery.repository"
import type { BinaryObjectService } from "../../src/app/binary-object/services/binary-object.service"
import { DEMO_STATION } from "./clinical-record"
import type { DemoPlan, SeedContext } from "./demo-types"
import type { SeedFileStore } from "./file-store"

const FIRST_VERSION = 1
// Q-040, NAB-517
const DEMO_STATION_OS_VERSION = "demo"
const HARDWARE_ID_ENCODING = "base64url"

// CAP-021-R13, integrace-dicom.md 5.3, Q-040
async function writeDemoStation(tx: postgres.TransactionSql): Promise<void> {
	const hardwareId = createHash("sha256").update(DEMO_STATION.deviceId).digest(HARDWARE_ID_ENCODING)
	await tx`
		INSERT INTO device (id, state, public_key_jwk, hw_id, model, os_version, platform, secure_hardware,
			managed_configuration)
		VALUES (${DEMO_STATION.deviceId}, ${DEVICE_STATE.APPROVED}, '{}'::jsonb, ${hardwareId}, ${DEMO_STATION.model},
			${DEMO_STATION_OS_VERSION}, ${DEVICE_PLATFORM.ANDROID}, ${SECURE_HARDWARE.UNKNOWN}, false)
		ON CONFLICT (id) DO NOTHING
	`
}

// CAP-020-R13
async function requireNoAppRecords(tx: postgres.TransactionSql, plan: DemoPlan): Promise<void> {
	const acquisitionIds = new Set(plan.acquisitions.map((acquisition) => acquisition.id))
	const records = await tx<{ id: string }[]>`
		SELECT id FROM acquisition WHERE finding_id IN ${tx(plan.findings.map((finding) => finding.id))}
	`
	const appRecords = records.filter((record) => !acquisitionIds.has(record.id))
	if (appRecords.length > 0) {
		throw new Error(
			`${appRecords.length} records captured in the app belong to demo wounds; discard them before seeding again`,
		)
	}
}

// CAP-020-R21, CAP-025-R30
async function requireNoAppWoundTypeChanges(tx: postgres.TransactionSql, plan: DemoPlan): Promise<void> {
	const seededChangeIds = new Set(plan.changes.map((change) => change.id))
	const changes = await tx<{ id: string }[]>`
		SELECT id FROM finding_wound_type_change WHERE finding_id IN ${tx(plan.findings.map((finding) => finding.id))}
	`
	const appChanges = changes.filter((change) => !seededChangeIds.has(change.id))
	if (appChanges.length > 0) {
		throw new Error(
			`The wound type of a demo wound was changed in the app (${appChanges.length} changes); seeding again would delete that history, so reset the database instead`,
		)
	}
}

// datovy-model.md 3, CAP-021-R11
async function removeSeries(tx: postgres.TransactionSql, plan: DemoPlan): Promise<void> {
	await tx`DELETE FROM series WHERE finding_id IN ${tx(plan.findings.map((finding) => finding.id))}`
	if (plan.documents.length === 0) {
		return
	}
	await tx`DELETE FROM series WHERE document_id IN ${tx(plan.documents.map((document) => document.id))}`
}

// CAP-021-R03, CAP-021-R36, CAP-021-R40, dorucovaci-jadro.md 3
async function removeProduced(tx: postgres.TransactionSql, acquisitionIds: readonly string[]): Promise<string[]> {
	const ids = tx([...acquisitionIds])
	const produced = await tx<{ id: string }[]>`
		SELECT variant.binary_object_id AS id
		FROM artifact_variant variant JOIN artifact ON artifact.id = variant.artifact_id
		WHERE artifact.acquisition_id IN ${ids}
		UNION
		SELECT output_pdf_binary_object_id FROM document
		WHERE acquisition_id IN ${ids} AND output_pdf_binary_object_id IS NOT NULL
		UNION
		SELECT viewing_copy_binary_object_id FROM image
		WHERE acquisition_id IN ${ids} AND viewing_copy_binary_object_id IS NOT NULL
		UNION
		SELECT page.viewing_copy_binary_object_id FROM document_page page JOIN document ON document.id = page.document_id
		WHERE document.acquisition_id IN ${ids} AND page.viewing_copy_binary_object_id IS NOT NULL
	`
	const tasks = await tx<{ id: string }[]>`
		SELECT task.id FROM queue_task task
		WHERE task.object_id IN ${ids}
			OR task.object_id IN (SELECT id FROM image WHERE acquisition_id IN ${ids})
			OR task.object_id IN (SELECT id FROM document WHERE acquisition_id IN ${ids})
			OR task.object_id IN (
				SELECT page.id FROM document_page page JOIN document ON document.id = page.document_id
				WHERE document.acquisition_id IN ${ids}
			)
			OR task.object_id IN (
				SELECT instance.id FROM delivery_instance instance JOIN delivery ON delivery.id = instance.delivery_id
				WHERE delivery.acquisition_id IN ${ids}
			)
	`
	const taskIds = tasks.map((task) => task.id)
	await tx`DELETE FROM administrator_alert WHERE delivery_id IN (SELECT id FROM delivery WHERE acquisition_id IN ${ids})`
	if (taskIds.length > 0) {
		await tx`DELETE FROM administrator_alert WHERE queue_task_id IN ${tx(taskIds)}`
		await tx`DELETE FROM queue_task WHERE id IN ${tx(taskIds)}`
	}
	await tx`DELETE FROM delivery_instance WHERE delivery_id IN (SELECT id FROM delivery WHERE acquisition_id IN ${ids})`
	await tx`DELETE FROM artifact_variant WHERE artifact_id IN (SELECT id FROM artifact WHERE acquisition_id IN ${ids})`
	await tx`DELETE FROM artifact WHERE acquisition_id IN ${ids}`
	await tx`DELETE FROM delivery WHERE acquisition_id IN ${ids}`
	return produced.map((row) => row.id)
}

// CAP-026-R17
export async function removeSeeded(
	tx: postgres.TransactionSql,
	plan: DemoPlan,
	files: AcquisitionFileRepository,
	binaries: BinaryObjectService,
): Promise<string[]> {
	const acquisitionIds = plan.acquisitions.map((acquisition) => acquisition.id)
	if (acquisitionIds.length === 0 || plan.findings.length === 0) {
		throw new Error("The demo plan has no wound records")
	}
	await requireNoAppRecords(tx, plan)
	await requireNoAppWoundTypeChanges(tx, plan)
	const binaryObjectIds: string[] = []
	for (const acquisition of plan.acquisitions) {
		binaryObjectIds.push(...(await files.binaryObjectIdsOf(tx, acquisition.id, acquisition.kind)))
	}
	binaryObjectIds.push(...(await removeProduced(tx, acquisitionIds)))
	await removeSeries(tx, plan)
	await tx`DELETE FROM acquisition WHERE id IN ${tx(acquisitionIds)}`
	await binaries.removeAll(tx, binaryObjectIds)
	return binaryObjectIds
}

// CAP-014-R03, CAP-014-R06, CAP-014-R20
export async function writeEncounters(
	tx: postgres.TransactionSql,
	plan: DemoPlan,
	context: SeedContext,
): Promise<void> {
	for (const encounter of plan.encounters) {
		await tx`
			INSERT INTO encounter (
				id, patient_id, source, status, date, department_id, started_at, encounter_key, completed_at,
				completed_by, study_instance_uid, status_changed_at, created_at, updated_at
			) VALUES (
				${encounter.id}, ${encounter.patient_id}, ${ENCOUNTER_SOURCE.CREATED_IN_APP}, ${ENCOUNTER_STATUS.COMPLETED},
				${encounter.date}::date, ${context.departmentId}, ${encounter.started_at}, ${encounter.encounter_key},
				${encounter.completed_at}, ${context.operatorUserId}, ${encounter.study_instance_uid},
				${encounter.completed_at}, ${encounter.started_at}, ${encounter.completed_at}
			)
			ON CONFLICT (id) DO UPDATE SET
				status = EXCLUDED.status, date = EXCLUDED.date, department_id = EXCLUDED.department_id,
				started_at = EXCLUDED.started_at, completed_at = EXCLUDED.completed_at,
				completed_by = EXCLUDED.completed_by, status_changed_at = EXCLUDED.status_changed_at,
				updated_at = EXCLUDED.updated_at
		`
	}
}

// CAP-014-R14, CAP-020-R13, CAP-020-R19, CAP-021-R25, ADR-006
export async function writeRecords(tx: postgres.TransactionSql, plan: DemoPlan, context: SeedContext): Promise<void> {
	await writeDemoStation(tx)
	const acquisitions = plan.acquisitions.map((acquisition) => ({
		...acquisition,
		finding_id: null,
		state: ACQUISITION_STATE.RECEIVED,
		closing_device_id: DEMO_STATION.deviceId,
		operator_user_id: context.operatorUserId,
		department_id: context.departmentId,
		configuration_version_id: context.configurationVersionId,
		version: FIRST_VERSION,
		closed_wound_type_code_list_version: acquisition.closed_wound_type_code === null ? null : context.codeListVersion,
		created_at: acquisition.started_at,
		updated_at: acquisition.closed_at,
	}))
	await tx`
		INSERT INTO acquisition ${tx(
			acquisitions,
			"id",
			"idempotency_key",
			"patient_id",
			"encounter_id",
			"finding_id",
			"kind",
			"state",
			"operator_user_id",
			"department_id",
			"configuration_version_id",
			"started_at",
			"closed_at",
			"closing_device_id",
			"file_count",
			"closed_wound_type_code",
			"closed_wound_type_code_list_version",
			"version",
			"created_at",
			"updated_at",
		)}
	`
	const findings = plan.findings.map((finding) => ({
		...finding,
		department_id: context.departmentId,
		created_by: context.operatorUserId,
		wound_type_code_list_version: context.codeListVersion,
		wound_type_set_by: context.operatorUserId,
	}))
	await tx`
		INSERT INTO finding ${tx(
			findings,
			"id",
			"patient_id",
			"department_id",
			"finding_key",
			"origin_acquisition_id",
			"created_by",
			"created_at",
			"wound_type_code",
			"wound_type_code_list_version",
			"wound_type_set_by",
		)}
	`
	// CAP-020-R23, clinical-workflow.yaml Finding.number
	const inClosureOrder = [...plan.acquisitions].sort(
		(left, right) => left.closed_at.getTime() - right.closed_at.getTime() || left.id.localeCompare(right.id),
	)
	for (const acquisition of inClosureOrder) {
		if (acquisition.finding_id !== null) {
			await tx`UPDATE acquisition SET finding_id = ${acquisition.finding_id} WHERE id = ${acquisition.id}`
		}
	}
	await writeWoundContent(tx, plan, context)
	await queueAssemblies(tx, inClosureOrder)
}

// CAP-021-R03, CAP-021-R29, ADR-005 ř. 21
async function queueAssemblies(tx: postgres.TransactionSql, acquisitions: readonly { id: string }[]): Promise<void> {
	const acquisitionIds = acquisitions.map((acquisition) => acquisition.id)
	await new DeliveryRepository().createWaitingAll(tx, acquisitionIds)
	await new AssemblyTaskRepository().enqueueAll(tx, acquisitionIds)
}

async function writeWoundContent(tx: postgres.TransactionSql, plan: DemoPlan, context: SeedContext): Promise<void> {
	await tx`
		INSERT INTO body_site ${tx(
			plan.sites,
			"acquisition_id",
			"region_code",
			"laterality",
			"view",
			"x",
			"y",
			"body_diagram_version",
		)}
	`
	const assessments = plan.assessments.map((assessment) => ({
		...assessment,
		code_list_version: context.codeListVersion,
	}))
	await tx`
		INSERT INTO assessment ${tx(
			assessments,
			"acquisition_id",
			"healing_phase_code",
			"code_list_version",
			"description",
			"updated_at",
		)}
	`
	if (plan.changes.length === 0) {
		return
	}
	const changes = plan.changes.map((change) => ({
		...change,
		changed_by: context.operatorUserId,
		previous_wound_type_code_list_version: context.codeListVersion,
		wound_type_code_list_version: context.codeListVersion,
	}))
	await tx`
		INSERT INTO finding_wound_type_change ${tx(
			changes,
			"id",
			"finding_id",
			"changed_at",
			"changed_by",
			"previous_wound_type_code",
			"previous_wound_type_code_list_version",
			"wound_type_code",
			"wound_type_code_list_version",
		)}
	`
}

// CAP-015-R35, CAP-021-R35, ADR-026
export async function writeImages(tx: postgres.TransactionSql, plan: DemoPlan, files: SeedFileStore): Promise<void> {
	for (const image of plan.images) {
		const { original, thumbnail } = await files.store(tx, image)
		await tx`
			INSERT INTO image (
				id, acquisition_id, file_key, sequence, status, binary_object_id, sha256, original_upload_sha256,
				announced_at, received_at
			) VALUES (
				${image.id}, ${image.acquisition_id}, ${image.file_key}, ${image.sequence}, ${FILE_STATUS.RECEIVED},
				${original.id}, ${original.sha256}, ${original.sha256}, ${image.received_at}, ${image.received_at}
			)
		`
		await tx`INSERT INTO thumbnail (image_id, binary_object_id) VALUES (${image.id}, ${thumbnail.id})`
	}
}

// CAP-018-R11, CAP-018-R15, Q-128
export async function writeDocuments(
	tx: postgres.TransactionSql,
	plan: DemoPlan,
	context: SeedContext,
	files: SeedFileStore,
): Promise<void> {
	for (const document of plan.documents) {
		const titleCode = context.titleCodes.get(document.title)
		if (titleCode === undefined) {
			throw new Error(`The demo document ${document.id} names the unknown title ${document.title}`)
		}
		await tx`
			INSERT INTO document (id, acquisition_id, title_code, title_code_list_version)
			VALUES (${document.id}, ${document.acquisition_id}, ${titleCode}, ${context.codeListVersion})
		`
		for (const page of plan.pages.filter((candidate) => candidate.acquisition_id === document.acquisition_id)) {
			const { original, thumbnail } = await files.store(tx, page)
			await tx`
				INSERT INTO document_page (
					id, document_id, file_key, sequence, status, binary_object_id, thumbnail_binary_object_id, sha256,
					original_upload_sha256, announced_at, received_at
				) VALUES (
					${page.id}, ${document.id}, ${page.file_key}, ${page.sequence}, ${FILE_STATUS.RECEIVED}, ${original.id},
					${thumbnail.id}, ${original.sha256}, ${original.sha256}, ${page.received_at}, ${page.received_at}
				)
			`
		}
	}
}

// CAP-014-R02
export async function assignWorklistDepartment(tx: postgres.TransactionSql, context: SeedContext): Promise<number> {
	const rows = await tx`
		UPDATE encounter SET department_id = ${context.departmentId}, updated_at = now()
		WHERE source = ${ENCOUNTER_SOURCE.WORKLIST} AND department_id IS NULL AND date >= CURRENT_DATE
		RETURNING id
	`
	return rows.length
}
