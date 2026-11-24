import { buffer } from "node:stream/consumers"
import { DELIVERY_INSTANCE_STATE } from "@ansora/contracts"
import type { BinaryStorePort, HeldQueueLease } from "@ansora/core-server"
import {
	type ArchiveStoreOutcome,
	type DeliverableArtifact,
	type DeliverableVariant,
	instanceQueryResultOf,
	QUERY_RESULT,
	storeJudgementOf,
	studyQueryResultOf,
} from "@ansora/vulna-domain"
import { patientIdOf } from "@ansora/vulna-projection-dicom"
import { Inject, Injectable, Logger } from "@nestjs/common"
import { BINARY_STORE } from "../../../libs/binary-store/binary-store.constants"
import { ARTIFACT_SOURCE_KIND } from "../../../libs/common/constants/artifact.constants"
import { DeliveryInstanceRepository } from "../repositories/delivery-instance.repository"
import type {
	ClaimedDeliveryTask,
	DeliveryInstance,
	DeliverySettings,
	StoredVariantRow,
	StudyVerification,
} from "../types/delivery.types"
import { storeStepOf, takeOverStepOf, verificationStepOf } from "../utils/delivery-steps"
import { orderedByPreference } from "../utils/variant-order"
import { DeliveryRecorderService } from "./delivery-recorder.service"

const {
	WAITING,
	SENDING,
	PENDING_VERIFICATION,
	CONFIRMED,
	TEMPORARILY_FAILED,
	PERMANENTLY_FAILED,
	HELD_FOR_REVIEW,
	CLOSED_BY_ADMINISTRATOR,
} = DELIVERY_INSTANCE_STATE

// integrace-dicom.md 6.1, 8.1, CAP-023-S19
const NO_BYTES = new Uint8Array()

// dorucovaci-jadro.md 5, 5.1, 5.4, CAP-023-R14, CAP-023-R15, CAP-023-R25, CAP-023-R26
@Injectable()
export class InstanceDeliveryService {
	private readonly logger = new Logger(InstanceDeliveryService.name)

	constructor(
		private readonly instances: DeliveryInstanceRepository,
		private readonly recorder: DeliveryRecorderService,
		@Inject(BINARY_STORE) private readonly binaryStore: BinaryStorePort,
	) {}

	async deliver(task: ClaimedDeliveryTask, settings: DeliverySettings, lease: HeldQueueLease): Promise<void> {
		const instance = await this.instances.find(task.objectId)
		if (instance === undefined) {
			throw new Error(`delivery instance ${task.objectId} of task ${task.id} does not exist`)
		}
		const state = instance.state
		switch (state) {
			case SENDING:
				await this.recorder.record(task, instance, takeOverStepOf(instance, settings), lease)
				return
			case WAITING:
			case TEMPORARILY_FAILED:
				await this.send(task, instance, settings, lease)
				return
			case PENDING_VERIFICATION:
				await this.verify(task, instance, settings, lease)
				return
			case CONFIRMED:
			case PERMANENTLY_FAILED:
			case HELD_FOR_REVIEW:
			case CLOSED_BY_ADMINISTRATOR:
				this.logger.warn(`Delivery instance ${instance.id} is ${state}; task ${task.id} has nothing to do`)
				await this.recorder.complete(task, lease)
				return
			default:
				return state satisfies never
		}
	}

	// CAP-023-R14, CAP-023-R15, CAP-023-R25
	private async send(
		task: ClaimedDeliveryTask,
		instance: DeliveryInstance,
		settings: DeliverySettings,
		lease: HeldQueueLease,
	): Promise<void> {
		const artifact = await this.deliverableOf(instance, settings)
		if (!(await this.recorder.markSending(task, instance, lease))) {
			return
		}
		const outcome = await this.store(instance, artifact, settings, lease.signal)
		if (lease.signal.aborted) {
			this.logger.warn(
				`The lease of task ${task.id} ran out during C-STORE; a later run verifies instance ${instance.id}`,
			)
			return
		}
		const judgement = storeJudgementOf(outcome, instance.attempts, settings.maxAttempts)
		await this.recorder.record(task, instance, storeStepOf(instance, outcome, judgement, settings), lease)
	}

