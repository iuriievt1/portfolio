import { randomUUID } from "node:crypto"
import { ADMINISTRATOR_ALERT_KIND, CODE_LIST, DELIVERY_STATE } from "@ansora/contracts"
import { JOB_KIND, JOB_OBJECT_KIND } from "@ansora/core-server"
import { ACQUISITION_STATE, SOP_CLASS } from "@ansora/vulna-domain"
import { TRANSFER_SYNTAX } from "@ansora/vulna-projection-dicom"
import { afterAll, describe, expect, it } from "vitest"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import { binaryObjectOf } from "../../../libs/binary-store/binary-object"
import { ARTIFACT_SOURCE_KIND } from "../../../libs/common/constants/artifact.constants"
import {
	administrator,
	asWorker,
	databaseOf,
	queuedTask,
	storedObject,
} from "../../clinical-record-upload/__tests__/sql-fixtures"
import { ASSEMBLY_FAILURE } from "../constants/assembly.constants"
import { AssemblyAlertRepository } from "../repositories/assembly-alert.repository"
import { AssemblyRecordRepository } from "../repositories/assembly-record.repository"
import { AssemblyResultRepository } from "../repositories/assembly-result.repository"
import { CodeListNameRepository } from "../repositories/code-list-name.repository"
import type { StoredArtifact } from "../types/assembly.types"
import { assemblyAlertEventOf } from "../utils/assembly-alert"
import {
	announcedImageOf,
	closedPhoto,
	closedScan,
	draftOfFinding,
	PATIENT_ID_SYSTEM,
	PATIENT_ID_VALUE,
	PATIENT_RESOURCE_ID,
} from "./assembly-sql-fixtures"

const DATASET_SHA256 = "a".repeat(64)
const MESSAGE = "Sestavení záznamu selhalo."
const OTHER_MESSAGE = "Sestavení záznamů pro PACS stojí."
const LANGUAGE = "cs"
const FIRST_DESCRIPTION = "Rána 1 · první"
const SECOND_DESCRIPTION = "Rána 1 · druhý"

afterAll(async () => {
	await administrator.end()
})

function storedOf(artifactId: string, seriesDescription: string): StoredArtifact {
	return {
		artifactId,
		variants: [
			{
				transferSyntax: TRANSFER_SYNTAX.JPEG_BASELINE,
				datasetSha256: DATASET_SHA256,
				object: binaryObjectOf(Buffer.from(`variant of ${artifactId}`)),
			},
		],
		texts: {
			language: LANGUAGE,
			seriesDescription,
			instanceTitle: "ORIGINAL\\PRIMARY",
			instanceDescription: undefined,
		},
		instanceCreatedAt: new Date("2026-11-09T10:15:30.250Z"),
	}
}

function imageSourcesOf(imageIds: readonly string[]) {
	return imageIds.map((sourceId) => ({
		sourceKind: ARTIFACT_SOURCE_KIND.IMAGE,
		sourceId,
		sopClassUid: SOP_CLASS.VL_PHOTOGRAPHIC_IMAGE,
	}))
}

