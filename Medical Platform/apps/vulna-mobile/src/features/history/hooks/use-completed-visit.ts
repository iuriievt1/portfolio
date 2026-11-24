import { useCallback } from "react"
import { type Encounter, type EncounterAcquisitionItem, encounterApi } from "../../../api/encounters"
import { loadedPageOf } from "../../../api/pages"
import { usePagedContent } from "../../remote/hooks/use-paged-content"
import { sessionCaller } from "../../session/session-actions"

export interface CompletedVisit {
	encounter: Encounter | undefined
}

// CAP-014-R21, CAP-014-R22, CAP-020-R02, ADR-012
export function useCompletedVisit(encounterId: string) {
	const readPage = useCallback(
		(cursor: string | undefined) =>
			sessionCaller.call((sessionToken) => encounterApi.listEncounterAcquisitions(sessionToken, encounterId, cursor)),
		[encounterId],
	)
	const readFirst = useCallback(async () => {
		const page = await readPage(undefined)
		return { ...loadedPageOf(page), encounter: page.encounter }
	}, [readPage])
	const readNext = useCallback(async (cursor: string) => loadedPageOf(await readPage(cursor)), [readPage])
	return usePagedContent<EncounterAcquisitionItem, CompletedVisit>(readFirst, readNext)
}
