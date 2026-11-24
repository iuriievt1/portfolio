import { useCallback } from "react"
import { type Encounter, encounterApi } from "../../../api/encounters"
import { loadedPageOf } from "../../../api/pages"
import { instanceDateOf } from "../../../utils/format-date"
import { usePagedContent } from "../../remote/hooks/use-paged-content"
import { REFRESH } from "../../remote/hooks/use-remote-content"
import { sessionCaller } from "../../session/session-actions"

export interface PatientVisits {
	today: string
}

// CAP-014-R24, CAP-014-R30, CAP-020-R12, ADR-012
export function usePatientVisits(patientId: string) {
	const readPage = useCallback(
		async (cursor: string | undefined) =>
			loadedPageOf(
				await sessionCaller.call((sessionToken) =>
					encounterApi.listPatientEncounters(sessionToken, { patient_id: patientId, cursor }),
				),
			),
		[patientId],
	)
	const readFirst = useCallback(
		async () => ({ ...(await readPage(undefined)), today: instanceDateOf(new Date()) }),
		[readPage],
	)
	return usePagedContent<Encounter, PatientVisits>(readFirst, readPage, { refresh: REFRESH.ON_FOCUS })
}
