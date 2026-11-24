import { createHash, randomUUID } from "node:crypto"
import {
	ACQUISITION_KIND,
	ADMINISTRATOR_ALERT_KIND,
	ASSEMBLY_FAILURE_REASON,
	DELIVERY_CLOSURE_REASON,
	DELIVERY_INSTANCE_STATE,
	DELIVERY_STATE,
	ENCOUNTER_STATUS,
	HELD_FOR_REVIEW_CAUSE,
} from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, JOB_KIND, JOB_OBJECT_KIND, JOB_STATE } from "@ansora/core-server"
import { ACQUISITION_STATE, ENCOUNTER_SOURCE, SOP_CLASS, uidOfUuid } from "@ansora/vulna-domain"
import postgres from "@veevoy/postgres"
import { afterAll, describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import { FILE_STATUS } from "../../acquisition/constants/acquisition-file.constants"
import { AssemblyTaskRepository } from "../../acquisition/repositories/assembly-task.repository"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { ARTIFACT_SOURCE_KIND } from "../../clinical-record/constants/clinical-record.constants"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import { OperationalMetricsRepository } from "../../monitoring/repositories/operational-metrics.repository"
import { AdministratorAlertAcknowledgementService } from "../../monitoring/services/administrator-alert-acknowledgement.service"
import { DeliveryOverviewRepository } from "../repositories/delivery-overview.repository"
import { MonitoredDeliveryRepository } from "../repositories/monitored-delivery.repository"
import { DeliveryClosureService } from "../services/delivery-closure.service"
import { DeliveryOverviewService } from "../services/delivery-overview.service"
import { TextRecognitionRestartService } from "../services/text-recognition-restart.service"
import { ADMINISTRATOR, PACS, RESTART_REASON } from "./delivery-monitoring-fixtures"

type Transaction = postgres.TransactionSql

const DATABASE_URL_VARIABLE = "API_SQL_TEST_DATABASE_URL"
// ADR-021, datovy-model.md 9
const API_ROLE = "vulna_api"
const JPEG_BASELINE = "1.2.840.10008.1.2.4.50"
const PAGE_LIMIT = 1
const FIRST_SEQUENCE = 1
const SECOND_SEQUENCE = 2
const { CONFIRMED, HELD_FOR_REVIEW, PERMANENTLY_FAILED, CLOSED_BY_ADMINISTRATOR } = DELIVERY_INSTANCE_STATE
const { NOT_REQUIRED, WRONG_PATIENT_OR_ENCOUNTER } = DELIVERY_CLOSURE_REASON

const ADMINISTRATOR_MARK = ":administrator"

class RolledBack extends Error {}

interface Instance {
	id: string
	objectIds: string[]
}

interface RecordFixture {
	acquisitionId: string
	deliveryId: string
	firstPhoto: Instance
	secondPhoto: Instance
	administrator: AdministrationSession
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

function transactionalDatabaseOf(tx: Transaction): DatabaseService {
	return {
		sql: { begin: async (work: (inner: Transaction) => unknown) => await work(tx) },
	} as unknown as DatabaseService
}

function withAdministrator(change: string, record: RecordFixture): string {
	return change.replaceAll(ADMINISTRATOR_MARK, `'${record.administrator.userId}'`)
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
		INSERT INTO binary_object (id, size_bytes, sha256)
		VALUES (${id}, ${bytes.length}, ${createHash("sha256").update(bytes).digest("hex")})
	`
	return id
}

// datovy-model.md 4 „Artefakt“, „Doručení“
async function instanceOf(
	tx: Transaction,
	record: { acquisitionId: string; deliveryId: string; sequence: number },
	state: typeof CONFIRMED | typeof HELD_FOR_REVIEW,
): Promise<Instance> {
	const imageObjectId = await storedObject(tx)
	const imageId = randomUUID()
	await tx`
		INSERT INTO image (id, acquisition_id, file_key, sequence, status, binary_object_id, received_at)
		VALUES (${imageId}, ${record.acquisitionId}, ${randomUUID()}, ${record.sequence}, ${FILE_STATUS.RECEIVED},
			${imageObjectId}, now())
	`
	const artifactId = randomUUID()
	await tx`
		INSERT INTO artifact (id, acquisition_id, sop_class_uid, sop_instance_uid, source_kind, source_id, target)
		VALUES (${artifactId}, ${record.acquisitionId}, ${SOP_CLASS.VL_PHOTOGRAPHIC_IMAGE}, ${uidOfUuid(randomUUID())},
			${ARTIFACT_SOURCE_KIND.IMAGE}, ${imageId}, ${PACS})
	`
	const variantObjectId = await storedObject(tx)
	await tx`
		INSERT INTO artifact_variant (artifact_id, transfer_syntax, dataset_sha256, binary_object_id)
		VALUES (${artifactId}, ${JPEG_BASELINE}, ${"a".repeat(64)}, ${variantObjectId})
	`
	const id = randomUUID()
	const isConfirmed = state === CONFIRMED
	await tx`
		INSERT INTO delivery_instance (id, delivery_id, artifact_id, state, attempts, last_dimse_status, retention_anchor,
			held_for_review_cause)
		VALUES (${id}, ${record.deliveryId}, ${artifactId}, ${state}, 1, ${isConfirmed ? "B000" : "C002"},
			${isConfirmed ? new Date() : null}, ${isConfirmed ? null : HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS})
	`
	return { id, objectIds: [imageObjectId, variantObjectId] }
}

// datovy-model.md 4 „Pořízení“, „Doručení“, „Úloha fronty“
interface EncounterFixture {
	patientId: string
	encounterId: string
	administratorId: string
}

async function encounterOf(tx: Transaction): Promise<EncounterFixture> {
	const patientId = randomUUID()
	const encounterId = randomUUID()
	const administratorId = randomUUID()
	await tx`INSERT INTO patient_cache (id) VALUES (${patientId})`
	await tx`INSERT INTO app_user (id, given_name, family_name) VALUES (${administratorId}, 'Test', 'Správce')`
	await tx`
		INSERT INTO encounter (id, patient_id, source, encounter_key, status, date, study_instance_uid)
		VALUES (${encounterId}, ${patientId}, ${ENCOUNTER_SOURCE.CREATED_IN_APP}, ${`sql-test-${encounterId}`},
			${ENCOUNTER_STATUS.IN_PROGRESS}, current_date, ${uidOfUuid(encounterId)})
	`
	return { patientId, encounterId, administratorId }
}

async function recordOf(
	tx: Transaction,
	firstPhotoState: typeof CONFIRMED | typeof HELD_FOR_REVIEW,
): Promise<RecordFixture> {
	const { patientId, encounterId, administratorId } = await encounterOf(tx)
	const acquisitionId = randomUUID()
	const deliveryId = randomUUID()
	const isHeld = firstPhotoState === HELD_FOR_REVIEW
	await tx`
		INSERT INTO acquisition (id, idempotency_key, patient_id, encounter_id, kind, state, operator_user_id,
			configuration_version_id, started_at, closed_at, file_count)
		VALUES (${acquisitionId}, ${randomUUID()}, ${patientId}, ${encounterId}, ${ACQUISITION_KIND.PHOTO},
			${isHeld ? ACQUISITION_STATE.FAILED : ACQUISITION_STATE.DELIVERED}, ${administratorId},
			(SELECT max(id) FROM configuration_version), now(), now(), 2)
	`
	await tx`
		INSERT INTO delivery (id, acquisition_id, target, state)
		VALUES (${deliveryId}, ${acquisitionId}, ${PACS}, ${DELIVERY_STATE.ASSEMBLED})
	`
	const record = { acquisitionId, deliveryId }
	const secondPhoto = await instanceOf(tx, { ...record, sequence: SECOND_SEQUENCE }, CONFIRMED)
	const firstPhoto = await instanceOf(tx, { ...record, sequence: FIRST_SEQUENCE }, firstPhotoState)
	if (isHeld) {
		await tx`
			INSERT INTO queue_task (id, kind, object_kind, object_id, state)
			VALUES (${randomUUID()}, ${JOB_KIND.DELIVERY}, ${JOB_OBJECT_KIND.DELIVERY_INSTANCE}, ${firstPhoto.id},
				${JOB_STATE.FAILED})
		`
	}
	return {
		acquisitionId,
		deliveryId,
		firstPhoto,
		secondPhoto,
		administrator: { ...ADMINISTRATOR, userId: administratorId },
	}
}

async function heldRecord(tx: Transaction): Promise<RecordFixture> {
	return await recordOf(tx, HELD_FOR_REVIEW)
}

async function deliveredRecord(tx: Transaction): Promise<RecordFixture> {
	return await recordOf(tx, CONFIRMED)
}

async function instanceAlert(
	tx: Transaction,
	kind: string,
	record: RecordFixture,
	instanceId: string,
): Promise<string> {
	const alertId = randomUUID()
	await tx`
		INSERT INTO administrator_alert (id, kind, message, delivery_id, delivery_instance_id)
		VALUES (${alertId}, ${kind}, 'test', ${record.deliveryId}, ${instanceId})
	`
	return alertId
}

function overviewOf(tx: Transaction): DeliveryOverviewService {
	return new DeliveryOverviewService(
		transactionalDatabaseOf(tx),
		new DeliveryOverviewRepository(databaseOf(tx)),
		{} as ConfigurationService,
	)
}

function closureServiceOf(tx: Transaction): DeliveryClosureService {
	return new DeliveryClosureService(
		transactionalDatabaseOf(tx),
		new MonitoredDeliveryRepository(),
		overviewOf(tx),
		new AdministratorAlertRepository(databaseOf(tx)),
		new AuditRepository(),
	)
}

function restartServiceOf(tx: Transaction): TextRecognitionRestartService {
	return new TextRecognitionRestartService(
		transactionalDatabaseOf(tx),
		new MonitoredDeliveryRepository(),
		new AssemblyTaskRepository(),
		overviewOf(tx),
		new AdministratorAlertRepository(databaseOf(tx)),
		new AuditRepository(),
	)
}

interface FailedScanFixture {
	acquisitionId: string
	deliveryId: string
	taskId: string
	alertId: string
	administrator: AdministrationSession
}

const FAILED_RECOGNITIONS = 3

// CAP-022-R11, CAP-022-S03, datovy-model.md 4 „Doručení“
async function failedScan(tx: Transaction): Promise<FailedScanFixture> {
	const { patientId, encounterId, administratorId } = await encounterOf(tx)
	const acquisitionId = randomUUID()
	const deliveryId = randomUUID()
	const taskId = randomUUID()
	const alertId = randomUUID()
	await tx`
		INSERT INTO acquisition (id, idempotency_key, patient_id, encounter_id, kind, state, operator_user_id,
			configuration_version_id, started_at, closed_at, file_count)
		VALUES (${acquisitionId}, ${randomUUID()}, ${patientId}, ${encounterId}, ${ACQUISITION_KIND.SCAN},
			${ACQUISITION_STATE.FAILED}, ${administratorId}, (SELECT max(id) FROM configuration_version), now(), now(), 1)
	`
	await tx`
		INSERT INTO document (id, acquisition_id, title_text, text_recognition_failures)
		VALUES (${randomUUID()}, ${acquisitionId}, 'Propouštěcí zpráva', ${FAILED_RECOGNITIONS})
	`
	await tx`
		INSERT INTO delivery (id, acquisition_id, target, state, reason)
		VALUES (${deliveryId}, ${acquisitionId}, ${PACS}, ${DELIVERY_STATE.ASSEMBLY_FAILED},
			${ASSEMBLY_FAILURE_REASON.OCR_FAILED})
	`
	await tx`
		INSERT INTO queue_task (id, kind, object_kind, object_id, state, attempts)
		VALUES (${taskId}, ${JOB_KIND.ASSEMBLY}, ${JOB_OBJECT_KIND.ACQUISITION}, ${acquisitionId}, ${JOB_STATE.FAILED},
			${FAILED_RECOGNITIONS})
	`
	await tx`
		INSERT INTO administrator_alert (id, kind, message, queue_task_id, delivery_id)
		VALUES (${alertId}, ${ADMINISTRATOR_ALERT_KIND.ASSEMBLY_FAILED}, 'test', ${taskId}, ${deliveryId})
	`
	return { acquisitionId, deliveryId, taskId, alertId, administrator: { ...ADMINISTRATOR, userId: administratorId } }
}

async function assemblyTasksOf(tx: Transaction, acquisitionId: string) {
	return await tx<{ id: string; state: string; attempts: number }[]>`
		SELECT id, state, attempts FROM queue_task
		WHERE kind = ${JOB_KIND.ASSEMBLY} AND object_id = ${acquisitionId}
		ORDER BY created_at
	`
}

describe("closing a delivery instance in the database ✓ CAP-023-R28, datovy-model.md 4 „Doručení“", () => {
	it("CAP-023-S24 closes the held instance under the API role, settles the record, audits and deletes nothing", async () => {
		await asApi(
			async (tx) => {
				const record = await heldRecord(tx)
				const alertId = await instanceAlert(tx, ADMINISTRATOR_ALERT_KIND.HELD_FOR_REVIEW, record, record.firstPhoto.id)
				return { record, alertId }
			},
			async (tx, { record, alertId }) => {
				const delivery = await closureServiceOf(tx).close(
					record.deliveryId,
					record.firstPhoto.id,
					{ reason: WRONG_PATIENT_OR_ENCOUNTER, note: undefined },
					record.administrator,
				)

				expect(delivery.instance.find((instance) => instance.instance_id === record.firstPhoto.id)).toMatchObject({
					state: CLOSED_BY_ADMINISTRATOR,
					held_for_review_cause: HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS,
					retention_anchor: null,
					closure: { reason: WRONG_PATIENT_OR_ENCOUNTER, closed_from_state: HELD_FOR_REVIEW },
				})
				const [acquisition] = await tx`SELECT state FROM acquisition WHERE id = ${record.acquisitionId}`
				expect(acquisition?.state).toBe(ACQUISITION_STATE.CLOSED_BY_ADMINISTRATOR)
				const [alert] =
					await tx`SELECT resolved_at IS NOT NULL AS is_resolved FROM administrator_alert WHERE id = ${alertId}`
				expect(alert?.is_resolved).toBe(true)
				const [audit] = await tx`
					SELECT event_type, object_id, details FROM audit
					WHERE event_type = ${AUDIT_EVENT_TYPE.DELIVERY_CLOSED} AND object_id = ${record.firstPhoto.id}
				`
				expect(audit).toMatchObject({
					details: { acquisition_id: record.acquisitionId, closed_from_state: HELD_FOR_REVIEW },
				})
				const objectIds = [...record.firstPhoto.objectIds, ...record.secondPhoto.objectIds]
				const objects = await tx`
					SELECT id FROM binary_object
					WHERE id IN ${tx(objectIds)} AND buffer_deleted_at IS NULL AND set_aside_at IS NULL
				`
				expect(objects).toHaveLength(objectIds.length)
				const tasks = await tx`SELECT state FROM queue_task WHERE object_id = ${record.firstPhoto.id}`
				expect(tasks.map((task) => task.state)).toEqual([JOB_STATE.FAILED])
			},
		)
	})

	const CLOSED = `state = '${CLOSED_BY_ADMINISTRATOR}'`
	const FROM_HELD = `closed_from_state = '${HELD_FOR_REVIEW}'`
	const DATED = "closed_at = now()"
	const BY_ANYONE = `closed_by_user_id = ${ADMINISTRATOR_MARK}`
	const WITH_REASON = `closure_reason = '${NOT_REQUIRED}'`
	it.each([
		["a closed instance without its closure", CLOSED, "delivery_instance_closure_check"],
		[
			"a closure on an instance still held",
			[FROM_HELD, DATED, BY_ANYONE, WITH_REASON].join(", "),
			"delivery_instance_closure_check",
		],
		["a closure without a reason", [CLOSED, FROM_HELD, DATED, BY_ANYONE].join(", "), "delivery_instance_closure_check"],
		[
			"a closure without its time",
			[CLOSED, FROM_HELD, BY_ANYONE, WITH_REASON].join(", "),
			"delivery_instance_closure_check",
		],
		[
			"a closure without its administrator",
			[CLOSED, FROM_HELD, DATED, WITH_REASON].join(", "),
			"delivery_instance_closure_check",
		],
		[
			"a closure from a state that cannot be closed",
			[CLOSED, `closed_from_state = '${CONFIRMED}'`, DATED, BY_ANYONE, WITH_REASON].join(", "),
			"delivery_instance_closed_from_state_check",
		],
		[
			"a reason outside the list",
			[CLOSED, FROM_HELD, DATED, BY_ANYONE, "closure_reason = 'retry'"].join(", "),
			"delivery_instance_closure_reason_check",
		],
	])("CAP-023-S26 the schema refuses %s", async (_case, change, constraint) => {
		await asApi(heldRecord, async (tx, record) => {
			await expect(
				tx.unsafe(`UPDATE delivery_instance SET ${withAdministrator(change, record)} WHERE id = $1`, [
					record.firstPhoto.id,
				]),
			).rejects.toThrow(new RegExp(constraint))
		})
	})

	it.each([
		[
			"a closure that loses the cause of the hold",
			[CLOSED, FROM_HELD, DATED, BY_ANYONE, WITH_REASON, "held_for_review_cause = NULL"].join(", "),
		],
		[
			"a closure from a permanent failure that keeps a cause of a hold",
			[CLOSED, `closed_from_state = '${PERMANENTLY_FAILED}'`, DATED, BY_ANYONE, WITH_REASON].join(", "),
		],
	])("CAP-023-R09 the schema refuses %s", async (_case, change) => {
		await asApi(heldRecord, async (tx, record) => {
			await expect(
				tx.unsafe(`UPDATE delivery_instance SET ${withAdministrator(change, record)} WHERE id = $1`, [
					record.firstPhoto.id,
				]),
			).rejects.toThrow(/delivery_instance_held_cause_check/)
		})
	})
})

describe("restarting the text recognition in the database ✓ CAP-022-R15, datovy-model.md 4 „Doručení“", () => {
	it("CAP-022-S06 sends the document back to the assembly under the API role, ends the alert and audits the reason", async () => {
		await asApi(
			async (tx) => await failedScan(tx),
			async (tx, scan) => {
				const delivery = await restartServiceOf(tx).restart(
					scan.deliveryId,
					{ reason: RESTART_REASON },
					scan.administrator,
				)

				expect(delivery).toMatchObject({ state: DELIVERY_STATE.WAITING_FOR_ASSEMBLY, reason: null, instance: [] })
				const [document] = await tx`
					SELECT text_recognition_failures FROM document WHERE acquisition_id = ${scan.acquisitionId}
				`
				expect(document?.text_recognition_failures).toBe(0)
				expect(await assemblyTasksOf(tx, scan.acquisitionId)).toEqual([
					{ id: scan.taskId, state: JOB_STATE.WAITING, attempts: 0 },
				])
				const [acquisition] = await tx`SELECT state FROM acquisition WHERE id = ${scan.acquisitionId}`
				expect(acquisition?.state).toBe(ACQUISITION_STATE.ASSEMBLING)
				const [alert] =
					await tx`SELECT resolved_at IS NOT NULL AS is_resolved FROM administrator_alert WHERE id = ${scan.alertId}`
				expect(alert?.is_resolved).toBe(true)
				const [audit] = await tx`
					SELECT actor_user_id, details FROM audit
					WHERE event_type = ${AUDIT_EVENT_TYPE.TEXT_RECOGNITION_RESTARTED} AND object_id = ${scan.deliveryId}
				`
				expect(audit).toMatchObject({
					actor_user_id: scan.administrator.userId,
					details: { acquisition_id: scan.acquisitionId, reason: RESTART_REASON },
				})
			},
		)
	})

	it("queues one new assembly when no failed assembly task of the record is left", async () => {
		await asApi(
			async (tx) => {
				const scan = await failedScan(tx)
				await tx`DELETE FROM administrator_alert WHERE id = ${scan.alertId}`
				await tx`DELETE FROM queue_task WHERE id = ${scan.taskId}`
				return scan
			},
			async (tx, scan) => {
				await restartServiceOf(tx).restart(scan.deliveryId, { reason: RESTART_REASON }, scan.administrator)

				const tasks = await assemblyTasksOf(tx, scan.acquisitionId)
				expect(tasks.map((task) => [task.state, task.attempts])).toEqual([[JOB_STATE.WAITING, 0]])
			},
		)
	})
})

describe("acknowledging a warning in the database ✓ CAP-023-R12, administration.yaml acknowledgeAdministratorAlert", () => {
	it("CAP-023-S28 ends the warning under the API role with the administrator, the time of its end and the audit", async () => {
		await asApi(
			async (tx) => {
				const record = await heldRecord(tx)
				const alertId = await instanceAlert(
					tx,
					ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING,
					record,
					record.secondPhoto.id,
				)
				return { record, alertId }
			},
			async (tx, { record, alertId }) => {
				const service = new AdministratorAlertAcknowledgementService(
					transactionalDatabaseOf(tx),
					new AdministratorAlertRepository(databaseOf(tx)),
					new AuditRepository(),
				)

				await service.acknowledge(alertId, record.administrator)

				const [alert] = await tx`
					SELECT resolved_at = acknowledged_at AS is_ended_by_acknowledgement, acknowledged_by_user_id
					FROM administrator_alert WHERE id = ${alertId}
				`
				expect(alert).toEqual({
					is_ended_by_acknowledgement: true,
					acknowledged_by_user_id: record.administrator.userId,
				})
				const audits = await tx`
					SELECT 1 FROM audit
					WHERE event_type = ${AUDIT_EVENT_TYPE.ADMINISTRATOR_ALERT_ACKNOWLEDGED} AND object_id = ${alertId}
				`
				expect(audits).toHaveLength(1)
			},
		)
	})

	const ACKNOWLEDGED_BY = `acknowledged_by_user_id = ${ADMINISTRATOR_MARK}`
	it.each([
		[
			ADMINISTRATOR_ALERT_KIND.HELD_FOR_REVIEW,
			"an alert of another kind",
			`resolved_at = now(), acknowledged_at = now(), ${ACKNOWLEDGED_BY}`,
		],
		[
			ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING,
			"an acknowledgement without its administrator",
			"resolved_at = now(), acknowledged_at = now()",
		],
		[
			ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING,
			"an administrator without the time",
			`resolved_at = now(), ${ACKNOWLEDGED_BY}`,
		],
		[
			ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING,
			"an acknowledgement at another time than the end",
			`resolved_at = now(), acknowledged_at = now() - interval '1 minute', ${ACKNOWLEDGED_BY}`,
		],
		[
			ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING,
			"an acknowledgement of a warning still active",
			`acknowledged_at = now(), ${ACKNOWLEDGED_BY}`,
		],
		[ADMINISTRATOR_ALERT_KIND.STORED_WITH_WARNING, "a warning ended without an acknowledgement", "resolved_at = now()"],
	])("CAP-023-R12 the schema refuses on %s %s", async (kind, _case, change) => {
		await asApi(
			async (tx) => {
				const record = await heldRecord(tx)
				return { record, alertId: await instanceAlert(tx, kind, record, record.secondPhoto.id) }
			},
			async (tx, { record, alertId }) => {
				await expect(
					tx.unsafe(`UPDATE administrator_alert SET ${withAdministrator(change, record)} WHERE id = $1`, [alertId]),
				).rejects.toThrow(/administrator_alert_acknowledgement_check/)
			},
		)
	})
})

describe("reading the deliveries in the database ✓ NAB-345, administration.yaml listDeliveries", () => {
	it("NAB-345 finds the deliveries by the state of an instance and pages through them newest first by cursor", async () => {
		await asApi(
			async (tx) => {
				const held = [await heldRecord(tx), await heldRecord(tx)]
				const delivered = await deliveredRecord(tx)
				return { held, delivered }
			},
			async (tx, { held, delivered }) => {
				const overview = new DeliveryOverviewRepository(databaseOf(tx))
				const ownIds = [...held, delivered].map((record) => record.deliveryId)
				const heldIds = held.map((record) => record.deliveryId)
				const newestFirst = [...ownIds].sort().reverse()
				const query = { cursor: undefined, state: undefined, instanceState: undefined }

				const withHeld = await overview.page(tx, {
					...query,
					limit: ownIds.length,
					state: DELIVERY_STATE.ASSEMBLED,
					instanceState: HELD_FOR_REVIEW,
				})
				const first = await overview.page(tx, { ...query, limit: PAGE_LIMIT })
				const second = await overview.page(tx, { ...query, limit: PAGE_LIMIT, cursor: first.nextCursor ?? undefined })

				const foundOwn = withHeld.rows.map((row) => row.id).filter((id) => ownIds.includes(id))
				expect(new Set(foundOwn)).toEqual(new Set(heldIds))
				expect([...first.rows, ...second.rows].map((row) => row.id)).toEqual(newestFirst.slice(0, 2))
			},
		)
	})

	it("CAP-015-R33 nests the instances of a delivery in the order the photos were taken and reads the targets", async () => {
		await asApi(heldRecord, async (tx, record) => {
			const overview = new DeliveryOverviewRepository(databaseOf(tx))

			const instances = await overview.instancesOf(tx, [record.deliveryId])

			expect(instances.map((instance) => instance.id)).toEqual([record.firstPhoto.id, record.secondPhoto.id])
			const found = await overview.find(tx, record.deliveryId)

			expect(found).toMatchObject({ id: record.deliveryId, target: PACS, acquisition_kind: ACQUISITION_KIND.PHOTO })
			expect(found?.acquisition_closed_at).toBeInstanceOf(Date)
			expect((await overview.targets()).map((target) => target.code)).toContain(PACS)
		})
	})

	it("CAP-028-R12 counts the held instances of the delivery queue", async () => {
		await asApi(
			async (tx) => {
				const before = await new OperationalMetricsRepository(databaseOf(tx)).current()
				await heldRecord(tx)
				await heldRecord(tx)
				return before
			},
			async (tx, before) => {
				const after = await new OperationalMetricsRepository(databaseOf(tx)).current()

				expect(after.delivery_held_for_review - before.delivery_held_for_review).toBe(2)
				expect(after.delivery_permanently_failed - before.delivery_permanently_failed).toBe(0)
				expect(after.delivery_waiting - before.delivery_waiting).toBe(0)
				expect(after.delivery_assembly_failed - before.delivery_assembly_failed).toBe(0)
			},
		)
	})
})
