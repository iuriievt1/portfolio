import { Readable } from "node:stream"
import { DELIVERY_INSTANCE_STATE } from "@ansora/contracts"
import type { BinaryStorePort, HeldQueueLease } from "@ansora/core-server"
import type { DeliverableArtifact } from "@ansora/vulna-domain"
import { describe, expect, it, vi } from "vitest"
import type { DeliveryInstanceRepository } from "../repositories/delivery-instance.repository"
import type { DeliveryRecorderService } from "../services/delivery-recorder.service"
import { InstanceDeliveryService } from "../services/instance-delivery.service"
import type {
	ClaimedDeliveryTask,
	DeliveryArchive,
	DeliveryInstance,
	DeliveryStep,
	StoredVariantRow,
} from "../types/delivery.types"
import {
	instanceOf,
	JPEG_BASELINE,
	PATIENT_ID,
	PENDING_INSTANCE,
	queried,
	SOP_INSTANCE_UID,
	settingsWith,
	stored,
} from "./delivery-fixtures"

vi.mock("@ansora/vulna-projection-dicom", () => ({ patientIdOf: () => PATIENT_ID }))

const EXPLICIT = "1.2.840.10008.1.2.1"
const IMPLICIT = "1.2.840.10008.1.2"
const TASK: ClaimedDeliveryTask = {
	id: "55555555-5555-4555-8555-555555555555",
	objectKind: "delivery_instance",
	objectId: "11111111-1111-4111-8111-111111111111",
	attempts: 0,
	unknownOutcomes: 0,
	requestedAt: "1791363600123456",
}

interface Harness {
	instance: DeliveryInstance
	variants?: StoredVariantRow[]
	missingObjects?: readonly string[]
	isSendingMarked?: boolean
	isTargetActive?: boolean
	archive?: Partial<DeliveryArchive>
	controller?: AbortController
}

function variantRow(transferSyntax: string): StoredVariantRow {
	return {
		transfer_syntax: transferSyntax,
		dataset_sha256: "a".repeat(64),
		binary_object_id: `object-${transferSyntax}`,
	}
}

function harness(options: Harness) {
	const steps: string[] = []
	const recorded: DeliveryStep[] = []
	const sent: DeliverableArtifact[] = []
	const controller = options.controller ?? new AbortController()
	const lease: HeldQueueLease = { lockedBy: "worker-run", signal: controller.signal }
	const instances = {
		find: async () => options.instance,
		variantsOf: async () => options.variants ?? [variantRow(JPEG_BASELINE)],
	} as unknown as DeliveryInstanceRepository
	const recorder = {
		markSending: async () => {
			steps.push("sending")
			return options.isSendingMarked ?? true
		},
		mayVerify: async () => {
			steps.push("may verify")
			return options.isTargetActive ?? true
		},
		record: async (_task: ClaimedDeliveryTask, _instance: DeliveryInstance, step: DeliveryStep) => {
			steps.push("record")
			recorded.push(step)
		},
		complete: async () => void steps.push("complete"),
	} as unknown as DeliveryRecorderService
	const binaryStore = {
		exists: async (key: string) => !(options.missingObjects ?? []).includes(key),
		get: async (key: string) => Readable.from([Buffer.from(`bytes of ${key}`)]),
	} as unknown as BinaryStorePort
	const unused = async (): Promise<never> => {
		throw new Error("not expected")
	}
	const archive: DeliveryArchive = {
		checkAvailability: unused,
		storeImage: async (artifact) => {
			steps.push("store")
			sent.push(artifact)
			return stored("0000")
		},
		storeDocument: unused,
		findInstance: async () => {
			steps.push("find instance")
			return queried({ matchedValues: [] })
		},
		findStudyPatients: async (studyInstanceUid) => {
			steps.push(`find study ${studyInstanceUid}`)
			return queried({ matchedValues: [PATIENT_ID] })
		},
		...options.archive,
	}
	const service = new InstanceDeliveryService(instances, recorder, binaryStore)
	return {
		deliver: async () => await service.deliver(TASK, settingsWith(archive), lease),
		steps,
		recorded,
		sent,
	}
}

