import { encounterRow } from "../../encounter/__tests__/encounter-fixtures"
import type { EncounterRepository } from "../../encounter/repositories/encounter.repository"
import type { SeriesRepository } from "../repositories/series.repository"
import type { DocumentSeriesRow, SeriesOwner, SeriesRow } from "../types/acquisition.types"

export const DOCUMENT_SERIES_NUMBER = 2

export interface SeriesFake {
	repository: SeriesRepository
	assigned: { owner: SeriesOwner; id: string }[]
	locked: string[]
	removed: string[]
}

// CAP-021-R28, CAP-021-R39
export function seriesFake(existing: DocumentSeriesRow | undefined = undefined): SeriesFake {
	const assigned: SeriesFake["assigned"] = []
	const locked: string[] = []
	const removed: string[] = []
	const repository = {
		lockEncounter: async (_tx: never, encounterId: string) => {
			locked.push(encounterId)
		},
		assign: async (_tx: never, owner: SeriesOwner, id: string): Promise<SeriesRow> => {
			assigned.push({ owner, id })
			return { id, series_instance_uid: `2.25.${id}`, series_number: DOCUMENT_SERIES_NUMBER }
		},
		findOfDocument: async () => existing,
		removeOfDocument: async (_tx: never, documentId: string) => {
			removed.push(documentId)
		},
	} as unknown as SeriesRepository
	return { repository, assigned, locked, removed }
}

export function encountersOfId(): EncounterRepository {
	return { findById: async (_tx: never, id: string) => encounterRow({ id }) } as unknown as EncounterRepository
}
