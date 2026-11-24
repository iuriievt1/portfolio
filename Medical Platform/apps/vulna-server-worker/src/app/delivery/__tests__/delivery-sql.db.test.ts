import { randomUUID } from "node:crypto"
import { setTimeout as sleep } from "node:timers/promises"
import {
	ACQUISITION_KIND,
	ADMINISTRATOR_ALERT_KIND,
	DELIVERY_CLOSURE_REASON,
	DELIVERY_INSTANCE_STATE,
	DELIVERY_STATE,
	DELIVERY_TARGET,
	DELIVERY_TARGET_STATE,
	type DeliveryInstanceState,
	HELD_FOR_REVIEW_CAUSE,
} from "@ansora/contracts"
import { JOB_KIND, JOB_OBJECT_KIND, JOB_STATE } from "@ansora/core-server"
import { ACQUISITION_STATE, SOP_CLASS } from "@ansora/vulna-domain"
import type postgres from "@veevoy/postgres"
import { afterAll, describe, expect, it } from "vitest"
import { closedPhoto } from "../../assembly/__tests__/assembly-sql-fixtures"
import { ASSEMBLY_FAILURE } from "../../assembly/constants/assembly.constants"
import {
	administrator,
	asWorker,
	becomeWorker,
	closedRecord,
	databaseOf,
	queuedTask,
	storedObject,
	taskRow,
	workerSessions,
} from "../../clinical-record-upload/__tests__/sql-fixtures"
import { DeliveryAlertRepository } from "../repositories/delivery-alert.repository"
import { DeliveryInstanceRepository } from "../repositories/delivery-instance.repository"
import { DeliveryTargetRepository } from "../repositories/delivery-target.repository"
import type { InstanceTransition } from "../types/delivery.types"

type Transaction = postgres.TransactionSql

const JPEG_BASELINE = "1.2.840.10008.1.2.4.50"
const LOCKED_BY = "worker-run-sql"
const LEASE_MILLISECONDS = 160_000
const ALERT_SECONDS = 3600
const SHORT_ALERT_SECONDS = 60
const LOCK_POLLS = 100
const LOCK_POLL_MILLISECONDS = 50
const PACS = DELIVERY_TARGET.PACS
const {
	WAITING,
	SENDING,
	PENDING_VERIFICATION,
	CONFIRMED,
	PERMANENTLY_FAILED,
	HELD_FOR_REVIEW,
	CLOSED_BY_ADMINISTRATOR,
} = DELIVERY_INSTANCE_STATE

interface AssembledRecord {
	acquisitionId: string
	deliveryId: string
	instanceIds: string[]
	taskIds: string[]
}

interface CommittedRecord {
	acquisitionId: string
	encounterId: string
	deliveryId: string
	instanceIds: [string, string]
}

afterAll(async () => {
	await administrator.end()
})

function uid(): string {
	return `2.25.${BigInt(`0x${randomUUID().replaceAll("-", "")}`)}`
}

// datovy-model.md 4 „Doručení“
async function assembledRecord(tx: Transaction, imageCount = 2): Promise<AssembledRecord> {
	const photo = await closedPhoto(tx, imageCount)
	await tx`UPDATE delivery SET state = 'assembled' WHERE id = ${photo.deliveryId}`
	await tx`UPDATE acquisition SET state = ${ACQUISITION_STATE.ASSEMBLING} WHERE id = ${photo.acquisitionId}`
	const instanceIds: string[] = []
	const taskIds: string[] = []
	for (const imageId of photo.imageIds) {
		const artifactId = randomUUID()
		await tx`
			INSERT INTO artifact (id, acquisition_id, sop_class_uid, sop_instance_uid, source_kind, source_id, target)
			VALUES (${artifactId}, ${photo.acquisitionId}, ${SOP_CLASS.VL_PHOTOGRAPHIC_IMAGE}, ${uid()}, 'image', ${imageId}, ${PACS})
		`
		const object = await storedObject(tx, `variant of ${artifactId}`)
		await tx`
			INSERT INTO artifact_variant (artifact_id, transfer_syntax, dataset_sha256, binary_object_id)
			VALUES (${artifactId}, ${JPEG_BASELINE}, ${"a".repeat(64)}, ${object.id})
		`
		const instanceId = randomUUID()
		await tx`
			INSERT INTO delivery_instance (id, delivery_id, artifact_id, state)
			VALUES (${instanceId}, ${photo.deliveryId}, ${artifactId}, ${WAITING})
		`
		instanceIds.push(instanceId)
		taskIds.push(
			await queuedTask(tx, {
				kind: JOB_KIND.DELIVERY,
				objectKind: JOB_OBJECT_KIND.DELIVERY_INSTANCE,
				objectId: instanceId,
				state: JOB_STATE.WAITING,
				runAfterSeconds: -1,
			}),
		)
	}
	return { acquisitionId: photo.acquisitionId, deliveryId: photo.deliveryId, instanceIds, taskIds }
}