describe("delivering one instance ✓ dorucovaci-jadro.md 5, 5.4", () => {
	it("CAP-023-R25 commits the sending state before the association opens", async () => {
		const run = harness({ instance: instanceOf(DELIVERY_INSTANCE_STATE.WAITING) })

		await run.deliver()

		expect(run.steps).toEqual(["sending", "store", "record"])
		expect(run.recorded[0]?.transition.to).toBe(DELIVERY_INSTANCE_STATE.CONFIRMED)
	})

	it("CAP-023-R25 opens no association when the sending state could not be written", async () => {
		const run = harness({ instance: instanceOf(DELIVERY_INSTANCE_STATE.WAITING), isSendingMarked: false })

		await run.deliver()

		expect(run.steps).toEqual(["sending"])
	})

	it("CAP-023-R25 writes no result once the lease ran out during C-STORE", async () => {
		const controller = new AbortController()
		const run = harness({
			instance: instanceOf(DELIVERY_INSTANCE_STATE.TEMPORARILY_FAILED),
			controller,
			archive: {
				storeImage: async () => {
					controller.abort()
					return stored("0000")
				},
			},
		})

		await run.deliver()

		expect(run.steps).toEqual(["sending"])
		expect(run.recorded).toEqual([])
	})

	it("CAP-023-S14 takes over a row left in sending without a byte to the PACS", async () => {
		const run = harness({ instance: instanceOf(DELIVERY_INSTANCE_STATE.SENDING) })

		await run.deliver()

		expect(run.steps).toEqual(["record"])
		expect(run.recorded[0]?.transition.to).toBe(DELIVERY_INSTANCE_STATE.PENDING_VERIFICATION)
	})

	it("CAP-023-R15 offers the variants in the configured order of preference", async () => {
		const run = harness({
			instance: instanceOf(DELIVERY_INSTANCE_STATE.WAITING),
			variants: [variantRow(IMPLICIT), variantRow(EXPLICIT), variantRow(JPEG_BASELINE)],
		})

		await run.deliver()

		expect(run.sent[0]?.variants.map((variant) => variant.transferSyntaxUid)).toEqual([
			JPEG_BASELINE,
			IMPLICIT,
			EXPLICIT,
		])
	})

	it("CAP-023-S19 hands a variant whose buffered bytes are gone to the adapter's integrity check as empty", async () => {
		const run = harness({
			instance: instanceOf(DELIVERY_INSTANCE_STATE.WAITING),
			missingObjects: [`object-${JPEG_BASELINE}`],
		})

		await run.deliver()

		expect(run.sent[0]?.variants[0]?.part10).toHaveLength(0)
	})

	it("CAP-023-R13 asks for the study's patient with the Patient ID from the stored bytes only after the instance was not found", async () => {
		const run = harness({ instance: PENDING_INSTANCE })

		await run.deliver()

		expect(run.steps).toEqual([
			"may verify",
			"find instance",
			`find study ${PENDING_INSTANCE.studyInstanceUid}`,
			"record",
		])
		expect(run.recorded[0]?.transition.to).toBe(DELIVERY_INSTANCE_STATE.WAITING)
	})

	it("CAP-023-S14 confirms a found instance with a single query", async () => {
		const run = harness({
			instance: PENDING_INSTANCE,
			archive: { findInstance: async () => queried({ matchedValues: [SOP_INSTANCE_UID] }) },
		})

		await run.deliver()

		expect(run.recorded[0]?.transition.to).toBe(DELIVERY_INSTANCE_STATE.CONFIRMED)
	})

	it("datovy-model.md 4 „Cíl doručení“ queries nothing behind a target that is no longer active", async () => {
		const run = harness({ instance: PENDING_INSTANCE, isTargetActive: false })

		await run.deliver()

		expect(run.steps).toEqual(["may verify"])
	})

	it("CAP-023-R25 writes no result once the lease ran out during C-FIND", async () => {
		const controller = new AbortController()
		const run = harness({
			instance: PENDING_INSTANCE,
			controller,
			archive: {
				findInstance: async () => {
					controller.abort()
					return queried({ matchedValues: [] })
				},
			},
		})

		await run.deliver()

		expect(run.steps).toEqual(["may verify"])
		expect(run.recorded).toEqual([])
	})

	it("CAP-023-S19 holds an instance not found when its stored bytes cannot be read back for the study query", async () => {
		const run = harness({ instance: PENDING_INSTANCE, missingObjects: [`object-${JPEG_BASELINE}`] })

		await run.deliver()

		expect(run.steps).toEqual(["may verify", "find instance", "record"])
		expect(run.recorded[0]?.transition).toMatchObject({
			to: DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW,
			heldForReviewCause: "artifact_sha256_mismatch",
		})
	})

	it("completes the task of a row that is already settled", async () => {
		const run = harness({ instance: instanceOf(DELIVERY_INSTANCE_STATE.CONFIRMED) })

		await run.deliver()

		expect(run.steps).toEqual(["complete"])
	})
})
