import { useCallback } from "react"
import { type Encounter, encounterApi } from "../../../api/encounters"
import { readAllPages } from "../../../api/pages"
import { deviceDateOf } from "../../../utils/format-date"
import { type LoadState, useRemoteContent } from "../../remote/hooks/use-remote-content"
import { sessionCaller } from "../../session/session-actions"
import { todayVisitsOf } from "../today-visits"

export type TodayVisitsState = LoadState<{ visits: readonly Encounter[] }>

// CAP-014-R15, CAP-014-R19
export function useTodayVisits(patientId: string) {
	const read = useCallback(async () => {
		const encounters = await sessionCaller.call((sessionToken) =>
			readAllPages((cursor) =>
				encounterApi.listPatientEncounters(sessionToken, {
					patient_id: patientId,
					date: deviceDateOf(new Date()),
					cursor,
				}),
			),
		)
		return { visits: todayVisitsOf(encounters) }
	}, [patientId])
	const { state, retry } = useRemoteContent(read)
	return { state, retry }
}
