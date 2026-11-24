import { randomUUID } from "node:crypto"
import { DELIVERY_INSTANCE_STATE, DELIVERY_STATE, DELIVERY_TARGET, type DeliveryState } from "@ansora/contracts"
import { JOB_KIND, JOB_OBJECT_KIND, QueueTaskStore } from "@ansora/core-server"
import { ACQUISITION_STATE, uidOfUuid } from "@ansora/vulna-domain"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { insertBinaryObjects } from "../../../libs/binary-store/binary-object"
import { DatabaseService } from "../../../libs/database/database.service"
import type {
	ArtifactSource,
	AssemblyDelivery,
	FailedAssembly,
	ReservedArtifact,
	StoredArtifact,
} from "../types/assembly.types"

interface ReservedArtifactRow {
	id: string
	source_kind: string
	source_id: string
	sop_class_uid: string
	sop_instance_uid: string
}

function reservedFor(source: ArtifactSource, rows: readonly ReservedArtifactRow[]): ReservedArtifact {
	const row = rows.find(
		(candidate) =>
			candidate.source_kind === source.sourceKind &&
			candidate.source_id === source.sourceId &&
			candidate.sop_class_uid === source.sopClassUid,
	)
	if (row === undefined) {
		throw new Error(`no artifact is reserved for ${source.sourceKind} ${source.sourceId}`)
	}
	return { artifactId: row.id, sopInstanceUid: row.sop_instance_uid }
}

// datovy-model.md 4 „Artefakt“, „Doručení“, dorucovaci-jadro.md 3
@Injectable()
export class AssemblyResultRepository {
	readonly queue: QueueTaskStore

	constructor(private readonly database: DatabaseService) {
		this.queue = new QueueTaskStore(database)
	}

	// CAP-021-R03, ADR-021, delivery_acquisition_target_uniq
	async ensuredDelivery(acquisitionId: string): Promise<AssemblyDelivery> {
		const sql = this.database.sql
		await sql`
			INSERT INTO delivery (id, acquisition_id, target, state)
			VALUES (${randomUUID()}, ${acquisitionId}, ${DELIVERY_TARGET.PACS}, ${DELIVERY_STATE.WAITING_FOR_ASSEMBLY})
			ON CONFLICT (acquisition_id, target) DO NOTHING
		`
		const [delivery] = await sql<AssemblyDelivery[]>`
			SELECT id, state FROM delivery WHERE acquisition_id = ${acquisitionId} AND target = ${DELIVERY_TARGET.PACS}
		`
		if (delivery === undefined) {
			throw new Error(`record ${acquisitionId} has no delivery to the PACS`)
		}
		return delivery
	}

	// dorucovaci-jadro.md 3, datovy-model.md 4 „Artefakt“, artifact_source_uniq
	async reserve(acquisitionId: string, sources: readonly ArtifactSource[]): Promise<ReservedArtifact[]> {
		if (sources.length === 0) {
			return []
		}
		const rows = sources.map((source) => ({
			id: randomUUID(),
			acquisition_id: acquisitionId,
			source_kind: source.sourceKind,
			source_id: source.sourceId,
			target: DELIVERY_TARGET.PACS,
			sop_class_uid: source.sopClassUid,
			sop_instance_uid: uidOfUuid(randomUUID()),
		}))
		const sql = this.database.sql
		await sql`
			INSERT INTO artifact ${sql(
				rows,
				"id",
				"acquisition_id",
				"source_kind",
				"source_id",
				"target",
				"sop_class_uid",
				"sop_instance_uid",
			)}
			ON CONFLICT (source_kind, source_id, target, sop_class_uid) DO NOTHING
		`
		const reserved = await sql<ReservedArtifactRow[]>`
			SELECT id, source_kind, source_id, sop_class_uid, sop_instance_uid
			FROM artifact
			WHERE acquisition_id = ${acquisitionId} AND target = ${DELIVERY_TARGET.PACS}
		`
		return sources.map((source) => reservedFor(source, reserved))
	}

	// dorucovaci-jadro.md 3, datovy-model.md 4 „Doručení“
	async lockedStateOf(tx: postgres.TransactionSql, deliveryId: string): Promise<DeliveryState> {
		const [delivery] = await tx<
			{ state: DeliveryState }[]
		>`SELECT state FROM delivery WHERE id = ${deliveryId} FOR UPDATE`
		if (delivery === undefined) {
			throw new Error(`delivery ${deliveryId} does not exist`)
		}
		return delivery.state
	}

