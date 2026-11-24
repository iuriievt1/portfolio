import { Readable } from "node:stream"
import { buffer } from "node:stream/consumers"
import {
	ACQUISITION_KIND,
	CODE_LIST,
	type CodeListCode,
	DELIVERY_STATE,
	type DeliveryState,
	type LocalizedNames,
} from "@ansora/contracts"
import type { BinaryStorePort } from "@ansora/core-server"
import { dicomDocumentObjectOf, dicomDocumentTitleOf, dicomImageObjectOf, SOP_CLASS } from "@ansora/vulna-domain"
import { documentArtifactOf, imageArtifactOf } from "@ansora/vulna-projection-dicom"
import { Inject, Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import { type BinaryObject, binaryObjectOf } from "../../../libs/binary-store/binary-object"
import { BINARY_STORE } from "../../../libs/binary-store/binary-store.constants"
import { ARTIFACT_SOURCE_KIND } from "../../../libs/common/constants/artifact.constants"
import { DatabaseService } from "../../../libs/database/database.service"
import { TextRecognitionError } from "../../text-recognition/errors/text-recognition.error"
import { DocumentPdfRepository } from "../../text-recognition/repositories/document-pdf.repository"
import { DocumentPdfService } from "../../text-recognition/services/document-pdf.service"
import {
	ASSEMBLY_FAILURE,
	TEXT_RECOGNITION_ATTEMPTS,
	TEXT_RECOGNITION_FAILURE_CLASS,
} from "../constants/assembly.constants"
import { AssemblyFailure } from "../errors/assembly-failure.error"
import { AssemblyAlertRepository } from "../repositories/assembly-alert.repository"
import { AssemblyRecordRepository } from "../repositories/assembly-record.repository"
import { AssemblyResultRepository } from "../repositories/assembly-result.repository"
import { CodeListNameRepository } from "../repositories/code-list-name.repository"
import type {
	AssemblyRecord,
	AssemblySettings,
	BuiltArtifact,
	ClaimedAssemblyTask,
	FailedAssembly,
	StoredArtifact,
} from "../types/assembly.types"
import { assemblyAlertEventOf, assemblyFailureMessageOf } from "../utils/assembly-alert"
import { assemblyFailureOf, textRecognitionFailureClassOf } from "../utils/assembly-failure"
import {
	commonSourceOf,
	consistentSeriesOf,
	requireCompleteFiles,
	requiredNamesOf,
	requireSameDocument,
	requireSameFinding,
	titleSourceOf,
	woundNumberOf,
	writtenTextsOfDocument,
	writtenTextsOfImage,
} from "../utils/assembly-source"

// integrace-dicom.md 5.4
const DOCUMENT_INSTANCE_SEQUENCE = 1

// CAP-021-R04, CAP-021-R06, CAP-021-R07, CAP-022, ADR-054 bod 4, dorucovaci-jadro.md 1, 3
@Injectable()
export class AssemblerService {
	private readonly logger = new Logger(AssemblerService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly records: AssemblyRecordRepository,
		private readonly results: AssemblyResultRepository,
		private readonly names: CodeListNameRepository,
		private readonly alerts: AssemblyAlertRepository,
		private readonly audit: AuditRepository,
		private readonly pdfs: DocumentPdfService,
		private readonly pages: DocumentPdfRepository,
		@Inject(BINARY_STORE) private readonly binaryStore: BinaryStorePort,
	) {}

	async assemble(task: ClaimedAssemblyTask, settings: AssemblySettings): Promise<void> {
		const record = await this.recordOf(task.objectId)
		if (record === undefined) {
			await this.database.sql.begin(
				async (tx: postgres.TransactionSql) => await this.results.queue.complete(tx, task.id),
			)
			this.logger.warn(`Task ${task.id} found no closed record ${task.objectId} to assemble`)
			return
		}
		const { delivery } = record
		if (delivery.state !== DELIVERY_STATE.WAITING_FOR_ASSEMBLY) {
			await this.database.sql.begin(
				async (tx: postgres.TransactionSql) => await this.settleIn(tx, task, delivery.state),
			)
			this.logger.log(`Record ${record.acquisitionId} is already ${delivery.state} (task ${task.id})`)
			return
		}
		await this.records.markAssembling(record.acquisitionId)
		const written: BinaryObject[] = []
		let stored: StoredArtifact[]
		try {
			stored = await this.stored(record, settings, written)
		} catch (error) {
			await this.discarded(written)
			const failure = assemblyFailureOf(error)
			if (failure === undefined) {
				throw error
			}
			await this.failed(task, record, failure)
			return
		}
		await this.finished(task, record, stored)
	}

	// CAP-021-R03, ADR-021
	private async recordOf(acquisitionId: string): Promise<AssemblyRecord | undefined> {
		const found = await this.records.find(acquisitionId)
		if (found === undefined) {
			return undefined
		}
		if (found.delivery !== undefined) {
			return { ...found, delivery: found.delivery }
		}
		this.logger.warn(`Closed record ${acquisitionId} had no delivery to the PACS; it waits for assembly now`)
		return { ...found, delivery: await this.results.ensuredDelivery(acquisitionId) }
	}

	private async stored(
		record: AssemblyRecord,
		settings: AssemblySettings,
		written: BinaryObject[],
	): Promise<StoredArtifact[]> {
		switch (record.kind) {
			case ACQUISITION_KIND.PHOTO:
				return await this.storedImages(record, settings, written)
			case ACQUISITION_KIND.SCAN:
				return [await this.storedDocument(record, settings, written)]
			default:
				return record.kind satisfies never
		}
	}

	// CAP-021-R07, CAP-021-R09, CAP-021-R11, CAP-021-R14, CAP-021-R15, CAP-021-R26, CAP-021-R34
	private async storedImages(
		record: AssemblyRecord,
		settings: AssemblySettings,
		written: BinaryObject[],
	): Promise<StoredArtifact[]> {
		const closed = await settings.reader.closedWoundRecord(record.acquisitionId)
		if (closed === undefined) {
			throw this.missing(record)
		}
		const series = consistentSeriesOf(record, closed)
		requireSameFinding(record, closed)
		const woundNumber = woundNumberOf(record)
		const images = await this.records.imagesOf(record.acquisitionId)
		requireCompleteFiles(
			record,
			images.map((image) => image.sequence),
		)
		const assessment = {
			woundTypeNames: await this.namesOf(CODE_LIST.WOUND_TYPE, closed.closedWoundTypeCode, record),
			healingPhaseNames: await this.namesOf(CODE_LIST.HEALING_PHASE, closed.healingPhaseCode, record),
			description: closed.description,
		}
		const reserved = await this.results.reserve(
			record.acquisitionId,
			images.map((image) => ({
				sourceKind: ARTIFACT_SOURCE_KIND.IMAGE,
				sourceId: image.imageId,
				sopClassUid: SOP_CLASS.VL_PHOTOGRAPHIC_IMAGE,
			})),
		)
		const builtAt = new Date()
		const stored: StoredArtifact[] = []
		for (const [index, image] of images.entries()) {
			const artifact = reserved[index]
			if (artifact === undefined) {
				throw new Error(`no artifact is reserved for image ${image.imageId}`)
			}
			const instance = { sopInstanceUid: artifact.sopInstanceUid, sequence: image.sequence }
			const object = dicomImageObjectOf({
				...commonSourceOf(record, series, instance, settings, builtAt),
				wound: { findingId: closed.findingId, woundNumber, bodySite: closed.site },
				assessment,
				editKind: image.editKind,
				jpeg: await this.bufferedBytesOf(image.binaryObjectId),
			})
			const built = {
				artifactId: artifact.artifactId,
				variants: imageArtifactOf(object, settings.imageTransferSyntaxes, settings.identity),
				texts: writtenTextsOfImage(object, settings.language),
				instanceCreatedAt: builtAt,
			}
			stored.push(await this.storedArtifact(built, written))
		}
		return stored
	}

	// CAP-021-R10, CAP-022-R05, CAP-022-R06, CAP-022-R07, CAP-022-R16, CAP-021-R26
	private async storedDocument(
		record: AssemblyRecord,
		settings: AssemblySettings,
		written: BinaryObject[],
	): Promise<StoredArtifact> {
		const closed = await settings.reader.closedScanRecord(record.acquisitionId)
		if (closed === undefined) {
			throw this.missing(record)
		}
		const series = consistentSeriesOf(record, closed)
		const documentId = requireSameDocument(record, closed)
		const pages = await this.pages.receivedPagesOf(documentId)
		requireCompleteFiles(
			record,
			pages.map((page) => page.sequence),
		)
		const titleNames = await this.namesOf(CODE_LIST.DOCUMENT_TITLE, closed.title.code, record)
		const title = titleSourceOf(titleNames, closed.title.text, record)
		const pdf = await this.recognizedPdfOf(documentId, dicomDocumentTitleOf(title, settings.language))
		const [artifact] = await this.results.reserve(record.acquisitionId, [
			{ sourceKind: ARTIFACT_SOURCE_KIND.DOCUMENT, sourceId: documentId, sopClassUid: SOP_CLASS.ENCAPSULATED_PDF },
		])
		if (artifact === undefined) {
			throw new Error(`no artifact is reserved for document ${documentId}`)
		}
		const instance = { sopInstanceUid: artifact.sopInstanceUid, sequence: DOCUMENT_INSTANCE_SEQUENCE }
		const builtAt = new Date()
		const object = dicomDocumentObjectOf({
			...commonSourceOf(record, series, instance, settings, builtAt),
			title,
			pdf,
		})
		const built = {
			artifactId: artifact.artifactId,
			variants: documentArtifactOf(object, settings.documentTransferSyntaxes, settings.identity),
			texts: writtenTextsOfDocument(object, settings.language),
			instanceCreatedAt: builtAt,
		}
		return await this.storedArtifact(built, written)
	}

	// CAP-021-R26, CAP-017-R16, CAP-017-R18
	private async namesOf(
		codeList: CodeListCode,
		code: string | undefined,
		record: AssemblyRecord,
	): Promise<LocalizedNames | undefined> {
		if (code === undefined) {
			return undefined
		}
		return requiredNamesOf(await this.names.namesOf(codeList, code), code, record)
	}

	// CAP-022-R07, CAP-022-R10, CAP-022-R11, dorucovaci-jadro.md 5.2
	private async recognizedPdfOf(documentId: string, title: string): Promise<Uint8Array> {
		try {
			const pdf = await this.pdfs.outputPdfOf(documentId, title)
			return await this.bufferedBytesOf(pdf.binaryObjectId)
		} catch (error) {
			if (!(error instanceof TextRecognitionError)) {
				throw error
			}
			switch (textRecognitionFailureClassOf(error.failure)) {
				case TEXT_RECOGNITION_FAILURE_CLASS.PAGE:
					throw new AssemblyFailure(ASSEMBLY_FAILURE.OCR_FAILED, error.message)
				case TEXT_RECOGNITION_FAILURE_CLASS.DOCUMENT:
					throw await this.countedFailureOf(documentId, error)
				case TEXT_RECOGNITION_FAILURE_CLASS.ENVIRONMENT:
					throw error
			}
		}
	}

	// CAP-022-R10, CAP-022-R11
	private async countedFailureOf(documentId: string, error: TextRecognitionError): Promise<Error> {
		const failures = await this.results.countTextRecognitionFailure(documentId)
		if (failures >= TEXT_RECOGNITION_ATTEMPTS) {
			return new AssemblyFailure(ASSEMBLY_FAILURE.OCR_FAILED, `${error.message} (attempt ${failures})`)
		}
		return error
	}

	// CAP-021-R35, CAP-026-R18
	private async bufferedBytesOf(binaryObjectId: string): Promise<Uint8Array> {
		if (!(await this.binaryStore.exists(binaryObjectId))) {
			throw new AssemblyFailure(
				ASSEMBLY_FAILURE.MISSING_BUFFER,
				`the buffer holds no bytes of binary object ${binaryObjectId}`,
			)
		}
		return await buffer(await this.binaryStore.get(binaryObjectId))
	}

	private missing(record: AssemblyRecord): AssemblyFailure {
		return new AssemblyFailure(
			ASSEMBLY_FAILURE.CLINICAL_RECORD_MISSING,
			`the clinical record store holds no closed record ${record.acquisitionId}`,
		)
	}

	// CAP-021-R06, dorucovaci-jadro.md 2, 3
	private async storedArtifact(built: BuiltArtifact, written: BinaryObject[]): Promise<StoredArtifact> {
		const variants = []
		for (const variant of built.variants) {
			const object = binaryObjectOf(variant.part10)
			written.push(object)
			await this.binaryStore.put(object.binaryObjectId, Readable.from(variant.part10))
			variants.push({ transferSyntax: variant.transferSyntaxUid, datasetSha256: variant.datasetSha256, object })
		}
		return { artifactId: built.artifactId, variants, texts: built.texts, instanceCreatedAt: built.instanceCreatedAt }
	}

	// dorucovaci-jadro.md 2
	private async discarded(written: readonly BinaryObject[]): Promise<void> {
		for (const object of written) {
			try {
				await this.binaryStore.delete(object.binaryObjectId)
			} catch (error) {
				this.logger.error(`Dropping unrecorded binary object ${object.binaryObjectId} failed`, error)
			}
		}
	}

	// dorucovaci-jadro.md 2
	private async discardedUnlessRecorded(objects: readonly BinaryObject[]): Promise<void> {
		let recorded: ReadonlySet<string>
		try {
			recorded = await this.results.recordedObjectIdsOf(objects.map((object) => object.binaryObjectId))
		} catch (error) {
			this.logger.error(`Keeping ${objects.length} binary objects whose recording is not known`, error)
			return
		}
		await this.discarded(objects.filter((object) => !recorded.has(object.binaryObjectId)))
	}

	// dorucovaci-jadro.md 3, CAP-021-R06, ADR-005 ř. 22
	private async finished(task: ClaimedAssemblyTask, record: AssemblyRecord, stored: StoredArtifact[]): Promise<void> {
		const objects = stored.flatMap((artifact) => artifact.variants.map((variant) => variant.object))
		let isFinished: boolean
		try {
			isFinished = await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
				const locked = await this.results.lockedStateOf(tx, record.delivery.id)
				if (locked !== DELIVERY_STATE.WAITING_FOR_ASSEMBLY) {
					await this.settleIn(tx, task, locked)
					return false
				}
				await this.results.finish(tx, record.delivery.id, stored)
				await this.results.queue.complete(tx, task.id)
				return true
			})
		} catch (error) {
			await this.discardedUnlessRecorded(objects)
			throw error
		}
		if (!isFinished) {
			await this.discarded(objects)
			this.logger.warn(`Record ${record.acquisitionId} was settled by another run; task ${task.id} kept nothing`)
			return
		}
		const variants = stored.reduce((count, artifact) => count + artifact.variants.length, 0)
		this.logger.log(
			`Assembled ${stored.length} artifacts in ${variants} variants of record ${record.acquisitionId} (task ${task.id})`,
		)
	}

	// CAP-022-R11, CAP-028-R15, dorucovaci-jadro.md 5.2
	private async failed(task: ClaimedAssemblyTask, record: AssemblyRecord, failure: AssemblyFailure): Promise<void> {
		const failed: FailedAssembly = {
			acquisitionId: record.acquisitionId,
			deliveryId: record.delivery.id,
			reason: failure.reason,
		}
		const isFailed = await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const locked = await this.results.lockedStateOf(tx, failed.deliveryId)
			if (locked !== DELIVERY_STATE.WAITING_FOR_ASSEMBLY) {
				await this.settleIn(tx, task, locked)
				return false
			}
			await this.results.fail(tx, failed)
			await this.results.queue.fail(tx, task.id)
			const message = assemblyFailureMessageOf(failed)
			const alertId = await this.alerts.raise(tx, task.id, failed.deliveryId, message)
			if (alertId !== undefined) {
				const event = assemblyAlertEventOf({ alertId, taskId: task.id, message, failure: failed })
				await this.audit.appendSystemJob(tx, event, new Date())
			}
			return true
		})
		if (!isFailed) {
			this.logger.warn(`Record ${record.acquisitionId} was settled by another run; task ${task.id} done`)
			return
		}
		this.logger.error(
			`Assembling record ${record.acquisitionId} failed for good (${failure.reason}, task ${task.id}): ${failure.message}`,
		)
	}

	// datovy-model.md 4 „Doručení“, dorucovaci-jadro.md 3
	private async settleIn(tx: postgres.TransactionSql, task: ClaimedAssemblyTask, state: DeliveryState): Promise<void> {
		if (state === DELIVERY_STATE.ASSEMBLY_FAILED) {
			await this.results.queue.fail(tx, task.id)
			return
		}
		await this.results.queue.complete(tx, task.id)
	}
}