// datovy-model.md 4 „Doručení“ delivery_instance_closure_check
async function movedTo(
	tx: Transaction,
	record: AssembledRecord,
	instanceId: string,
	state: DeliveryInstanceState,
): Promise<void> {
	if (state !== CLOSED_BY_ADMINISTRATOR) {
		await tx`UPDATE delivery_instance SET state = ${state} WHERE id = ${instanceId}`
		return
	}
	await tx`
		UPDATE delivery_instance SET state = ${CLOSED_BY_ADMINISTRATOR}, closed_from_state = ${PERMANENTLY_FAILED},
			closed_at = now(), closure_reason = ${DELIVERY_CLOSURE_REASON.NOT_REQUIRED},
			closed_by_user_id = (SELECT operator_user_id FROM acquisition WHERE id = ${record.acquisitionId})
		WHERE id = ${instanceId}
	`
}

function first(values: readonly string[]): string {
	const [value] = values
	if (value === undefined) {
		throw new Error("the fixture has no row")
	}
	return value
}

function transition(from: string, to: string, change: Partial<InstanceTransition> = {}): InstanceTransition {
	return {
		from: from as InstanceTransition["from"],
		to: to as InstanceTransition["to"],
		countedAttempts: 0,
		statusHex: undefined,
		acceptedTransferSyntax: undefined,
		heldForReviewCause: undefined,
		verificationRejections: 0,
		isOnHold: false,
		...change,
	}
}

async function claim(tx: Transaction) {
	const instances = new DeliveryInstanceRepository(databaseOf(tx))
	return await instances.queue.claim(
		{
			kind: JOB_KIND.DELIVERY,
			objectKinds: [JOB_OBJECT_KIND.DELIVERY_INSTANCE],
			condition: instances.claimCondition(),
			countsAttempts: false,
		},
		LOCKED_BY,
		LEASE_MILLISECONDS,
	)
}

async function targetState(tx: Transaction): Promise<string | undefined> {
	const [row] = await tx<{ state: string }[]>`SELECT state FROM delivery_target WHERE code = ${PACS}`
	return row?.state
}

async function retentionAnchorOf(tx: Transaction, instanceId: string): Promise<Date | null | undefined> {
	const [row] = await tx<{ retention_anchor: Date | null }[]>`
		SELECT retention_anchor FROM delivery_instance WHERE id = ${instanceId}
	`
	return row?.retention_anchor
}

async function acquisitionState(tx: Transaction, acquisitionId: string): Promise<string | undefined> {
	const [row] = await tx<{ state: string }[]>`SELECT state FROM acquisition WHERE id = ${acquisitionId}`
	return row?.state
}