	// dorucovaci-jadro.md 3, CAP-021-R04, CAP-021-R06, CAP-023-R15
	async finish(tx: postgres.TransactionSql, deliveryId: string, artifacts: readonly StoredArtifact[]): Promise<void> {
		const variants = artifacts.flatMap((artifact) =>
			artifact.variants.map((variant) => ({ artifactId: artifact.artifactId, ...variant })),
		)
		await insertBinaryObjects(
			tx,
			variants.map((variant) => variant.object),
		)
		const variantRows = variants.map((variant) => ({
			artifact_id: variant.artifactId,
			transfer_syntax: variant.transferSyntax,
			dataset_sha256: variant.datasetSha256,
			binary_object_id: variant.object.binaryObjectId,
		}))
		await tx`
			INSERT INTO artifact_variant ${tx(variantRows, "artifact_id", "transfer_syntax", "dataset_sha256", "binary_object_id")}
		`
		const textRows = artifacts.map((artifact) => ({
			artifact_id: artifact.artifactId,
			text_language: artifact.texts.language,
			series_description: artifact.texts.seriesDescription ?? null,
			instance_title: artifact.texts.instanceTitle ?? null,
			instance_description: artifact.texts.instanceDescription ?? null,
			instance_created_at: artifact.instanceCreatedAt.toISOString(),
		}))
		await tx`
			UPDATE artifact SET
				text_language = written.text_language,
				series_description_written = written.series_description,
				instance_title_written = written.instance_title,
				instance_description_written = written.instance_description,
				instance_created_at = written.instance_created_at
			FROM jsonb_to_recordset(${tx.json(textRows)}) AS written (
				artifact_id uuid, text_language text, series_description text, instance_title text, instance_description text,
				instance_created_at timestamptz
			)
			WHERE artifact.id = written.artifact_id
		`
		const instanceRows = artifacts.map((artifact) => ({
			id: randomUUID(),
			delivery_id: deliveryId,
			artifact_id: artifact.artifactId,
			state: DELIVERY_INSTANCE_STATE.WAITING,
		}))
		await tx`INSERT INTO delivery_instance ${tx(instanceRows, "id", "delivery_id", "artifact_id", "state")}`
		for (const instance of instanceRows) {
			await this.queue.enqueue(tx, {
				kind: JOB_KIND.DELIVERY,
				objectKind: JOB_OBJECT_KIND.DELIVERY_INSTANCE,
				objectId: instance.id,
			})
		}
		await tx`UPDATE delivery SET state = ${DELIVERY_STATE.ASSEMBLED} WHERE id = ${deliveryId}`
	}

	// CAP-022-R11, datovy-model.md 4 „Doručení“, „Pořízení“
	async fail(tx: postgres.TransactionSql, failure: FailedAssembly): Promise<void> {
		await tx`
			UPDATE delivery SET state = ${DELIVERY_STATE.ASSEMBLY_FAILED}, reason = ${failure.reason}
			WHERE id = ${failure.deliveryId}
		`
		await tx`UPDATE acquisition SET state = ${ACQUISITION_STATE.FAILED} WHERE id = ${failure.acquisitionId}`
	}

	// dorucovaci-jadro.md 2
	async recordedObjectIdsOf(binaryObjectIds: readonly string[]): Promise<ReadonlySet<string>> {
		if (binaryObjectIds.length === 0) {
			return new Set()
		}
		const sql = this.database.sql
		const rows = await sql<{ id: string }[]>`SELECT id FROM binary_object WHERE id IN ${sql([...binaryObjectIds])}`
		return new Set(rows.map((row) => row.id))
	}

	// CAP-022-R10, dorucovaci-jadro.md 5.2
	async countTextRecognitionFailure(documentId: string): Promise<number> {
		const [row] = await this.database.sql<{ text_recognition_failures: number }[]>`
			UPDATE document SET text_recognition_failures = text_recognition_failures + 1
			WHERE id = ${documentId}
			RETURNING text_recognition_failures
		`
		if (row === undefined) {
			throw new Error(`document ${documentId} does not exist`)
		}
		return row.text_recognition_failures
	}
}