// datovy-model.md 4, ADR-054 bod 4, ADR-021
describe("assembly SQL under the worker role", () => {
	it("integrace-dicom.md 5 reads a closed wound record with its series, numbers, operator, station and patient", async () => {
		await asWorker(
			async (tx) => {
				const photo = await closedPhoto(tx)
				await announcedImageOf(tx, photo.acquisitionId, photo.imageIds.length + 1)
				return photo
			},
			async (tx, photo) => {
				const records = new AssemblyRecordRepository(databaseOf(tx))

				const record = await records.find(photo.acquisitionId)

				expect(record).toMatchObject({
					acquisitionId: photo.acquisitionId,
					kind: "photo",
					fileCount: 2,
					firstInstanceNumber: 1,
					findingId: photo.findingId,
					woundNumber: 1,
					documentId: undefined,
					operator: { familyName: "Svobodová", givenName: "Petra" },
					closingHardwareId: photo.hardwareId,
					encounter: {
						studyId: expect.stringMatching(/^2026-\d{6,11}$/),
						accessionNumber: undefined,
						date: "2026-11-06",
					},
					series: { seriesInstanceUid: photo.seriesInstanceUid, number: 1 },
					patientResourceId: PATIENT_RESOURCE_ID,
					delivery: { id: photo.deliveryId, state: DELIVERY_STATE.WAITING_FOR_ASSEMBLY },
				})
				expect(record?.patient.identifiers).toEqual([
					{
						system: PATIENT_ID_SYSTEM,
						value: expect.stringContaining(PATIENT_ID_VALUE),
						issuer: undefined,
						validUntil: undefined,
					},
				])
				expect(await records.imagesOf(photo.acquisitionId)).toEqual([
					{ imageId: photo.imageIds[0], sequence: 1, binaryObjectId: photo.imageObjectIds[0], editKind: "crop" },
					{ imageId: photo.imageIds[1], sequence: 2, binaryObjectId: photo.imageObjectIds[1], editKind: undefined },
				])
			},
		)
	})

	it("CAP-021-S11 numbers a later record of the same series after the earlier one, at its closure", async () => {
		await asWorker(
			async (tx) => {
				const first = await closedPhoto(tx, 2)
				await draftOfFinding(tx, first)
				const second = await closedPhoto(tx, 3, first)
				return { first, second }
			},
			async (tx, { first, second }) => {
				const records = new AssemblyRecordRepository(databaseOf(tx))

				expect((await records.find(first.acquisitionId))?.firstInstanceNumber).toBe(1)
				expect((await records.find(second.acquisitionId))?.firstInstanceNumber).toBe(3)
			},
		)
	})

	it("CAP-021-S11 starts the series of the same wound in another visit at 1", async () => {
		await asWorker(
			async (tx) => {
				const first = await closedPhoto(tx, 2)
				return await closedPhoto(tx, 2, first, true)
			},
			async (tx, later) => {
				const records = new AssemblyRecordRepository(databaseOf(tx))

				expect((await records.find(later.acquisitionId))?.firstInstanceNumber).toBe(1)
			},
		)
	})

	it("integrace-dicom.md 5.4 keeps the first instance number it assigned at closure (negative)", async () => {
		await asWorker(
			async (tx) => await closedPhoto(tx),
			async (tx, photo) => {
				await expect(
					tx`UPDATE acquisition SET first_instance_number = 7 WHERE id = ${photo.acquisitionId}`,
				).rejects.toThrow()
			},
		)
	})

	it("CAP-021-R39 reads a closed scan with its document, and never a draft", async () => {
		await asWorker(
			async (tx) => {
				const scan = await closedScan(tx, 3)
				const photo = await closedPhoto(tx)
				return { scan, draftId: await draftOfFinding(tx, photo) }
			},
			async (tx, { scan, draftId }) => {
				const records = new AssemblyRecordRepository(databaseOf(tx))

				expect(await records.find(scan.acquisitionId)).toMatchObject({
					kind: "scan",
					documentId: scan.documentId,
					firstInstanceNumber: 1,
					fileCount: 3,
				})
				expect(await records.find(draftId)).toBeUndefined()
			},
		)
	})

	it("datovy-model.md 4 moves a received record to assembling and never back from failed", async () => {
		await asWorker(
			async (tx) => await closedPhoto(tx),
			async (tx, photo) => {
				const records = new AssemblyRecordRepository(databaseOf(tx))
				const stateOf = async () =>
					(await tx<{ state: string }[]>`SELECT state FROM acquisition WHERE id = ${photo.acquisitionId}`)[0]?.state

				await records.markAssembling(photo.acquisitionId)
				expect(await stateOf()).toBe(ACQUISITION_STATE.ASSEMBLING)
				await tx`UPDATE acquisition SET state = ${ACQUISITION_STATE.FAILED} WHERE id = ${photo.acquisitionId}`
				await records.markAssembling(photo.acquisitionId)
				expect(await stateOf()).toBe(ACQUISITION_STATE.FAILED)
			},
		)
	})

	it("dorucovaci-jadro.md 3 reserves one SOP Instance UID per image and keeps it for a later attempt", async () => {
		await asWorker(
			async (tx) => await closedPhoto(tx),
			async (tx, photo) => {
				const results = new AssemblyResultRepository(databaseOf(tx))

				const first = await results.reserve(photo.acquisitionId, imageSourcesOf(photo.imageIds))
				const again = await results.reserve(photo.acquisitionId, imageSourcesOf(photo.imageIds))

				expect(again).toEqual(first)
				expect(new Set(first.map((artifact) => artifact.sopInstanceUid)).size).toBe(2)
				expect(first.every((artifact) => /^2\.25\.\d+$/.test(artifact.sopInstanceUid))).toBe(true)
			},
		)
	})

	it("CAP-021-R04 CAP-023-R15 finishes the assembly in one transaction with the texts of every artifact", async () => {
		await asWorker(
			async (tx) => await closedPhoto(tx),
			async (tx, photo) => {
				const results = new AssemblyResultRepository(databaseOf(tx))
				const reserved = await results.reserve(photo.acquisitionId, imageSourcesOf(photo.imageIds))
				const descriptions = [FIRST_DESCRIPTION, SECOND_DESCRIPTION]
				const stored = reserved.map((artifact, index) => storedOf(artifact.artifactId, descriptions[index] ?? ""))

				expect(await results.lockedStateOf(tx, photo.deliveryId)).toBe(DELIVERY_STATE.WAITING_FOR_ASSEMBLY)
				await results.finish(tx, photo.deliveryId, stored)
				expect(await results.lockedStateOf(tx, photo.deliveryId)).toBe(DELIVERY_STATE.ASSEMBLED)

				const objectIds = stored.flatMap((artifact) =>
					artifact.variants.map((variant) => variant.object.binaryObjectId),
				)
				expect([...(await results.recordedObjectIdsOf([...objectIds, randomUUID()]))].sort()).toEqual(objectIds.sort())
				const variants = await tx<{ artifact_id: string; transfer_syntax: string; dataset_sha256: string }[]>`
					SELECT artifact_id, transfer_syntax, dataset_sha256 FROM artifact_variant
					WHERE artifact_id IN ${tx(reserved.map((artifact) => artifact.artifactId))}
				`
				expect(variants).toHaveLength(2)
				const artifacts = await tx<
					{
						id: string
						text_language: string
						series_description_written: string
						instance_description_written: null
						instance_created_at: Date
					}[]
				>`
					SELECT id, text_language, series_description_written, instance_description_written, instance_created_at
					FROM artifact WHERE acquisition_id = ${photo.acquisitionId}
				`
				expect(new Map(artifacts.map((artifact) => [artifact.id, artifact.series_description_written]))).toEqual(
					new Map(reserved.map((artifact, index) => [artifact.artifactId, descriptions[index]])),
				)
				expect(artifacts.every((artifact) => artifact.text_language === LANGUAGE)).toBe(true)
				expect(artifacts.every((artifact) => artifact.instance_description_written === null)).toBe(true)
				// integrace-dicom.md 5.9 pravidlo 1
				expect(artifacts.map((artifact) => artifact.instance_created_at.toISOString())).toEqual([
					"2026-11-09T10:15:30.250Z",
					"2026-11-09T10:15:30.250Z",
				])
				const instances = await tx<{ id: string; state: string }[]>`
					SELECT id, state FROM delivery_instance WHERE delivery_id = ${photo.deliveryId}
				`
				expect(instances.map((instance) => instance.state)).toEqual(["waiting", "waiting"])
				const tasks = await tx<{ object_id: string }[]>`
					SELECT object_id FROM queue_task
					WHERE kind = ${JOB_KIND.DELIVERY} AND object_kind = ${JOB_OBJECT_KIND.DELIVERY_INSTANCE} AND state = 'waiting'
				`
				expect(tasks.map((task) => task.object_id).sort()).toEqual(instances.map((instance) => instance.id).sort())
			},
		)
	})

	it("CAP-021-R03 ADR-021 creates the missing delivery of a closed record once and keeps an existing one", async () => {
		await asWorker(
			async (tx) => {
				const photo = await closedPhoto(tx)
				await tx`DELETE FROM delivery WHERE id = ${photo.deliveryId}`
				return photo
			},
			async (tx, photo) => {
				const results = new AssemblyResultRepository(databaseOf(tx))

				const created = await results.ensuredDelivery(photo.acquisitionId)
				const kept = await results.ensuredDelivery(photo.acquisitionId)

				expect(kept).toEqual(created)
				expect(created.state).toBe(DELIVERY_STATE.WAITING_FOR_ASSEMBLY)
				const deliveries = await tx<{ target: string }[]>`
					SELECT target FROM delivery WHERE acquisition_id = ${photo.acquisitionId}
				`
				expect(deliveries).toEqual([{ target: "pacs" }])
			},
		)
	})

	it("CAP-022-R11 fails the delivery and the record for good and counts the failed recognitions", async () => {
		await asWorker(
			async (tx) => await closedScan(tx),
			async (tx, scan) => {
				const results = new AssemblyResultRepository(databaseOf(tx))

				await results.fail(tx, {
					acquisitionId: scan.acquisitionId,
					deliveryId: scan.deliveryId,
					reason: ASSEMBLY_FAILURE.OCR_FAILED,
				})

				const [delivery] = await tx<{ state: string; reason: string }[]>`
					SELECT state, reason FROM delivery WHERE id = ${scan.deliveryId}
				`
				expect(delivery).toEqual({ state: DELIVERY_STATE.ASSEMBLY_FAILED, reason: ASSEMBLY_FAILURE.OCR_FAILED })
				expect(await results.lockedStateOf(tx, scan.deliveryId)).toBe(DELIVERY_STATE.ASSEMBLY_FAILED)
				const [record] = await tx<{ state: string }[]>`SELECT state FROM acquisition WHERE id = ${scan.acquisitionId}`
				expect(record?.state).toBe(ACQUISITION_STATE.FAILED)
				expect(await results.countTextRecognitionFailure(scan.documentId)).toBe(1)
				expect(await results.countTextRecognitionFailure(scan.documentId)).toBe(2)
			},
		)
	})

	it("dorucovaci-jadro.md 2 tells the bytes the database recorded from those it never saw", async () => {
		await asWorker(
			async (tx) => await storedObject(tx, "recorded"),
			async (tx, recorded) => {
				const results = new AssemblyResultRepository(databaseOf(tx))

				expect(await results.recordedObjectIdsOf([recorded.id, randomUUID()])).toEqual(new Set([recorded.id]))
				expect(await results.recordedObjectIdsOf([])).toEqual(new Set())
			},
		)
	})

	it("CAP-028-R15 raises one alert per task with its delivery and audits it as the assembly", async () => {
		await asWorker(
			async (tx) => {
				const scan = await closedScan(tx)
				const taskId = await queuedTask(tx, {
					kind: JOB_KIND.ASSEMBLY,
					objectKind: JOB_OBJECT_KIND.ACQUISITION,
					objectId: scan.acquisitionId,
					state: "failed",
					runAfterSeconds: 0,
				})
				return { scan, taskId }
			},
			async (tx, { scan, taskId }) => {
				const alerts = new AssemblyAlertRepository()

				const alertId = await alerts.raise(tx, taskId, scan.deliveryId, MESSAGE)
				expect(await alerts.raise(tx, taskId, scan.deliveryId, MESSAGE)).toBeUndefined()
				if (alertId === undefined) {
					throw new Error("no alert was raised")
				}
				const failure = {
					acquisitionId: scan.acquisitionId,
					deliveryId: scan.deliveryId,
					reason: ASSEMBLY_FAILURE.OCR_FAILED,
				}
				await new AuditRepository().appendSystemJob(
					tx,
					assemblyAlertEventOf({ alertId, taskId, message: MESSAGE, failure }),
					new Date(),
				)

				const [alert] = await tx<{ kind: string; delivery_id: string; resolved_at: Date | null }[]>`
					SELECT kind, delivery_id, resolved_at FROM administrator_alert WHERE id = ${alertId}
				`
				expect(alert).toEqual({
					kind: ADMINISTRATOR_ALERT_KIND.ASSEMBLY_FAILED,
					delivery_id: scan.deliveryId,
					resolved_at: null,
				})
			},
		)
	})

	it("CAP-022-S07 alerts again when the restarted recognition of the same task fails again", async () => {
		await asWorker(
			async (tx) => {
				const scan = await closedScan(tx)
				const taskId = await queuedTask(tx, {
					kind: JOB_KIND.ASSEMBLY,
					objectKind: JOB_OBJECT_KIND.ACQUISITION,
					objectId: scan.acquisitionId,
					state: "failed",
					runAfterSeconds: 0,
				})
				await tx`
					INSERT INTO administrator_alert (id, kind, message, queue_task_id, delivery_id, resolved_at)
					VALUES (${randomUUID()}, ${ADMINISTRATOR_ALERT_KIND.ASSEMBLY_FAILED}, ${MESSAGE}, ${taskId}, ${scan.deliveryId}, now())
				`
				return { scan, taskId }
			},
			async (tx, { scan, taskId }) => {
				const alertId = await new AssemblyAlertRepository().raise(tx, taskId, scan.deliveryId, MESSAGE)

				expect(alertId).toBeDefined()
			},
		)
	})

	it("CAP-021-R41 keeps one active pause alert, replaces it when the cause changes and resolves it", async () => {
		await asWorker(
			async (tx) => {
				await tx`
					UPDATE administrator_alert SET resolved_at = now()
					WHERE kind = ${ADMINISTRATOR_ALERT_KIND.ASSEMBLY_PAUSED} AND resolved_at IS NULL
				`
			},
			async (tx) => {
				const alerts = new AssemblyAlertRepository()
				const activePauses = async () =>
					await tx<{ id: string; message: string }[]>`
						SELECT id, message FROM administrator_alert
						WHERE kind = ${ADMINISTRATOR_ALERT_KIND.ASSEMBLY_PAUSED} AND resolved_at IS NULL
					`

				const first = await alerts.raisePause(tx, MESSAGE)
				expect(await alerts.raisePause(tx, MESSAGE)).toBeUndefined()
				expect(await activePauses()).toEqual([{ id: first, message: MESSAGE }])
				const replaced = await alerts.raisePause(tx, OTHER_MESSAGE)
				expect(replaced).not.toBe(first)
				expect(await activePauses()).toEqual([{ id: replaced, message: OTHER_MESSAGE }])
				await alerts.resolvePause(tx)
				expect(await activePauses()).toEqual([])
			},
		)
	})

	it("CAP-021-R26 reads the names of a code in every language and nothing for an unknown code", async () => {
		await asWorker(
			async (tx) => {
				const itemId = randomUUID()
				const code = `sql-test-${itemId.slice(0, 8)}`
				await tx`
					INSERT INTO code_list_item (id, code_list_code, code, sequence)
					VALUES (${itemId}, ${CODE_LIST.HEALING_PHASE}, ${code}, 999)
				`
				await tx`
					INSERT INTO code_list_item_name (code_list_item_id, language, name)
					VALUES (${itemId}, 'cs', 'Testovací'), (${itemId}, 'en', 'Test')
				`
				return code
			},
			async (tx, code) => {
				const names = new CodeListNameRepository(databaseOf(tx))

				expect(await names.namesOf(CODE_LIST.HEALING_PHASE, code)).toEqual({ cs: "Testovací", en: "Test" })
				expect(await names.namesOf(CODE_LIST.HEALING_PHASE, "missing-code")).toBeUndefined()
			},
		)
	})
})