async function committedRecord(): Promise<CommittedRecord> {
	return await administrator.begin(async (tx) => {
		const { acquisitionId, encounterId } = await closedRecord(tx, ACQUISITION_KIND.PHOTO)
		await tx`UPDATE acquisition SET state = ${ACQUISITION_STATE.ASSEMBLING} WHERE id = ${acquisitionId}`
		const deliveryId = randomUUID()
		await tx`INSERT INTO delivery (id, acquisition_id, target, state) VALUES (${deliveryId}, ${acquisitionId}, ${PACS}, ${DELIVERY_STATE.ASSEMBLED})`
		const instanceIds: string[] = []
		for (let index = 0; index < 2; index += 1) {
			const artifactId = randomUUID()
			await tx`
				INSERT INTO artifact (id, acquisition_id, sop_class_uid, sop_instance_uid, source_kind, source_id, target)
				VALUES (${artifactId}, ${acquisitionId}, ${SOP_CLASS.VL_PHOTOGRAPHIC_IMAGE}, ${uid()}, 'image', ${randomUUID()}, ${PACS})
			`
			const instanceId = randomUUID()
			await tx`
				INSERT INTO delivery_instance (id, delivery_id, artifact_id, state)
				VALUES (${instanceId}, ${deliveryId}, ${artifactId}, ${SENDING})
			`
			instanceIds.push(instanceId)
		}
		const [firstId, secondId] = instanceIds
		if (firstId === undefined || secondId === undefined) {
			throw new Error("the fixture has two instances")
		}
		return { acquisitionId, encounterId, deliveryId, instanceIds: [firstId, secondId] }
	})
}

async function removeCommitted(record: CommittedRecord): Promise<void> {
	await administrator.begin(async (tx) => {
		const [acquisition] = await tx<{ patient_id: string; operator_user_id: string }[]>`
			SELECT patient_id, operator_user_id FROM acquisition WHERE id = ${record.acquisitionId}
		`
		await tx`DELETE FROM queue_task WHERE object_id = ${record.acquisitionId}`
		await tx`DELETE FROM delivery_instance WHERE delivery_id = ${record.deliveryId}`
		await tx`DELETE FROM artifact WHERE acquisition_id = ${record.acquisitionId}`
		await tx`DELETE FROM delivery WHERE id = ${record.deliveryId}`
		await tx`DELETE FROM fhir_resource_link WHERE local_id = ${record.encounterId}`
		await tx`DELETE FROM acquisition WHERE id = ${record.acquisitionId}`
		await tx`DELETE FROM encounter WHERE id = ${record.encounterId}`
		await tx`DELETE FROM app_user WHERE id = ${acquisition?.operator_user_id ?? null}`
		await tx`DELETE FROM patient_cache WHERE id = ${acquisition?.patient_id ?? null}`
	})
}

async function untilBlockedBy(pid: number): Promise<void> {
	for (let poll = 0; poll < LOCK_POLLS; poll += 1) {
		const [row] = await administrator<{ blocked: number }[]>`
			SELECT count(*)::int AS blocked FROM pg_stat_activity WHERE ${pid} = ANY (pg_blocking_pids(pid))
		`
		if (row?.blocked === 1) {
			return
		}
		await sleep(LOCK_POLL_MILLISECONDS)
	}
	throw new Error(`no session waited for the worker ${pid}`)
}

