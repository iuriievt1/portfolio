import type { ClinicalSeries, ClosedSeries } from "@ansora/vulna-domain"

// CAP-021-R39, CAP-021-R28, integrace-dicom.md 5.9
export function documentSeriesOf(series: ClosedSeries): ClinicalSeries {
	return { seriesInstanceUid: series.seriesInstanceUid, number: series.number, bodyRegion: undefined, laterality: null }
}
