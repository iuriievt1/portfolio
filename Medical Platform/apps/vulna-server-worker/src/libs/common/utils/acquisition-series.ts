import { ACQUISITION_KIND } from "@ansora/contracts"
import type postgres from "@veevoy/postgres"

// datovy-model.md 3, integrace-dicom.md 4
export function acquisitionSeriesCondition(sql: postgres.Sql): postgres.PendingQuery<postgres.Row[]> {
	return sql`(
		(a.kind = ${ACQUISITION_KIND.PHOTO} AND series.encounter_id = a.encounter_id AND series.finding_id = a.finding_id)
		OR (a.kind = ${ACQUISITION_KIND.SCAN} AND series.document_id = document.id)
	)`
}
