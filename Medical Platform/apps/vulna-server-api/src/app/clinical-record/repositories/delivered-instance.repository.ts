import { DELIVERY_INSTANCE_STATE } from "@ansora/contracts"
import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { ARTIFACT_SOURCE_KIND } from "../constants/clinical-record.constants"
import type { DeliveredInstanceRow, DeliveredRecordRow } from "../types/clinical-record.types"

// CAP-021-R28, integrace-dicom.md 5.4, 5.9, datovy-model.md 13.1
@Injectable()
export class DeliveredInstanceRepository {
	async recordOf(tx: postgres.TransactionSql, acquisitionId: string): Promise<DeliveredRecordRow | undefined> {
		const [record] = await tx<DeliveredRecordRow[]>`
			SELECT id AS acquisition_id, patient_id, encounter_id FROM acquisition WHERE id = ${acquisitionId}
		`
		return record
	}

	// integrace-dicom.md 5.9 Series Description
	async confirmedInSeriesOf(tx: postgres.TransactionSql, record: DeliveredRecordRow): Promise<DeliveredInstanceRow[]> {
		return await tx<DeliveredInstanceRow[]>`
			WITH confirmed AS (
				SELECT artifact.acquisition_id, artifact.source_kind, artifact.sop_class_uid, artifact.sop_instance_uid,
					artifact.instance_title_written, artifact.instance_description_written, artifact.series_description_written,
					artifact.instance_created_at, instance.retention_anchor, series.series_instance_uid,
					CASE WHEN artifact.source_kind = ${ARTIFACT_SOURCE_KIND.IMAGE}
						THEN record.first_instance_number + image.sequence - 1
						ELSE record.first_instance_number
					END AS instance_number
				FROM artifact
				JOIN delivery_instance instance
					ON instance.artifact_id = artifact.id AND instance.state = ${DELIVERY_INSTANCE_STATE.CONFIRMED}
				JOIN acquisition record ON record.id = artifact.acquisition_id
				LEFT JOIN image ON artifact.source_kind = ${ARTIFACT_SOURCE_KIND.IMAGE} AND image.id = artifact.source_id
				JOIN series ON (
					(artifact.source_kind = ${ARTIFACT_SOURCE_KIND.IMAGE} AND series.encounter_id = record.encounter_id
						AND series.finding_id = record.finding_id)
					OR (artifact.source_kind = ${ARTIFACT_SOURCE_KIND.DOCUMENT} AND series.document_id = artifact.source_id)
				)
				WHERE record.encounter_id = ${record.encounter_id}
			)
			SELECT * FROM confirmed
			WHERE series_instance_uid IN (
				SELECT series_instance_uid FROM confirmed WHERE acquisition_id = ${record.acquisition_id}
			)
			ORDER BY series_instance_uid, instance_number
		`
	}
}