	private async store(
		instance: DeliveryInstance,
		artifact: DeliverableArtifact,
		settings: DeliverySettings,
		signal: AbortSignal,
	): Promise<ArchiveStoreOutcome> {
		if (instance.sourceKind === ARTIFACT_SOURCE_KIND.IMAGE) {
			return await settings.archive.storeImage(artifact, signal)
		}
		return await settings.archive.storeDocument(artifact, signal)
	}

	// CAP-023-R13, CAP-023-R26, dorucovaci-jadro.md 5.1
	private async verify(
		task: ClaimedDeliveryTask,
		instance: DeliveryInstance,
		settings: DeliverySettings,
		lease: HeldQueueLease,
	): Promise<void> {
		if (!(await this.recorder.mayVerify(task, instance, lease))) {
			return
		}
		const imageOutcome = await settings.archive.findInstance(
			{
				studyInstanceUid: instance.studyInstanceUid,
				seriesInstanceUid: instance.seriesInstanceUid,
				sopInstanceUid: instance.sopInstanceUid,
			},
			lease.signal,
		)
		if (lease.signal.aborted) {
			return
		}
		const image = { outcome: imageOutcome, result: instanceQueryResultOf(imageOutcome, instance.sopInstanceUid) }
		const study =
			image.result === QUERY_RESULT.NOT_FOUND
				? await this.studyVerificationOf(instance, settings, lease.signal)
				: undefined
		if (lease.signal.aborted) {
			return
		}
		await this.recorder.record(task, instance, verificationStepOf(instance, { image, study }, settings), lease)
	}

	// CAP-023-R09, CAP-023-R13, CAP-023-S19, CAP-023-S20
	private async studyVerificationOf(
		instance: DeliveryInstance,
		settings: DeliverySettings,
		signal: AbortSignal,
	): Promise<StudyVerification | undefined> {
		const patientId = await this.storedPatientIdOf(instance)
		if (patientId === undefined) {
			return undefined
		}
		const outcome = await settings.archive.findStudyPatients(instance.studyInstanceUid, signal)
		return { outcome, result: studyQueryResultOf(outcome, patientId) }
	}

	// CAP-023-R09, CAP-023-S20, integrace-dicom.md 5.1
	private async storedPatientIdOf(instance: DeliveryInstance): Promise<string | undefined> {
		const [first] = await this.instances.variantsOf(instance.artifactId)
		if (first === undefined) {
			return undefined
		}
		const part10 = await this.bytesOf(first)
		if (part10 === undefined) {
			return undefined
		}
		try {
			return patientIdOf(part10)
		} catch (error) {
			this.logger.error(`The stored artifact ${instance.artifactId} cannot be read back`, error)
			return undefined
		}
	}

	// ADR-005 ř. 22, 23, CAP-023-R15, integrace-dicom.md 3, 6.1
	private async deliverableOf(instance: DeliveryInstance, settings: DeliverySettings): Promise<DeliverableArtifact> {
		const rows = await this.instances.variantsOf(instance.artifactId)
		const preference =
			instance.sourceKind === ARTIFACT_SOURCE_KIND.IMAGE
				? settings.transferSyntaxPreference.image
				: settings.transferSyntaxPreference.document
		const variants: DeliverableVariant[] = []
		for (const row of orderedByPreference(rows, preference)) {
			variants.push({
				transferSyntaxUid: row.transfer_syntax,
				part10: (await this.bytesOf(row)) ?? NO_BYTES,
				datasetSha256: row.dataset_sha256,
			})
		}
		return {
			sopClassUid: instance.sopClassUid,
			sopInstanceUid: instance.sopInstanceUid,
			studyInstanceUid: instance.studyInstanceUid,
			seriesInstanceUid: instance.seriesInstanceUid,
			variants,
		}
	}

	// CAP-021-R35, CAP-023-R09, CAP-023-S19
	private async bytesOf(row: StoredVariantRow): Promise<Uint8Array | undefined> {
		if (!(await this.binaryStore.exists(row.binary_object_id))) {
			this.logger.error(`The buffer holds no bytes of artifact variant ${row.binary_object_id}`)
			return undefined
		}
		return await buffer(await this.binaryStore.get(row.binary_object_id))
	}
}
