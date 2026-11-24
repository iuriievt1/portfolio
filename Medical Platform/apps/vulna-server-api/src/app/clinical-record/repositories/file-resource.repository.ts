import { DELIVERY_INSTANCE_STATE, DELIVERY_TARGET } from "@ansora/contracts"
import { JOB_OBJECT_KIND } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { ARTIFACT_SOURCE_KIND } from "../constants/clinical-record.constants"
import type {
	ArtifactSourceKind,
	FileResourceObjectKind,
	FileResourceRow,
	ScannedDocumentRow,
} from "../types/clinical-record.types"

type Fragment = postgres.PendingQuery<postgres.Row[]>

// integrace-dicom.md 5.9, CAP-021-R28, ADR-005 ř. 36
function confirmedArtifactOf(
	sql: postgres.TransactionSql,
	sourceKind: ArtifactSourceKind,
	sourceId: Fragment,
): Fragment {
	return sql`(
		SELECT artifact.id FROM artifact
		JOIN delivery_instance confirmed ON confirmed.artifact_id = artifact.id AND confirmed.state = ${DELIVERY_INSTANCE_STATE.CONFIRMED}
		WHERE artifact.source_kind = ${sourceKind} AND artifact.source_id = ${sourceId}
			AND artifact.target = ${DELIVERY_TARGET.PACS}
	)`
}

function renditionOf(sql: postgres.TransactionSql, alias: string): Fragment {
	const object = sql(alias)
	return sql`CASE WHEN ${object}.id IS NULL THEN NULL ELSE json_build_object(
		'binary_object_id', ${object}.id,
		'size_bytes', ${object}.size_bytes,
		'sha256', ${object}.sha256,
		'clinical_record_binary_id', ${object}.clinical_record_binary_id,
		'clinical_record_uploaded_at', ${object}.clinical_record_uploaded_at,
		'buffer_deleted_at', ${object}.buffer_deleted_at,
		'retention_due_at', ${object}.retention_due_at
	) END`
}

// datovy-model.md 4, CAP-021-R37, CAP-021-R39, ADR-050 bod 13
@Injectable()
export class FileResourceRepository {
	async find(
		tx: postgres.TransactionSql,
		kind: FileResourceObjectKind,
		fileId: string,
	): Promise<FileResourceRow | undefined> {
		const [row] = kind === JOB_OBJECT_KIND.IMAGE ? await this.image(tx, fileId) : await this.documentPage(tx, fileId)
		return row
	}

	// CAP-021-R39, backend.md 3 T7
	async scannedDocument(tx: postgres.TransactionSql, documentId: string): Promise<ScannedDocumentRow | undefined> {
		const [row] = await tx<ScannedDocumentRow[]>`
			SELECT d.id AS document_id, d.acquisition_id, a.patient_id, a.encounter_id, a.department_id,
				a.operator_user_id, a.closed_at, a.file_count AS page_count, d.title_code, d.title_text,
				s.series_instance_uid, ${renditionOf(tx, "o")} AS pdf, d.output_pdf_deleted_at,
				delivered.sop_instance_uid AS delivered_sop_instance_uid,
				delivered.instance_title_written AS delivered_title,
				delivered.text_language AS delivered_language,
				delivered.instance_created_at AS delivered_created_at
			FROM document d
			JOIN acquisition a ON a.id = d.acquisition_id
			JOIN series s ON s.encounter_id = a.encounter_id AND s.document_id = d.id
			LEFT JOIN binary_object o ON o.id = d.output_pdf_binary_object_id
			LEFT JOIN artifact delivered ON delivered.id = ${confirmedArtifactOf(tx, ARTIFACT_SOURCE_KIND.DOCUMENT, tx`d.id`)}
			WHERE d.id = ${documentId}
		`
		return row
	}

	// CAP-026-R19, ADR-050 bod 14
	async markDetached(tx: postgres.TransactionSql, binaryObjectIds: readonly string[]): Promise<void> {
		if (binaryObjectIds.length === 0) {
			return
		}
		await tx`
			UPDATE binary_object SET clinical_record_detached_at = now()
			WHERE id IN ${tx([...binaryObjectIds])} AND retention_due_at IS NOT NULL AND clinical_record_detached_at IS NULL
		`
	}

	private async image(tx: postgres.TransactionSql, fileId: string): Promise<FileResourceRow[]> {
		return await tx<FileResourceRow[]>`
			SELECT i.id AS file_id, i.acquisition_id, i.sequence, a.patient_id, a.encounter_id, a.department_id,
				a.finding_id, NULL AS document_id, s.series_instance_uid, delivered.sop_instance_uid,
				${renditionOf(tx, "o")} AS original, ${renditionOf(tx, "t")} AS thumbnail,
				${renditionOf(tx, "c")} AS viewing_copy, i.sha256 AS file_sha256, i.original_deleted_at
			FROM image i
			JOIN acquisition a ON a.id = i.acquisition_id
			JOIN series s ON s.encounter_id = a.encounter_id AND s.finding_id = a.finding_id
			LEFT JOIN binary_object o ON o.id = i.binary_object_id
			LEFT JOIN thumbnail th ON th.image_id = i.id
			LEFT JOIN binary_object t ON t.id = th.binary_object_id
			LEFT JOIN binary_object c ON c.id = i.viewing_copy_binary_object_id
			LEFT JOIN artifact delivered ON delivered.id = ${confirmedArtifactOf(tx, ARTIFACT_SOURCE_KIND.IMAGE, tx`i.id`)}
			WHERE i.id = ${fileId}
		`
	}

	private async documentPage(tx: postgres.TransactionSql, fileId: string): Promise<FileResourceRow[]> {
		return await tx<FileResourceRow[]>`
			SELECT p.id AS file_id, d.acquisition_id, p.sequence, a.patient_id, a.encounter_id, a.department_id,
				NULL AS finding_id, d.id AS document_id, s.series_instance_uid, delivered.sop_instance_uid,
				${renditionOf(tx, "o")} AS original, ${renditionOf(tx, "t")} AS thumbnail,
				${renditionOf(tx, "c")} AS viewing_copy, p.sha256 AS file_sha256, p.original_deleted_at
			FROM document_page p
			JOIN document d ON d.id = p.document_id
			JOIN acquisition a ON a.id = d.acquisition_id
			JOIN series s ON s.encounter_id = a.encounter_id AND s.document_id = d.id
			LEFT JOIN binary_object o ON o.id = p.binary_object_id
			LEFT JOIN binary_object t ON t.id = p.thumbnail_binary_object_id
			LEFT JOIN binary_object c ON c.id = p.viewing_copy_binary_object_id
			LEFT JOIN artifact delivered ON delivered.id = ${confirmedArtifactOf(tx, ARTIFACT_SOURCE_KIND.DOCUMENT, tx`d.id`)}
			WHERE p.id = ${fileId}
		`
	}
}