// datovy-model.md 4, dorucovaci-jadro.md 5, ADR-021
describe("delivery SQL under the worker role", () => {
	it("datovy-model.md 4 claims a delivery at an active target without counting the claim as an attempt", async () => {
		await asWorker(
			async (tx) => await assembledRecord(tx, 1),
			async (tx, record) => {
				const claimed = await claim(tx)

				expect(claimed?.objectId).toBe(first(record.instanceIds))
				expect((await taskRow(tx, first(record.taskIds)))?.attempts).toBe(0)
			},
		)
	})

	it("CAP-023-R23, CAP-023-R24 claims nothing behind a paused or unavailable target", async () => {
		await asWorker(
			async (tx) => await assembledRecord(tx, 1),
			async (tx) => {
				const targets = new DeliveryTargetRepository(databaseOf(tx))
				expect(await targets.markUnavailable(tx, PACS, "STORE.NOT_SENT")).toBe(true)
				expect(await claim(tx)).toBeUndefined()

				expect(await targets.pause(tx, PACS, "STORE.A705")).toBe(true)
				expect(await targetState(tx)).toBe(DELIVERY_TARGET_STATE.PAUSED)
				expect(await claim(tx)).toBeUndefined()
			},
		)
	})

	it("CAP-023-R25 takes over a row left in sending even behind a paused target", async () => {
		await asWorker(
			async (tx) => {
				const record = await assembledRecord(tx, 1)
				await tx`UPDATE delivery_instance SET state = ${SENDING} WHERE id = ${first(record.instanceIds)}`
				await tx`UPDATE delivery_target SET state = 'paused', reason = 'STORE.A706' WHERE code = ${PACS}`
				return record
			},
			async (tx, record) => {
				expect((await claim(tx))?.objectId).toBe(first(record.instanceIds))
			},
		)
	})

	it("CAP-023-R26 leaves a verification waiting for the administrator out of the claims", async () => {
		await asWorker(
			async (tx) => {
				const record = await assembledRecord(tx, 1)
				await tx`
					UPDATE delivery_instance SET state = ${PENDING_VERIFICATION}, verification_rejections = 3,
						verification_on_hold_at = now()
					WHERE id = ${first(record.instanceIds)}
				`
				return record
			},
			async (tx) => {
				expect(await claim(tx)).toBeUndefined()
			},
		)
	})

	it("CAP-023-R25 writes the sending state only from the state it was read in", async () => {
		await asWorker(
			async (tx) => await assembledRecord(tx, 1),
			async (tx, record) => {
				const instances = new DeliveryInstanceRepository(databaseOf(tx))
				const instanceId = first(record.instanceIds)

				expect(await instances.markSending(tx, instanceId, WAITING)).toBe(true)
				expect(await instances.markSending(tx, instanceId, WAITING)).toBe(false)
			},
		)
	})

	it("CAP-026-R03 anchors the retention on confirmation and marks the record delivered once every instance is in", async () => {
		await asWorker(
			async (tx) => await assembledRecord(tx, 2),
			async (tx, record) => {
				const instances = new DeliveryInstanceRepository(databaseOf(tx))
				const [firstId, secondId] = record.instanceIds as [string, string]
				const confirmed = transition(SENDING, CONFIRMED, {
					countedAttempts: 1,
					statusHex: "0000",
					acceptedTransferSyntax: JPEG_BASELINE,
				})
				for (const instanceId of [firstId, secondId]) {
					await instances.markSending(tx, instanceId, WAITING)
				}

				await instances.transition(tx, firstId, confirmed)
				await instances.refreshAcquisitionState(tx, record.acquisitionId)
				expect(await acquisitionState(tx, record.acquisitionId)).toBe(ACQUISITION_STATE.ASSEMBLING)

				await instances.transition(tx, secondId, confirmed)
				await instances.refreshAcquisitionState(tx, record.acquisitionId)
				expect(await acquisitionState(tx, record.acquisitionId)).toBe(ACQUISITION_STATE.DELIVERED)
				const rows = await tx<{ attempts: number; retention_anchor: Date | null; accepted_transfer_syntax: string }[]>`
					SELECT attempts, retention_anchor, accepted_transfer_syntax FROM delivery_instance WHERE id = ${firstId}
				`
				expect(rows[0]).toMatchObject({ attempts: 1, accepted_transfer_syntax: JPEG_BASELINE })
				expect(rows[0]?.retention_anchor).toBeInstanceOf(Date)
			},
		)
	})

	it("CAP-026-S03 anchors the retention only when the verification query finds the instance", async () => {
		await asWorker(
			async (tx) => await assembledRecord(tx, 1),
			async (tx, record) => {
				const instances = new DeliveryInstanceRepository(databaseOf(tx))
				const instanceId = first(record.instanceIds)
				await instances.markSending(tx, instanceId, WAITING)
				await instances.transition(tx, instanceId, transition(SENDING, PENDING_VERIFICATION, { countedAttempts: 1 }))
				expect(await retentionAnchorOf(tx, instanceId)).toBeNull()

				await instances.transition(tx, instanceId, transition(PENDING_VERIFICATION, CONFIRMED))

				expect(await retentionAnchorOf(tx, instanceId)).toBeInstanceOf(Date)
			},
		)
	})

	it("CAP-023-R09 holds a row with its cause and fails the record without an anchor", async () => {
		await asWorker(
			async (tx) => await assembledRecord(tx, 1),
			async (tx, record) => {
				const instances = new DeliveryInstanceRepository(databaseOf(tx))
				const instanceId = first(record.instanceIds)
				await instances.markSending(tx, instanceId, WAITING)

				await instances.transition(
					tx,
					instanceId,
					transition(SENDING, HELD_FOR_REVIEW, {
						countedAttempts: 1,
						statusHex: "C002",
						heldForReviewCause: HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS,
					}),
				)
				await instances.refreshAcquisitionState(tx, record.acquisitionId)

				const [row] = await tx<{ state: string; held_for_review_cause: string; retention_anchor: Date | null }[]>`
					SELECT state, held_for_review_cause, retention_anchor FROM delivery_instance WHERE id = ${instanceId}
				`
				expect(row).toEqual({
					state: HELD_FOR_REVIEW,
					held_for_review_cause: HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS,
					retention_anchor: null,
				})
				expect(await acquisitionState(tx, record.acquisitionId)).toBe(ACQUISITION_STATE.FAILED)
			},
		)
	})

	it.each([
		["CAP-029-R16 the retired state name", "state = 'clinical_safety'", "delivery_instance_state_check"],
		["CAP-023-R09 a hold without its cause", `state = '${HELD_FOR_REVIEW}'`, "delivery_instance_held_cause_check"],
		[
			"CAP-023-R09 a cause without a hold",
			"held_for_review_cause = 'dimse_status'",
			"delivery_instance_held_cause_check",
		],
		[
			"CAP-026-R03 a confirmation without an anchor",
			`state = '${CONFIRMED}'`,
			"delivery_instance_retention_anchor_check",
		],
		[
			"CAP-026-R03 an anchor without a confirmation",
			"retention_anchor = now()",
			"delivery_instance_retention_anchor_check",
		],
		[
			"CAP-023-R26 a hold outside verification",
			"verification_on_hold_at = now()",
			"delivery_instance_verification_hold_check",
		],
		[
			"integrace-dicom.md 8 a status that is no DIMSE status",
			"last_dimse_status = 'OK'",
			"delivery_instance_dimse_status_check",
		],
	])("the schema refuses %s", async (_case, change, constraint) => {
		await asWorker(
			async (tx) => await assembledRecord(tx, 1),
			async (tx, record) => {
				await expect(
					tx.unsafe(`UPDATE delivery_instance SET ${change} WHERE id = $1`, [first(record.instanceIds)]),
				).rejects.toThrow(new RegExp(constraint))
			},
		)
	})

	it.each([
		["CAP-023-R23 a reason of an active target", "reason = 'STORE.A705'", "delivery_target_active_reason_check"],
		[
			"CAP-023-R23 a paused target without a reason",
			`state = '${DELIVERY_TARGET_STATE.PAUSED}'`,
			"delivery_target_active_reason_check",
		],
		[
			"CAP-023-R27 an outage alert of an active target",
			"unavailability_alerted_at = now()",
			"delivery_target_unavailability_alert_check",
		],
	])("the schema refuses %s", async (_case, change, constraint) => {
		await asWorker(
			async () => undefined,
			async (tx) => {
				await expect(tx.unsafe(`UPDATE delivery_target SET ${change} WHERE code = $1`, [PACS])).rejects.toThrow(
					new RegExp(constraint),
				)
			},
		)
	})

	it("CAP-023-R17 the schema refuses an instance alert without its instance and a target alert without its target", async () => {
		await asWorker(
			async () => undefined,
			async (tx) => {
				await tx`SAVEPOINT alert`
				await expect(
					tx`INSERT INTO administrator_alert (id, kind, message) VALUES (${randomUUID()}, ${ADMINISTRATOR_ALERT_KIND.HELD_FOR_REVIEW}, 'x')`,
				).rejects.toThrow(/administrator_alert_delivery_instance_check/)
				await tx`ROLLBACK TO SAVEPOINT alert`
				await expect(
					tx`INSERT INTO administrator_alert (id, kind, message) VALUES (${randomUUID()}, ${ADMINISTRATOR_ALERT_KIND.TARGET_PAUSED}, 'x')`,
				).rejects.toThrow(/administrator_alert_target_check/)
			},
		)
	})

	it.each([
		["a failed assembly fails it", WAITING, DELIVERY_STATE.ASSEMBLY_FAILED, ACQUISITION_STATE.FAILED],
		[
			"a closure by the administrator closes it",
			CLOSED_BY_ADMINISTRATOR,
			DELIVERY_STATE.ASSEMBLED,
			ACQUISITION_STATE.CLOSED_BY_ADMINISTRATOR,
		],
	])(
		"datovy-model.md 4 „Pořízení“ composes the record state: %s",
		async (_case, secondState, deliveryState, expected) => {
			await asWorker(
				async (tx) => {
					const record = await assembledRecord(tx, 2)
					const [firstId, secondId] = record.instanceIds as [string, string]
					await tx`UPDATE delivery_instance SET state = ${CONFIRMED}, retention_anchor = now() WHERE id = ${firstId}`
					await movedTo(tx, record, secondId, secondState)
					const reason = deliveryState === DELIVERY_STATE.ASSEMBLY_FAILED ? ASSEMBLY_FAILURE.MISSING_BUFFER : null
					await tx`UPDATE delivery SET state = ${deliveryState}, reason = ${reason} WHERE id = ${record.deliveryId}`
					await tx`UPDATE delivery_target SET state = ${DELIVERY_TARGET_STATE.PAUSED}, reason = 'STORE.A705' WHERE code = ${PACS}`
					return record
				},
				async (tx, record) => {
					const instances = new DeliveryInstanceRepository(databaseOf(tx))

					await instances.lockRecord(tx, record.acquisitionId)
					await instances.refreshAcquisitionState(tx, record.acquisitionId)

					expect(await acquisitionState(tx, record.acquisitionId)).toBe(expected)
				},
			)
		},
	)

	it("CAP-023-R26 records rejections and the hold only on a pending verification", async () => {
		await asWorker(
			async (tx) => {
				const record = await assembledRecord(tx, 1)
				await tx`UPDATE delivery_instance SET state = ${PENDING_VERIFICATION} WHERE id = ${first(record.instanceIds)}`
				return record
			},
			async (tx, record) => {
				const instances = new DeliveryInstanceRepository(databaseOf(tx))
				const instanceId = first(record.instanceIds)

				await instances.transition(
					tx,
					instanceId,
					transition(PENDING_VERIFICATION, PENDING_VERIFICATION, { verificationRejections: 3, isOnHold: true }),
				)

				const [row] = await tx<{ verification_rejections: number; verification_on_hold_at: Date | null }[]>`
					SELECT verification_rejections, verification_on_hold_at FROM delivery_instance WHERE id = ${instanceId}
				`
				expect(row?.verification_rejections).toBe(3)
				expect(row?.verification_on_hold_at).toBeInstanceOf(Date)
			},
		)
	})

	it("CAP-023-R24, CAP-023-R27 releases an unavailable target and alerts once a long outage, not a short one", async () => {
		await asWorker(
			async (tx) => {
				await tx`
					UPDATE delivery_target SET state = 'unavailable', reason = 'STORE.NOT_SENT', changed_at = now() - interval '10 minutes'
					WHERE code = ${PACS}
				`
			},
			async (tx) => {
				const targets = new DeliveryTargetRepository(databaseOf(tx))

				expect(await targets.markUnavailabilityAlerted(tx, PACS, ALERT_SECONDS)).toBeUndefined()
				expect(await targets.markUnavailabilityAlerted(tx, PACS, SHORT_ALERT_SECONDS)).toMatchObject({ code: PACS })
				expect(await targets.markUnavailabilityAlerted(tx, PACS, SHORT_ALERT_SECONDS)).toBeUndefined()
				expect(await targets.unavailable()).toEqual([expect.objectContaining({ code: PACS })])
				expect(await targets.release(tx, PACS)).toBe(true)
				const [row] = await tx<{ state: string; reason: string | null; unavailability_alerted_at: Date | null }[]>`
					SELECT state, reason, unavailability_alerted_at FROM delivery_target WHERE code = ${PACS}
				`
				expect(row).toEqual({ state: DELIVERY_TARGET_STATE.ACTIVE, reason: null, unavailability_alerted_at: null })
			},
		)
	})

	it("CAP-023-R23 pauses over unavailability and never releases a paused target", async () => {
		await asWorker(
			async () => undefined,
			async (tx) => {
				const targets = new DeliveryTargetRepository(databaseOf(tx))
				await targets.markUnavailable(tx, PACS, "STORE.NOT_SENT")

				expect(await targets.pause(tx, PACS, "STORE.A705")).toBe(true)
				expect(await targets.pause(tx, PACS, "STORE.A706")).toBe(false)
				expect(await targets.markUnavailable(tx, PACS, "STORE.NOT_SENT")).toBe(false)
				expect(await targets.release(tx, PACS)).toBe(false)
				expect(await targetState(tx)).toBe(DELIVERY_TARGET_STATE.PAUSED)
			},
		)
	})

	it("ADR-005 ř. 36 keeps the set of targets and the administrator's resumption out of the worker's hands", async () => {
		await asWorker(
			async () => undefined,
			async (tx) => {
				await tx`SAVEPOINT target`
				await expect(tx`INSERT INTO delivery_target (code) VALUES ('second')`).rejects.toThrow(/permission denied/)
				await tx`ROLLBACK TO SAVEPOINT target`
				await expect(tx`UPDATE delivery_target SET resumed_by_user_id = NULL WHERE code = ${PACS}`).rejects.toThrow(
					/permission denied/,
				)
			},
		)
	})

	it("CAP-021-R28 asks for the clinical record writes once, when the delivery of the record settled", async () => {
		await asWorker(
			async (tx) => {
				const record = await assembledRecord(tx, 2)
				await tx`
					UPDATE binary_object SET clinical_record_uploaded_at = now()
					WHERE id = (SELECT binary_object_id FROM image WHERE acquisition_id = ${record.acquisitionId} AND sequence = 1)
				`
				return record
			},
			async (tx, record) => {
				const instances = new DeliveryInstanceRepository(databaseOf(tx))
				const [firstId, secondId] = record.instanceIds as [string, string]
				const confirmed = transition(SENDING, CONFIRMED, {
					countedAttempts: 1,
					statusHex: "0000",
				})
				const writesOf = async () =>
					await tx<{ object_kind: string }[]>`
						SELECT object_kind FROM queue_task WHERE kind = ${JOB_KIND.CLINICAL_RECORD_WRITE} ORDER BY object_kind
					`
				await instances.markSending(tx, firstId, WAITING)
				await instances.transition(tx, firstId, confirmed)

				expect(await instances.requestClinicalRecordWrites(tx, record.acquisitionId)).toBe(false)
				expect(await writesOf()).toEqual([])

				await instances.markSending(tx, secondId, WAITING)
				await instances.transition(
					tx,
					secondId,
					transition(SENDING, HELD_FOR_REVIEW, { heldForReviewCause: HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS }),
				)

				expect(await instances.requestClinicalRecordWrites(tx, record.acquisitionId)).toBe(true)
				expect(await writesOf()).toEqual([
					{ object_kind: JOB_OBJECT_KIND.ACQUISITION },
					{ object_kind: JOB_OBJECT_KIND.IMAGE },
				])
			},
		)
	})

	it("CAP-021-R28 asks for nothing when no instance of the settled record was confirmed", async () => {
		await asWorker(
			async (tx) => {
				const record = await assembledRecord(tx, 1)
				await tx`
					UPDATE delivery_instance SET state = ${HELD_FOR_REVIEW}, held_for_review_cause = 'dimse_status'
					WHERE id = ${first(record.instanceIds)}
				`
				return record
			},
			async (tx, record) => {
				const instances = new DeliveryInstanceRepository(databaseOf(tx))

				expect(await instances.requestClinicalRecordWrites(tx, record.acquisitionId)).toBe(false)
			},
		)
	})

	it("CAP-023-R17 raises one active alert per instance and per target", async () => {
		await asWorker(
			async (tx) => await assembledRecord(tx, 1),
			async (tx, record) => {
				const alerts = new DeliveryAlertRepository()
				const instance = { deliveryId: record.deliveryId, instanceId: first(record.instanceIds) }
				const held = ADMINISTRATOR_ALERT_KIND.HELD_FOR_REVIEW
				const paused = ADMINISTRATOR_ALERT_KIND.TARGET_PAUSED

				expect(await alerts.raiseForInstance(tx, held, instance, "Zadrženo.")).toBeDefined()
				expect(await alerts.raiseForInstance(tx, held, instance, "Zadrženo.")).toBeUndefined()
				expect(await alerts.raiseForTarget(tx, paused, PACS, "Pozastaveno.")).toBeDefined()
				expect(await alerts.raiseForTarget(tx, paused, PACS, "Pozastaveno.")).toBeUndefined()
				await alerts.resolveForTarget(tx, paused, PACS)
				expect(await alerts.raiseForTarget(tx, paused, PACS, "Znovu pozastaveno.")).toBeDefined()
			},
		)
	})
})

