import type { ClinicalDeliveredInstance, ClinicalDelivery } from "@ansora/vulna-domain"
import { ARTIFACT_SOURCE_KIND } from "../constants/clinical-record.constants"
import type { DeliveredInstanceRow, DeliveredRecordRow } from "../types/clinical-record.types"

function latestOf(moments: readonly (Date | null)[]): string | undefined {
	const known = moments.filter((moment): moment is Date => moment !== null)
	if (known.length === 0) {
		return undefined
	}
	return new Date(Math.max(...known.map((moment) => moment.getTime()))).toISOString()
}

// integrace-dicom.md 5.9 Series Description, Document Title
function seriesDescriptionOf(row: DeliveredInstanceRow): string | undefined {
	const written =
		row.source_kind === ARTIFACT_SOURCE_KIND.DOCUMENT ? row.instance_title_written : row.series_description_written
	return written ?? undefined
}

// integrace-dicom.md 5.9 pravidlo 2
function deliveredInstanceOf(row: DeliveredInstanceRow): ClinicalDeliveredInstance {
	return {
		seriesInstanceUid: row.series_instance_uid,
		sopClassUid: row.sop_class_uid,
		sopInstanceUid: row.sop_instance_uid,
		number: row.instance_number,
		title: row.instance_title_written ?? undefined,
		description: row.instance_description_written ?? undefined,
		seriesDescription: seriesDescriptionOf(row),
	}
}

// CAP-021-R28, backend.md 3 T4, datovy-model.md 13.1 vulna-provenance
export function deliveryOf(
	record: DeliveredRecordRow,
	inSeries: readonly DeliveredInstanceRow[],
): ClinicalDelivery | undefined {
	const own = inSeries.filter((row) => row.acquisition_id === record.acquisition_id)
	const confirmedAt = latestOf(own.map((row) => row.retention_anchor))
	if (confirmedAt === undefined) {
		return undefined
	}
	return {
		acquisitionId: record.acquisition_id,
		patientId: record.patient_id,
		study: { encounterId: record.encounter_id },
		instances: inSeries.map(deliveredInstanceOf),
		createdAt: latestOf(own.map((row) => row.instance_created_at)),
		confirmedAt,
	}
}