// PostgreSQL 13.2.1
describe("delivery SQL of two workers at once", () => {
	it("CAP-021-R28 composes the record state and asks for its writes once when its last two instances settle together", async () => {
		const record = await committedRecord()
		const workers = workerSessions(2)
		let releaseFirst = (): void => undefined
		const released = new Promise<void>((resolve) => {
			releaseFirst = resolve
		})
		let markFirstHolding = (_pid: number): void => undefined
		const firstHolding = new Promise<number>((resolve) => {
			markFirstHolding = resolve
		})
		try {
			const confirmed = transition(SENDING, CONFIRMED, { countedAttempts: 1, statusHex: "0000" })
			const settle = async (instanceId: string, beforeCommit: (pid: number) => Promise<void>): Promise<boolean> =>
				await workers.begin(async (tx) => {
					await becomeWorker(tx)
					const instances = new DeliveryInstanceRepository(databaseOf(tx))
					await instances.transition(tx, instanceId, confirmed)
					await instances.lockRecord(tx, record.acquisitionId)
					await instances.refreshAcquisitionState(tx, record.acquisitionId)
					const isRequested = await instances.requestClinicalRecordWrites(tx, record.acquisitionId)
					const [session] = await tx<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
					await beforeCommit(session?.pid ?? 0)
					return isRequested
				})
			const [firstId, secondId] = record.instanceIds
			const firstSettlement = settle(firstId, async (pid) => {
				markFirstHolding(pid)
				await released
			})
			const firstPid = await Promise.race([firstHolding, firstSettlement.then(() => 0)])
			const secondSettlement = settle(secondId, async () => undefined)
			await untilBlockedBy(firstPid)
			releaseFirst()

			expect(await firstSettlement).toBe(false)
			expect(await secondSettlement).toBe(true)
			const [state] = await administrator<{ state: string }[]>`
				SELECT state FROM acquisition WHERE id = ${record.acquisitionId}
			`
			expect(state?.state).toBe(ACQUISITION_STATE.DELIVERED)
			const writes = await administrator<{ object_kind: string }[]>`
				SELECT object_kind FROM queue_task WHERE kind = ${JOB_KIND.CLINICAL_RECORD_WRITE} AND object_id = ${record.acquisitionId}
			`
			expect(writes).toEqual([{ object_kind: JOB_OBJECT_KIND.ACQUISITION }])
		} finally {
			releaseFirst()
			await workers.end()
			await removeCommitted(record)
		}
	})
})
